import React, { useCallback } from 'react';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useTranslation, type TFunction } from 'react-i18next';
import { isLabourCareEncounterType, LCG_WRITE_ENCOUNTER_TYPE_UUID, TIMER_SLOT_CONCEPT_UUID } from '../types';
import { fetchLabourCareEncountersAsResults } from './lcg-encounter-fetch';

export interface LabourTimeSetEntry {
  id: string;
  encounterUuid: string;
  hour: number;
  time: string;
  date: string;
  encounterDatetime: string;
}

function parseTimeValue(raw: unknown): string | null {
  if (!raw) return null;
  const str = String(raw);
  const match = str.match(/([0-9]{2}:[0-9]{2})/);
  return match ? match[1] : null;
}

function isTimerEncounter(encounter: any) {
  if (!isLabourCareEncounterType(encounter?.encounterType?.uuid)) {
    return false;
  }
  const obs = Array.isArray(encounter?.obs) ? encounter.obs : [];
  return obs.length === 1 && obs[0]?.concept?.uuid === TIMER_SLOT_CONCEPT_UUID;
}

export function useLabourTimeSetData(patientUuid: string, enabled: boolean = true) {
  const { t } = useTranslation();
  const encounterRepresentation =
    'custom:(uuid,encounterDatetime,encounterType:(uuid),obs:(uuid,concept:(uuid),value,obsDatetime))';

  const { data, error, isLoading, mutate } = useSWR(
    patientUuid && enabled
      ? (['labour-care-encounters', 'labour-time-set', patientUuid, encounterRepresentation] as const)
      : null,
    ([, , uuid, representation]: readonly [string, string, string, string]) =>
      fetchLabourCareEncountersAsResults(uuid, representation),
    { revalidateOnFocus: false, revalidateIfStale: false },
  );

  const labourTimeSetData: LabourTimeSetEntry[] = React.useMemo(() => {
    if (!data?.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter((encounter: any) => isTimerEncounter(encounter))
      .map((encounter: any) => {
        const timeObs = encounter.obs?.find((obs: any) => obs.concept.uuid === TIMER_SLOT_CONCEPT_UUID);
        const time = parseTimeValue(timeObs?.value);

        return {
          id: `time-${encounter.uuid}`,
          encounterUuid: encounter.uuid,
          hour: 0,
          time: time || '',
          date: new Date(encounter.encounterDatetime).toLocaleDateString(),
          encounterDatetime: encounter.encounterDatetime,
        };
      })
      .sort(
        (a: LabourTimeSetEntry, b: LabourTimeSetEntry) =>
          new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
      );
  }, [data]);

  const memoizedMutate = useCallback(mutate, [mutate]);
  return { labourTimeSetData, isLoading, error: error ? t('Failed to load time data') : null, mutate: memoizedMutate };
}

export async function saveLabourTimeSetData(
  patientUuid: string,
  formData: { time: string },
  t: TFunction,
  locationUuid?: string,
  providerUuid?: string,
): Promise<{ success: boolean; message: string }> {
  const safeDate = new Date();
  safeDate.setMinutes(safeDate.getMinutes() - 5);
  const timestamp = safeDate.toISOString();

  const encounterPayload: any = {
    patient: patientUuid,
    location: locationUuid,
    encounterDatetime: timestamp,
    encounterType: LCG_WRITE_ENCOUNTER_TYPE_UUID,
    obs: [
      {
        concept: TIMER_SLOT_CONCEPT_UUID,
        value: `Time: ${formData.time}`,
        obsDatetime: timestamp,
      },
    ],
  };

  if (providerUuid) {
    encounterPayload.encounterProviders = [
      {
        provider: providerUuid,
      },
    ];
  }

  try {
    const response = await openmrsFetch(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: encounterPayload,
    });

    return response.ok
      ? { success: true, message: t('Time data saved successfully') }
      : { success: false, message: t('Failed to save time data') };
  } catch (error: any) {
    const fieldErrors = error?.responseBody?.error?.fieldErrors;
    const dateError = fieldErrors?.encounterDatetime?.[0]?.message;
    return { success: false, message: dateError || error?.message || t('Failed to save time data') };
  }
}
