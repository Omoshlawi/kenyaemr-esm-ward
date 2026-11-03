import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { BLOOD_TRANSFUSION_DEFAULTS, TRANSFUSION_OBSERVATION_ROWS } from '../config/blood-transfusion.defaults';
import { type BackendTransfusion, type BloodTransfusion } from '../types/blood-transfusion.types';
import {
  buildHeaderObs,
  buildRowGroup,
  facilityLocalToIso,
  HEADER_CONCEPTS,
  HEADER_LABELS,
  mapEncounterToBackendTransfusion,
  obsValuesMatch,
  rowSignature,
  rowTakenAtLocal,
  TRANSFUSION_ROW_COMMENT_PREFIX,
  type RestTransfusionEncounter,
  type RestTransfusionObs,
  type TransfusionObsPayload,
} from '../utils/blood-transfusion-obs.mapper';
import { outOfRangeVitals } from '../utils/blood-transfusion.utils';
import { toVisitSafeEncounterDatetime } from '../utils/encounter-datetime.utils';
import { filterObsForOpenMrs } from '../utils/openmrs-concept-metadata';
import { getOpenMrsErrorMessage } from '../utils/openmrs-error.utils';
import { fetchPatientEncountersByType } from './openmrs-encounter-search';
import { resolveEncounterTypeByUuidOrName, resolveOrCreateEncounterType } from './resolve-encounter-type';

const ENCOUNTER_REPRESENTATION =
  'custom:(uuid,encounterDatetime,voided,obs:(uuid,obsDatetime,comment,concept:(uuid),value,groupMembers:(uuid,concept:(uuid),value)))';

type VoidedObs = { uuid: string; voided: true };

export async function fetchBloodTransfusionsFromBackend(
  patientUuid: string,
  encounterTypeUuid: string,
  timeZone?: string,
): Promise<BackendTransfusion[]> {
  const resolved = await resolveEncounterTypeByUuidOrName(
    encounterTypeUuid,
    BLOOD_TRANSFUSION_DEFAULTS.encounterTypeName,
  );
  if (!resolved) {
    return [];
  }
  const encounters = await fetchPatientEncountersByType<RestTransfusionEncounter>(
    patientUuid,
    resolved.uuid,
    ENCOUNTER_REPRESENTATION,
  );
  // Shared encounter types (e.g. Clinical Consultation) may include non-transfusion records —
  // keep only encounters that carry transfusion obs.
  return encounters
    .map((encounter) => mapEncounterToBackendTransfusion(encounter, timeZone))
    .filter(isBloodTransfusionEncounter);
}

/** True when the mapped encounter has transfusion-specific data (not a generic consultation). */
function isBloodTransfusionEncounter(record: BackendTransfusion): boolean {
  return Boolean(
    record.donorNumber ||
      record.timeStarted ||
      record.amountMl != null ||
      record.bloodTypes.length ||
      Object.keys(record.observations).length,
  );
}

export type SyncBloodTransfusionInput = {
  transfusion: BloodTransfusion;
  /** Observation rows to (re)send; header fields are always brought up to date. */
  rowIds: string[];
  patientUuid: string;
  visitUuid: string;
  visitStartDatetime?: string;
  locationUuid: string;
  encounterTypeUuid: string;
  providerUuid?: string;
  encounterRoleUuid?: string;
  timeZone?: string;
  /** Facility clock as `YYYY-MM-DDTHH:MM`. */
  nowLocal: string;
};

export type SyncBloodTransfusionResult = {
  encounterUuid: string;
  /** Row id → signature now saved in OpenMRS ('' for a row that was cleared). */
  syncedRows: Record<string, string>;
};

async function postEncounter(path: string, body: Record<string, unknown>): Promise<string> {
  try {
    const response = await openmrsFetch<{ uuid?: string }>(`${restBaseUrl}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.data?.uuid) {
      throw new Error('OpenMRS did not return the transfusion encounter');
    }
    return response.data.uuid;
  } catch (error) {
    throw new Error(getOpenMrsErrorMessage(error, 'Failed to save the blood transfusion to OpenMRS'));
  }
}

async function fetchEncounter(encounterUuid: string): Promise<RestTransfusionEncounter | null> {
  try {
    const response = await openmrsFetch<RestTransfusionEncounter>(
      `${restBaseUrl}/encounter/${encounterUuid}?v=${ENCOUNTER_REPRESENTATION}`,
    );
    return response.data?.uuid && !response.data.voided ? response.data : null;
  } catch {
    return null;
  }
}

/** Voids a top-level obs together with its group members; voiding a group alone leaves its members active. */
const voidObsTree = (obs: RestTransfusionObs): VoidedObs[] => [
  { uuid: obs.uuid, voided: true },
  ...(obs.groupMembers ?? []).map((member) => ({ uuid: member.uuid, voided: true as const })),
];

/**
 * Creates the transfusion encounter on first save, then replaces only what changed: header obs whose value differs
 * and the obs groups of the given rows.
 */
export async function syncBloodTransfusion(input: SyncBloodTransfusionInput): Promise<SyncBloodTransfusionResult> {
  const { transfusion, rowIds, timeZone, nowLocal, visitStartDatetime } = input;
  const encounterType = await resolveOrCreateEncounterType({
    configuredUuid: input.encounterTypeUuid,
    name: BLOOD_TRANSFUSION_DEFAULTS.encounterTypeName,
    description: BLOOD_TRANSFUSION_DEFAULTS.encounterTypeDescription,
    configKeyHint: 'bloodTransfusion.encounterTypeUuid',
  });

  const startedLocal = transfusion.transfusionDate
    ? `${transfusion.transfusionDate}T${transfusion.transfusionTime ?? '00:00'}`
    : nowLocal;
  const encounterDatetime = toVisitSafeEncounterDatetime(
    facilityLocalToIso(startedLocal, timeZone),
    visitStartDatetime,
  );

  const { valid: headerObs } = await filterObsForOpenMrs(
    buildHeaderObs(transfusion, encounterDatetime, timeZone),
    HEADER_LABELS,
  );
  const rowGroups = new Map<string, TransfusionObsPayload>();
  const incompleteRows = new Set<string>();
  for (const rowId of rowIds) {
    const row = TRANSFUSION_OBSERVATION_ROWS.find((item) => item.id === rowId);
    if (!row) {
      continue;
    }
    const takenAt = toVisitSafeEncounterDatetime(
      facilityLocalToIso(rowTakenAtLocal(row, transfusion, nowLocal), timeZone),
      visitStartDatetime,
    );
    const group = buildRowGroup(rowId, transfusion.observations[rowId], takenAt);
    if (outOfRangeVitals(transfusion.observations[rowId]).length) {
      incompleteRows.add(rowId);
    }
    if (!group?.groupMembers) {
      continue;
    }
    // A single rejected member fails the whole encounter, so members get the same checks as top-level obs.
    const { valid: members, skippedCount } = await filterObsForOpenMrs(group.groupMembers, new Map());
    if (skippedCount) {
      incompleteRows.add(rowId);
    }
    if (members.length) {
      rowGroups.set(rowId, { ...group, groupMembers: members });
    }
  }

  const existing = transfusion.encounterUuid ? await fetchEncounter(transfusion.encounterUuid) : null;
  let encounterUuid: string;

  if (!existing) {
    const body: Record<string, unknown> = {
      patient: input.patientUuid,
      visit: input.visitUuid,
      location: input.locationUuid,
      encounterType: encounterType.uuid,
      encounterDatetime,
      obs: [...headerObs, ...rowGroups.values()],
    };
    if (input.providerUuid && input.encounterRoleUuid) {
      body.encounterProviders = [{ provider: input.providerUuid, encounterRole: input.encounterRoleUuid }];
    }
    encounterUuid = await postEncounter('encounter', body);
  } else {
    encounterUuid = existing.uuid;
    const changes: Array<VoidedObs | TransfusionObsPayload> = [];
    const topLevel = existing.obs ?? [];

    for (const concept of HEADER_CONCEPTS) {
      const current = topLevel.filter(
        (obs) => obs.concept?.uuid === concept && !obs.comment?.startsWith(TRANSFUSION_ROW_COMMENT_PREFIX),
      );
      const wanted = headerObs.filter((obs) => obs.concept === concept);
      const unchanged =
        current.length === wanted.length &&
        wanted.every((obs) => current.some((saved) => obsValuesMatch(saved.value, obs.value)));
      if (unchanged) {
        continue;
      }
      changes.push(...current.flatMap(voidObsTree), ...wanted);
    }

    for (const rowId of rowIds) {
      const comment = `${TRANSFUSION_ROW_COMMENT_PREFIX}${rowId}`;
      changes.push(...topLevel.filter((obs) => obs.comment === comment).flatMap(voidObsTree));
      const group = rowGroups.get(rowId);
      if (group) {
        changes.push(group);
      }
    }

    if (changes.length) {
      await postEncounter(`encounter/${encounterUuid}`, { obs: changes });
    }
  }

  return {
    encounterUuid,
    syncedRows: Object.fromEntries(
      rowIds.map((rowId) => [rowId, incompleteRows.has(rowId) ? '' : rowSignature(transfusion.observations[rowId])]),
    ),
  };
}

export async function voidBloodTransfusionEncounter(encounterUuid: string): Promise<void> {
  try {
    await openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, { method: 'DELETE' });
  } catch (error) {
    throw new Error(getOpenMrsErrorMessage(error, 'Failed to remove the blood transfusion from OpenMRS'));
  }
}
