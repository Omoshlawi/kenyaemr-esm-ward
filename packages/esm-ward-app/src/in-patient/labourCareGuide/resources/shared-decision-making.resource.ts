import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useCallback } from 'react';
import type { TFunction } from 'react-i18next';
import {
  getValidEncounterDatetime,
  LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
  LCG_EMERGENCY_REASON_CONCEPT_UUID,
  LCG_TERMINATION_REASON_TYPE_CONCEPT_UUID,
  LCG_WRITE_ENCOUNTER_TYPE_UUID,
  PARTOGRAPHY_CONCEPTS,
  SHARED_DECISION_MAKING_CONCEPTS,
  SHARED_DECISION_MAKING_ACTIONS,
  ENCOUNTER_ROLE,
} from '../types';
import { fetchLabourCareEncountersAsResults } from './lcg-encounter-fetch';

const CODED_YES = '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const sharedDecisionActionLabelMap = Object.fromEntries(
  SHARED_DECISION_MAKING_ACTIONS.map((action) => [action.value, action.label]),
);

export interface SharedDecisionMakingFormPayload {
  assessment: string;
  plan: string;
  action: string;
}

export interface SharedDecisionMakingEntry {
  id: string;
  encounterUuid: string;
  encounterDatetime: string;
  assessment: string;
  plan: string;
  action: string;
  time?: string;
  isEmergency?: boolean;
  emergencyReason?: string;
  terminationReasonType?: string;
  terminationReasonTypeUuid?: string;
  terminationReasonText?: string;
}

type SharedDecisionSaveOptions = {
  emergencyReason?: string;
  terminationReasonType?: string;
  terminationReasonText?: string;
};

export const normalizeSharedDecisionMakingAction = (value: unknown): string => {
  if (typeof value === 'string') {
    return sharedDecisionActionLabelMap[value] ?? value;
  }

  if (value && typeof value === 'object') {
    const conceptValue = value as { uuid?: string; display?: string; name?: { name?: string } | string };
    if (conceptValue.uuid && sharedDecisionActionLabelMap[conceptValue.uuid]) {
      return sharedDecisionActionLabelMap[conceptValue.uuid];
    }

    if (typeof conceptValue.display === 'string') {
      return conceptValue.display;
    }

    if (typeof conceptValue.name === 'string') {
      return conceptValue.name;
    }

    if (conceptValue.name && typeof conceptValue.name === 'object' && typeof conceptValue.name.name === 'string') {
      return conceptValue.name.name;
    }
  }

  return '';
};

const toOpenmrsDateTimeString = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

const toEncounterIsoFromHHMM = (hhmm: string, encounterIso: string): string => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((hhmm ?? '').trim());
  if (!match) {
    return encounterIso;
  }

  const encounterDate = new Date(encounterIso);
  if (Number.isNaN(encounterDate.getTime())) {
    return encounterIso;
  }

  encounterDate.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return toOpenmrsDateTimeString(encounterDate);
};

const toHHMMFromObsValue = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const raw = value.trim();
  if (!raw) {
    return '';
  }

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    return raw;
  }

  if (raw.startsWith('Time:')) {
    return raw.replace(/^Time:\s*/, '').trim();
  }

  const isoDate = new Date(raw);
  if (!Number.isNaN(isoDate.getTime())) {
    return `${String(isoDate.getHours()).padStart(2, '0')}:${String(isoDate.getMinutes()).padStart(2, '0')}`;
  }

  const openmrsDateTimeMatch = raw.match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})(?::\d{2})?$/);
  if (openmrsDateTimeMatch) {
    return `${openmrsDateTimeMatch[1]}:${openmrsDateTimeMatch[2]}`;
  }

  return '';
};

export async function saveSharedDecisionMakingData(
  patientUuid: string,
  formData: SharedDecisionMakingFormPayload & { time?: string },
  t: TFunction,
  providerUuid?: string,
  locationUuid?: string,
  options?: SharedDecisionSaveOptions,
): Promise<{ success: boolean; message: string; encounter?: any; error?: string }> {
  try {
    const session = await getCurrentSession();
    const finalProviderUuid = providerUuid || session?.currentProvider?.uuid;
    const finalLocationUuid = locationUuid || session?.sessionLocation?.uuid;
    if (!finalProviderUuid) {
      return { success: false, message: t('Provider information is required'), error: 'NO_PROVIDER' };
    }
    if (!finalLocationUuid) {
      return { success: false, message: t('Location information is required'), error: 'NO_LOCATION' };
    }
    const obsDatetime = getValidEncounterDatetime();
    const encounterPayload = {
      patient: patientUuid,
      encounterType: LCG_WRITE_ENCOUNTER_TYPE_UUID,
      location: finalLocationUuid,
      encounterDatetime: obsDatetime,
      obs: [
        ...(formData.time
          ? [
              {
                concept: PARTOGRAPHY_CONCEPTS['time-slot'],
                value: toEncounterIsoFromHHMM(formData.time, obsDatetime),
                obsDatetime,
              },
            ]
          : []),
        {
          concept: SHARED_DECISION_MAKING_CONCEPTS.assessment,
          value: formData.assessment,
          obsDatetime,
        },
        {
          concept: SHARED_DECISION_MAKING_CONCEPTS.plan,
          value: formData.plan,
          obsDatetime,
        },
        {
          concept: SHARED_DECISION_MAKING_CONCEPTS.action,
          value: formData.action,
          obsDatetime,
        },
        ...(options?.emergencyReason && options.emergencyReason.trim()
          ? [
              {
                concept: LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
                value: CODED_YES,
                obsDatetime,
              },
              {
                concept: LCG_EMERGENCY_REASON_CONCEPT_UUID,
                value: options.emergencyReason.trim(),
                obsDatetime,
              },
            ]
          : []),
        ...(options?.terminationReasonType
          ? [
              {
                concept: LCG_TERMINATION_REASON_TYPE_CONCEPT_UUID,
                value: options.terminationReasonType,
                obsDatetime,
              },
            ]
          : []),
        ...(options?.terminationReasonText && options.terminationReasonText.trim()
          ? [
              {
                concept: LCG_EMERGENCY_REASON_CONCEPT_UUID,
                value: options.terminationReasonText.trim(),
                obsDatetime,
              },
            ]
          : []),
      ],
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
      const errorText = await response.text();
      let errorMessage = t(`Failed to save shared decision making data: ${response.status} ${response.statusText}`);
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = t(`Failed to save shared decision making data: ${errorData.error.message}`);
        }
      } catch {
        // Preserve the generic save error if the server response is not JSON.
      }
      return { success: false, message: errorMessage, error: 'SAVE_FAILED' };
    }
    return {
      success: true,
      message: t('Shared decision making data saved successfully'),
      encounter: await response.json(),
    };
  } catch (error) {
    return {
      success: false,
      message: t(
        `Failed to save shared decision making data: ${error instanceof Error ? error.message : t('Unknown error')}`,
      ),
      error: 'EXCEPTION',
    };
  }
}

export function useSharedDecisionMakingData(patientUuid: string, enabled = true) {
  const encounterRepresentation =
    'custom:(uuid,encounterDatetime,encounterType:(uuid),obs:(uuid,concept:(uuid),value,obsDatetime))';
  const { data, error, isLoading, mutate } = useSWR(
    patientUuid && enabled
      ? (['labour-care-encounters', 'shared-decision', patientUuid, encounterRepresentation] as const)
      : null,
    ([, , uuid, representation]: readonly [string, string, string, string]) =>
      fetchLabourCareEncountersAsResults(uuid, representation),
    { revalidateOnFocus: false, revalidateIfStale: false },
  );
  const normalizeObsValue = (value: unknown) => {
    if (typeof value === 'string') {
      return value;
    }

    if (value && typeof value === 'object') {
      const conceptValue = value as { uuid?: string; display?: string; name?: { name?: string } | string };
      if (conceptValue.uuid && sharedDecisionActionLabelMap[conceptValue.uuid]) {
        return sharedDecisionActionLabelMap[conceptValue.uuid];
      }

      if (typeof conceptValue.display === 'string') {
        return conceptValue.display;
      }

      if (typeof conceptValue.name === 'string') {
        return conceptValue.name;
      }

      if (conceptValue.name && typeof conceptValue.name === 'object' && typeof conceptValue.name.name === 'string') {
        return conceptValue.name.name;
      }
    }

    return '';
  };

  const entries: SharedDecisionMakingEntry[] = Array.isArray(data?.results)
    ? (data.results
        .map((encounter) => {
          const observations = Array.isArray(encounter.obs) ? encounter.obs : [];
          const assessmentObs = observations.find(
            (obs) => obs.concept?.uuid === SHARED_DECISION_MAKING_CONCEPTS.assessment,
          );
          const planObs = observations.find((obs) => obs.concept?.uuid === SHARED_DECISION_MAKING_CONCEPTS.plan);
          const actionObs = observations.find((obs) => obs.concept?.uuid === SHARED_DECISION_MAKING_CONCEPTS.action);
          const timeObs = observations.find(
            (obs) => obs.concept?.uuid === PARTOGRAPHY_CONCEPTS['time-slot'] && typeof obs.value === 'string',
          );
          const terminationReasonTypeObs = observations.find(
            (obs) => obs.concept?.uuid === LCG_TERMINATION_REASON_TYPE_CONCEPT_UUID,
          );
          const terminationReasonTextObs = observations.find(
            (obs) => obs.concept?.uuid === LCG_EMERGENCY_REASON_CONCEPT_UUID,
          );
          if (!assessmentObs && !planObs && !actionObs) {
            return null;
          }

          const normalizedTime = toHHMMFromObsValue(timeObs?.value);
          const terminationReasonTypeUuid = normalizeObsValue(terminationReasonTypeObs?.value);

          return {
            id: `shared-decision-${encounter.uuid}`,
            encounterUuid: encounter.uuid,
            encounterDatetime: encounter.encounterDatetime,
            assessment: normalizeObsValue(assessmentObs?.value),
            plan: normalizeObsValue(planObs?.value),
            action: normalizeSharedDecisionMakingAction(actionObs?.value),
            time: normalizedTime || undefined,
            isEmergency: ['true', CODED_YES.toLowerCase()].includes(
              String(
                observations.find((obs) => obs.concept?.uuid === LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID)?.value || '',
              ).toLowerCase(),
            ),
            emergencyReason: terminationReasonTypeObs ? '' : String(terminationReasonTextObs?.value || ''),
            terminationReasonTypeUuid,
            terminationReasonType: terminationReasonTypeUuid
              ? sharedDecisionActionLabelMap[terminationReasonTypeUuid] || terminationReasonTypeUuid
              : undefined,
            terminationReasonText: terminationReasonTypeObs ? String(terminationReasonTextObs?.value || '') : undefined,
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) => new Date(a!.encounterDatetime).getTime() - new Date(b!.encounterDatetime).getTime(),
        ) as SharedDecisionMakingEntry[])
    : [];
  const memoizedMutate = useCallback(mutate, [mutate]);
  return { entries, error, isLoading, mutate: memoizedMutate };
}

async function getCurrentSession() {
  try {
    const response = await openmrsFetch(`${restBaseUrl}/session`);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Session lookup failures are handled by callers as missing session data.
  }
  return {};
}
