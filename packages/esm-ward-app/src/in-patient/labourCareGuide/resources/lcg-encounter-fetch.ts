import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  LCG_READ_ENCOUNTER_TYPE_UUIDS,
  MCH_LCG_ENCOUNTER_UUID,
  MCH_PARTOGRAPHY_ENCOUNTER_UUID,
} from '../types';

export { LCG_READ_ENCOUNTER_TYPE_UUIDS, MCH_LCG_ENCOUNTER_UUID, MCH_PARTOGRAPHY_ENCOUNTER_UUID };

export type LabourCareEncounterOrder = 'asc' | 'desc';

type EncounterWithMeta = {
  uuid?: string;
  encounterDatetime?: string;
  voided?: boolean;
};

/**
 * Builds a REST search URL for a single encounter type.
 * Writes always use {@link MCH_LCG_ENCOUNTER_UUID}; reads should call
 * {@link fetchLabourCareEncounters} so both LCG and legacy Partograph types are returned.
 */
export function buildEncounterTypeSearchUrl(
  patientUuid: string,
  encounterTypeUuid: string,
  representation: string,
  limit = 40,
  order: LabourCareEncounterOrder = 'desc',
): string {
  return `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=${representation}&limit=${limit}&order=${order}`;
}

export function mergeEncountersByUuid<T extends EncounterWithMeta>(...groups: T[][]): T[] {
  const byUuid = new Map<string, T>();
  for (const group of groups) {
    for (const encounter of group) {
      if (!encounter?.uuid || encounter.voided || byUuid.has(encounter.uuid)) {
        continue;
      }
      byUuid.set(encounter.uuid, encounter);
    }
  }
  return Array.from(byUuid.values());
}

function sortEncountersByDatetime<T extends EncounterWithMeta>(encounters: T[], order: LabourCareEncounterOrder): T[] {
  const sorted = [...encounters].sort(
    (a, b) => new Date(a.encounterDatetime ?? 0).getTime() - new Date(b.encounterDatetime ?? 0).getTime(),
  );
  return order === 'desc' ? sorted.reverse() : sorted;
}

async function readEncounterResults(response: { data?: { results?: unknown[] }; ok?: boolean; json?: () => Promise<any> }) {
  if (response?.data && Array.isArray(response.data.results)) {
    return response.data.results;
  }
  if (typeof response?.json === 'function') {
    const body = await response.json();
    return Array.isArray(body?.results) ? body.results : [];
  }
  return [];
}

/**
 * Fetches LCG + legacy Partograph encounters and merges them chronologically.
 * Deduplicates by encounter UUID so the unified timeline stays consistent.
 */
export async function fetchLabourCareEncounters<T extends EncounterWithMeta = any>(
  patientUuid: string,
  representation: string,
  options?: { limit?: number; order?: LabourCareEncounterOrder },
): Promise<T[]> {
  const limit = options?.limit ?? 40;
  const order = options?.order ?? 'desc';

  const groups = await Promise.all(
    LCG_READ_ENCOUNTER_TYPE_UUIDS.map(async (encounterTypeUuid) => {
      const url = buildEncounterTypeSearchUrl(patientUuid, encounterTypeUuid, representation, limit, order);
      const response = await openmrsFetch(url);
      if (response && 'ok' in response && response.ok === false) {
        return [] as T[];
      }
      return (await readEncounterResults(response)) as T[];
    }),
  );

  return sortEncountersByDatetime(mergeEncountersByUuid(...groups), order);
}

/** SWR-friendly fetcher that returns `{ results }` to match existing single-type hooks. */
export async function fetchLabourCareEncountersAsResults(
  patientUuid: string,
  representation: string,
  options?: { limit?: number; order?: LabourCareEncounterOrder },
): Promise<{ results: any[] }> {
  const results = await fetchLabourCareEncounters(patientUuid, representation, options);
  return { results };
}
