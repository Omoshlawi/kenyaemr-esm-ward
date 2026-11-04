import { openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';
import type { TFunction } from 'react-i18next';
import {
  LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
  LCG_EMERGENCY_REASON_CONCEPT_UUID,
  LCG_WRITE_ENCOUNTER_TYPE_UUID,
  PARTOGRAPHY_CONCEPTS,
  URGE_TO_PUSH_UUID,
  URINE_TEST_TIME_SLOT_CONCEPT,
  ENCOUNTER_ROLE,
  CONTRACTION_COUNT_CONCEPT,
  UTERINE_CONTRACTION_DURATION_CONCEPT,
} from '../types';
import { validateStageAwareGridSlotSubmission } from '../time-slot-utils';

export interface LabourProgressFormPayload {
  time: string;
  contractionsPer10Mins: string;
  durationOfContractions: string;
  cervicalDilation: number | '';
  descentOfHead: number | '';
  urgeToPush?: '' | 'yes' | 'no';
}

export interface SaveLabourProgressResponse {
  success: boolean;
  message: string;
  encounter?: any;
  error?: string;
}

type LabourProgressSaveOptions = {
  emergencyReason?: string;
  lcgValidation?: {
    baseTime: string;
    firstStageSlotCount: number;
    secondStageSlotCount?: number;
    secondStageStartTime?: string;
  };
};

export async function saveLabourProgressData(
  patientUuid: string,
  formData: LabourProgressFormPayload,
  t: TFunction,
  providerUuid?: string,
  locationUuid?: string,
  options?: LabourProgressSaveOptions,
): Promise<SaveLabourProgressResponse> {
  try {
    if (!formData.time?.trim()) {
      return {
        success: false,
        message: t('Time is required'),
        error: 'INVALID_FIELDS',
      };
    }

    const hasAnyObservation = Boolean(
      formData.contractionsPer10Mins ||
      formData.durationOfContractions ||
      formData.cervicalDilation !== '' ||
      formData.descentOfHead !== '' ||
      formData.urgeToPush,
    );

    if (!hasAnyObservation) {
      return {
        success: false,
        message: t('At least one labour progress observation is required'),
        error: 'INVALID_FIELDS',
      };
    }

    const session = await getCurrentSession();
    const finalProviderUuid = providerUuid || session?.currentProvider?.uuid;
    const finalLocationUuid = locationUuid || session?.sessionLocation?.uuid;

    if (!finalProviderUuid) {
      return { success: false, message: t('Provider information is required'), error: 'NO_PROVIDER' };
    }
    if (!finalLocationUuid) {
      return { success: false, message: t('Location information is required'), error: 'NO_LOCATION' };
    }

    if (!options?.emergencyReason && options?.lcgValidation) {
      const { baseTime, firstStageSlotCount, secondStageSlotCount = 0, secondStageStartTime } = options.lcgValidation;
      const validation = validateStageAwareGridSlotSubmission(
        baseTime,
        formData.time.trim(),
        new Date(),
        firstStageSlotCount,
        secondStageSlotCount,
        secondStageStartTime,
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

    const eventTimestamp = toOmrsIsoString(new Date(Date.now() - 3 * 60 * 1000));

    const encounterPayload = {
      patient: patientUuid,
      encounterType: LCG_WRITE_ENCOUNTER_TYPE_UUID,
      location: finalLocationUuid,
      encounterDatetime: eventTimestamp,
      obs: buildLabourProgressObservations(formData, eventTimestamp, options),
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
      let errorMessage = t(`Failed to save labour progress data: ${response.status} ${response.statusText}`);
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = t(`Failed to save labour progress data: ${errorData.error.message}`);
        }
      } catch {
        // Keep default error message.
      }
      return { success: false, message: errorMessage, error: 'SAVE_FAILED' };
    }

    return {
      success: true,
      message: t('Labour progress data saved successfully'),
      encounter: await response.json(),
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : t('failedToSaveLabourProgressData', 'Failed to save labour progress data'),
      error: 'EXCEPTION',
    };
  }
}

function buildLabourProgressObservations(
  formData: LabourProgressFormPayload,
  obsDatetime: string,
  options?: LabourProgressSaveOptions,
) {
  return [
    formData.contractionsPer10Mins
      ? {
          concept: CONTRACTION_COUNT_CONCEPT,
          value: parseInt(formData.contractionsPer10Mins, 10),
          obsDatetime,
        }
      : null,
    formData.durationOfContractions
      ? {
          concept: UTERINE_CONTRACTION_DURATION_CONCEPT,
          value: parseInt(formData.durationOfContractions, 10),
          obsDatetime,
        }
      : null,
    formData.cervicalDilation !== ''
      ? {
          concept: PARTOGRAPHY_CONCEPTS['cervical-dilation'],
          value: Number(formData.cervicalDilation),
          obsDatetime,
        }
      : null,
    formData.descentOfHead !== ''
      ? {
          concept: PARTOGRAPHY_CONCEPTS['descent-of-head'],
          value: Number(formData.descentOfHead),
          obsDatetime,
        }
      : null,
    formData.urgeToPush
      ? {
          concept: URGE_TO_PUSH_UUID,
          value:
            formData.urgeToPush === 'yes'
              ? '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
              : '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          obsDatetime,
        }
      : null,
    {
      concept: URINE_TEST_TIME_SLOT_CONCEPT,
      value: formData.time.startsWith('Time:') ? formData.time : `Time: ${formData.time}`,
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
  ].filter(Boolean);
}

const CODED_YES = '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
async function getCurrentSession() {
  try {
    const response = await openmrsFetch(`${restBaseUrl}/session`);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Swallow error.
  }
  return null;
}
