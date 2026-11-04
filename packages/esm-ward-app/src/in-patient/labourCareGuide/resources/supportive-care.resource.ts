import { openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useCallback } from 'react';
import type { TFunction } from 'react-i18next';
import {
  LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
  LCG_EMERGENCY_REASON_CONCEPT_UUID,
  LCG_WRITE_ENCOUNTER_TYPE_UUID,
  SUPPORTIVE_CARE_CODED_VALUES,
  SUPPORTIVE_CARE_FORM_CONCEPTS,
  ENCOUNTER_ROLE,
} from '../types';
import { type LcgGridSlotOptions, validateStageAwareGridSlotSubmission } from '../time-slot-utils';
import { parseLcgEntryTimeString } from '../labour-care-guide.utils';
import { fetchLabourCareEncountersAsResults } from './lcg-encounter-fetch';

export interface SupportiveCareFormPayload {
  time: string;
  companion: string;
  painRelief: string;
  oralFluid: string;
  posture: string;
}

export interface SaveSupportiveCareResponse {
  success: boolean;
  message: string;
  encounter?: any;
  error?: string;
}

export interface SupportiveCareEntry {
  id: string;
  encounterUuid: string;
  encounterDatetime: string;
  time: string;
  companion: string;
  painRelief: string;
  oralFluid: string;
  posture: string;
  isEmergency?: boolean;
  emergencyReason?: string;
}

type SupportiveCareSaveOptions = {
  emergencyReason?: string;
  lcgValidation?: {
    baseTime: string;
    slotCount: number;
    firstStageSlotCount?: number;
    secondStageSlotCount?: number;
    secondStageStartTime?: string;
    gridSlotOptions?: LcgGridSlotOptions;
  };
};

/**
 * Saves Supportive Care data as a new encounter
 */
export async function saveSupportiveCareData(
  patientUuid: string,
  formData: SupportiveCareFormPayload,
  t: TFunction,
  providerUuid?: string,
  locationUuid?: string,
  options?: SupportiveCareSaveOptions,
): Promise<SaveSupportiveCareResponse> {
  try {
    const session = await getCurrentSession();
    const finalProviderUuid = providerUuid || session?.currentProvider?.uuid;
    const finalLocationUuid = locationUuid || session?.sessionLocation?.uuid;

    if (!finalProviderUuid || !finalLocationUuid) {
      return {
        success: false,
        message: t('sessionInfoMissing', 'Provider or Location information is missing'),
        error: 'NO_SESSION',
      };
    }

    if (!options?.emergencyReason && options?.lcgValidation) {
      const { baseTime, slotCount, firstStageSlotCount, secondStageSlotCount, secondStageStartTime, gridSlotOptions } =
        options.lcgValidation;
      const validation = validateStageAwareGridSlotSubmission(
        baseTime,
        formData.time,
        new Date(),
        firstStageSlotCount ?? slotCount,
        secondStageSlotCount ?? 0,
        secondStageStartTime,
        gridSlotOptions,
      );

      if (!validation.valid) {
        return {
          success: false,
          message:
            validation.errorCode === 'FUTURE_TIME'
              ? t('futureTimeError', 'Cannot select a future time')
              : t(
                  'lcgSlotLocked',
                  'This time slot has closed. Data can only be entered during the active monitoring window.',
                ),
          error: validation.errorCode ?? 'SLOT_LOCKED',
        };
      }
    }

    const encounterPayload = {
      patient: patientUuid,
      encounterType: LCG_WRITE_ENCOUNTER_TYPE_UUID,
      location: finalLocationUuid,
      // Encounter time is set slightly in the past to avoid 'future encounter' errors on slow servers
      encounterDatetime: toOmrsIsoString(new Date(Date.now() - 2 * 60 * 1000)),
      obs: buildSupportiveCareObservations(formData, options),
      encounterProviders: [
        {
          provider: finalProviderUuid,
          encounterRole: ENCOUNTER_ROLE,
        },
      ],
    };

    const response = await openmrsFetch(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encounterPayload),
    });

    if (!response.ok) {
      return { success: false, message: t('saveFailed', 'Server failed to save data'), error: 'SAVE_FAILED' };
    }

    return {
      success: true,
      message: t('saveSuccess', 'Data saved successfully'),
      encounter: await response.json(),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : t('unknownError', 'Unknown error'),
      error: 'EXCEPTION',
    };
  }
}

/**
 * Maps form data to OpenMRS Observation structure
 */
function buildSupportiveCareObservations(formData: SupportiveCareFormPayload, options?: SupportiveCareSaveOptions) {
  const obsDatetime = toOmrsIsoString(new Date());

  const emergencyObs =
    options?.emergencyReason && options.emergencyReason.trim()
      ? [
          {
            concept: LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
            value: SUPPORTIVE_CARE_CODED_VALUES.YES,
            obsDatetime,
          },
          {
            concept: LCG_EMERGENCY_REASON_CONCEPT_UUID,
            value: options.emergencyReason.trim(),
            obsDatetime,
          },
        ]
      : [];

  return [
    {
      concept: SUPPORTIVE_CARE_FORM_CONCEPTS.time,
      // Consistent storage: HH:mm format
      value: formData.time,
      obsDatetime,
    },
    {
      concept: SUPPORTIVE_CARE_FORM_CONCEPTS.companion,
      value: formData.companion,
      obsDatetime,
    },
    {
      concept: SUPPORTIVE_CARE_FORM_CONCEPTS.painReliefGiven,
      value: formData.painRelief,
      obsDatetime,
    },
    {
      concept: SUPPORTIVE_CARE_FORM_CONCEPTS.oral,
      value: formData.oralFluid,
      obsDatetime,
    },
    {
      concept: SUPPORTIVE_CARE_FORM_CONCEPTS.posture,
      value: formData.posture,
      obsDatetime,
    },
    ...emergencyObs,
  ];
}

async function getCurrentSession() {
  const response = await openmrsFetch(`${restBaseUrl}/session`);
  return response.ok ? await response.json() : null;
}

export const SUPPORTIVE_CARE_OPTIONS = {
  YES_NO_DECLINED: [
    { value: SUPPORTIVE_CARE_CODED_VALUES.YES, labelKey: 'yes', defaultLabel: 'Yes' },
    { value: SUPPORTIVE_CARE_CODED_VALUES.NO, labelKey: 'no', defaultLabel: 'No' },
    { value: SUPPORTIVE_CARE_CODED_VALUES.DECLINED, labelKey: 'declined', defaultLabel: 'Declined' },
  ],
  POSTURE: [
    { value: SUPPORTIVE_CARE_CODED_VALUES.SUPINE, labelKey: 'supine', defaultLabel: 'SP-Supine' },
    { value: SUPPORTIVE_CARE_CODED_VALUES.MOBILE, labelKey: 'mobile', defaultLabel: 'MO-Mobile' },
  ],
} as const;

const SUPPORTIVE_CARE_CODE_TO_DISPLAY: Record<string, string> = {
  [SUPPORTIVE_CARE_CODED_VALUES.YES]: 'Y',
  [SUPPORTIVE_CARE_CODED_VALUES.NO]: 'N',
  [SUPPORTIVE_CARE_CODED_VALUES.DECLINED]: 'D',
  [SUPPORTIVE_CARE_CODED_VALUES.SUPINE]: 'SP',
  [SUPPORTIVE_CARE_CODED_VALUES.MOBILE]: 'MO',
};

const toSupportiveCareDisplayValue = (raw: unknown): string => {
  if (raw === null || raw === undefined || raw === '') {
    return '';
  }

  const key =
    typeof raw === 'object' && raw && 'uuid' in (raw as Record<string, unknown>)
      ? String((raw as { uuid?: string }).uuid ?? '')
      : String(raw).trim();

  return SUPPORTIVE_CARE_CODE_TO_DISPLAY[key] || key;
};

/**
 * Data Hook for fetching and parsing entries
 */
export function useSupportiveCareData(patientUuid: string, enabled = true) {
  const encounterRepresentation =
    'custom:(uuid,encounterDatetime,encounterType:(uuid),obs:(uuid,concept:(uuid),value,obsDatetime))';
  const { data, error, isLoading, mutate } = useSWR(
    patientUuid && enabled
      ? (['labour-care-encounters', 'supportive-care', patientUuid, encounterRepresentation] as const)
      : null,
    ([, , uuid, representation]: readonly [string, string, string, string]) =>
      fetchLabourCareEncountersAsResults(uuid, representation),
    { revalidateOnFocus: false, revalidateIfStale: false },
  );

  const supportiveCareEntries: SupportiveCareEntry[] = Array.isArray(data?.results)
    ? data.results
        .map((encounter: any) => {
          const obs = encounter.obs || [];
          const getVal = (conceptUuid: string) => {
            const entry = obs.find((o: any) => o.concept?.uuid === conceptUuid);
            const val = entry?.value;
            if (val && typeof val === 'object' && val.uuid) return val.uuid;
            return val;
          };

          const companion = getVal(SUPPORTIVE_CARE_FORM_CONCEPTS.companion);
          if (!companion) return null;

          return {
            id: encounter.uuid,
            encounterUuid: encounter.uuid,
            encounterDatetime: encounter.encounterDatetime,
            time: parseLcgEntryTimeString(getVal(SUPPORTIVE_CARE_FORM_CONCEPTS.time)) || '',
            companion: toSupportiveCareDisplayValue(companion),
            painRelief: toSupportiveCareDisplayValue(getVal(SUPPORTIVE_CARE_FORM_CONCEPTS.painReliefGiven)),
            oralFluid: toSupportiveCareDisplayValue(getVal(SUPPORTIVE_CARE_FORM_CONCEPTS.oral)),
            posture: toSupportiveCareDisplayValue(getVal(SUPPORTIVE_CARE_FORM_CONCEPTS.posture)),
            isEmergency: ['true', SUPPORTIVE_CARE_CODED_VALUES.YES.toLowerCase()].includes(
              String(getVal(LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID)).toLowerCase(),
            ),
            emergencyReason: String(getVal(LCG_EMERGENCY_REASON_CONCEPT_UUID) || '').trim(),
          };
        })
        .filter((entry: any): entry is SupportiveCareEntry => entry !== null) // Improved Type Guard
        .sort(
          (a: SupportiveCareEntry, b: SupportiveCareEntry) =>
            new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
        )
    : [];

  const memoizedMutate = useCallback(mutate, [mutate]);

  return {
    supportiveCareEntries,
    error,
    isLoading,
    mutate: memoizedMutate,
  };
}
