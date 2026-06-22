import { openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useCallback } from 'react';
import { ENCOUNTER_ROLE, MCH_PARTOGRAPHY_ENCOUNTER_UUID, PARTOGRAPHY_CONCEPTS } from '../types';
import type { TFunction } from 'react-i18next';
import type { AdmissionDetailsFormData } from '../forms/admission-details-form.component';
import { LCG_ADMISSION_RISK_FACTOR_CODE, LCG_LABOUR_ONSET_CODE } from '../constants/admission-form.constants';

export interface AdmissionDetailsEncounter {
  uuid: string;
  encounterDatetime: string;
  obs: {
    uuid: string;
    concept: { uuid: string; display: string };
    value: string | number | { uuid: string; display: string };
    obsDatetime: string;
  }[];
  encounterType: { uuid: string; display: string };
  patient: { uuid: string };
}

export interface SaveAdmissionDetailsResponse {
  success: boolean;
  message: string;
  encounter?: AdmissionDetailsEncounter;
  error?: string;
}

// Concept UUIDs
const CONCEPT_UUIDS = {
  // Labour Onset
  LABOUR_ONSET: '06ec2bce-b06c-45cc-9e89-c3a02c1a2259',
  SPONTANEOUS_LABOUR: '4be6e9e0-d32f-46b9-bfed-2af5bda39e67',
  INDUCTION: '151750AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  PRE_LABOUR_CSECTION: '159739AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',

  // Active Labour Diagnosis - Datatype: Date (use this instead of datetime)
  ACTIVE_LABOUR_DIAGNOSIS: '68bfa3f3-1fc7-4d9d-bb41-e897c3c430ef',

  // Ruptured Membranes
  RUPTURED_MEMBRANES: '41327ff7-7dbe-4d6f-9611-c3bfbb93ebdd',
  RUPTURED_MEMBRANES_YES: '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  RUPTURED_MEMBRANES_NO: '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  RUPTURED_MEMBRANES_UNKNOWN: '1067AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  INTACT_MEMBRANES: '164899AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',

  // Date and Time
  DATE_PICKER: '4f5e46a7-29ec-4a9a-b547-ab6f4b448f07', // Datatype: Text
  TIME_PICKER: 'bb3724c9-fbcc-49c5-9702-6cde0be325ca',

  // Risk Factors
  RISK_FACTOR: '165430AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CHRONIC_HYPERTENSION: '52032502-677f-4caa-a1cd-08fa6ce788e2',
  PRE_ECLAMPSIA: '129251AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  WOMANS_ADVANCED_AGE: '155005AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ADOLESCENT_PREGNANCY: '155006AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  PRETERM_LABOUR: 'cfe9efc5-ac87-40dd-ae24-98dd91f73583',
  MULTIPLE_GESTATION: '115491AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  COLONIZATION: '112703AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  NONE: '1107AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  OTHER: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  OTHER_SPECIFY: '163761AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

async function getCurrentSession() {
  try {
    const response = await openmrsFetch(`${restBaseUrl}/session`);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // swallow
  }
  return null;
}

export async function saveAdmissionDetails(
  patientUuid: string,
  formData: AdmissionDetailsFormData,
  t: TFunction,
): Promise<SaveAdmissionDetailsResponse> {
  try {
    const session = await getCurrentSession();
    const providerUuid = session?.currentProvider?.uuid;
    const locationUuid = session?.sessionLocation?.uuid;

    if (!providerUuid) {
      return { success: false, message: t('noProvider', 'Provider information is required'), error: 'NO_PROVIDER' };
    }
    if (!locationUuid) {
      return { success: false, message: t('noLocation', 'Location information is required'), error: 'NO_LOCATION' };
    }

    const obsDatetime = toOmrsIsoString(new Date());
    const observations: any[] = [];

    // Labour Onset - coded value
    if (formData.labourOnset) {
      let labourOnsetValue = '';
      if (formData.labourOnset === LCG_LABOUR_ONSET_CODE.spontaneous) {
        labourOnsetValue = CONCEPT_UUIDS.SPONTANEOUS_LABOUR;
      } else if (formData.labourOnset === LCG_LABOUR_ONSET_CODE.induction) {
        labourOnsetValue = CONCEPT_UUIDS.INDUCTION;
      } else if (formData.labourOnset === LCG_LABOUR_ONSET_CODE.preLabourCsection) {
        labourOnsetValue = CONCEPT_UUIDS.PRE_LABOUR_CSECTION;
      }

      if (labourOnsetValue) {
        observations.push({
          concept: CONCEPT_UUIDS.LABOUR_ONSET,
          value: labourOnsetValue,
          obsDatetime,
        });
      }
    }

    // Active Labour Diagnosis - Date concept (send as simple YYYY-MM-DD)
    if (formData.activeLabourDiagnosisDate) {
      observations.push({
        concept: CONCEPT_UUIDS.ACTIVE_LABOUR_DIAGNOSIS,
        value: formData.activeLabourDiagnosisDate, // Just "2026-04-30"
        obsDatetime,
      });
    }

    // Ruptured Membranes - coded value
    if (formData.rupturedMembranes) {
      let rupturedMembranesValue = '';
      if (formData.rupturedMembranes === 'yes') {
        rupturedMembranesValue = CONCEPT_UUIDS.RUPTURED_MEMBRANES_YES;
      } else if (formData.rupturedMembranes === 'no') {
        rupturedMembranesValue = CONCEPT_UUIDS.RUPTURED_MEMBRANES_NO;
      } else if (formData.rupturedMembranes === 'unknown') {
        rupturedMembranesValue = CONCEPT_UUIDS.RUPTURED_MEMBRANES_UNKNOWN;
      } else if (formData.rupturedMembranes === 'intact') {
        rupturedMembranesValue = CONCEPT_UUIDS.INTACT_MEMBRANES;
      }

      if (rupturedMembranesValue) {
        observations.push({
          concept: CONCEPT_UUIDS.RUPTURED_MEMBRANES,
          value: rupturedMembranesValue,
          obsDatetime,
        });
      }
    }

    // Ruptured Membranes Date and Time (if yes)
    if (formData.rupturedMembranes === 'yes') {
      if (formData.rupturedMembranesDate) {
        observations.push({
          concept: CONCEPT_UUIDS.DATE_PICKER,
          value: formData.rupturedMembranesDate,
          obsDatetime,
        });
      }
      if (formData.rupturedMembranesTime) {
        observations.push({
          concept: CONCEPT_UUIDS.TIME_PICKER,
          value: formData.rupturedMembranesTime,
          obsDatetime,
        });
      }
    }

    // Risk Factors - coded values
    if (formData.riskFactors && formData.riskFactors.length > 0) {
      if (formData.riskFactors.includes(LCG_ADMISSION_RISK_FACTOR_CODE.none)) {
        observations.push({
          concept: CONCEPT_UUIDS.RISK_FACTOR,
          value: CONCEPT_UUIDS.NONE,
          obsDatetime,
        });
      } else {
        for (const riskFactor of formData.riskFactors) {
          let riskFactorValue = '';
          switch (riskFactor) {
            case LCG_ADMISSION_RISK_FACTOR_CODE.chronicHypertension:
              riskFactorValue = CONCEPT_UUIDS.CHRONIC_HYPERTENSION;
              break;
            case LCG_ADMISSION_RISK_FACTOR_CODE.preEclampsia:
              riskFactorValue = CONCEPT_UUIDS.PRE_ECLAMPSIA;
              break;
            case LCG_ADMISSION_RISK_FACTOR_CODE.advancedAge:
              riskFactorValue = CONCEPT_UUIDS.WOMANS_ADVANCED_AGE;
              break;
            case LCG_ADMISSION_RISK_FACTOR_CODE.adolescentPregnancy:
              riskFactorValue = CONCEPT_UUIDS.ADOLESCENT_PREGNANCY;
              break;
            case LCG_ADMISSION_RISK_FACTOR_CODE.pretermLabour:
              riskFactorValue = CONCEPT_UUIDS.PRETERM_LABOUR;
              break;
            case LCG_ADMISSION_RISK_FACTOR_CODE.multipleGestation:
              riskFactorValue = CONCEPT_UUIDS.MULTIPLE_GESTATION;
              break;
            case LCG_ADMISSION_RISK_FACTOR_CODE.colonization:
              riskFactorValue = CONCEPT_UUIDS.COLONIZATION;
              break;
            case LCG_ADMISSION_RISK_FACTOR_CODE.other:
              riskFactorValue = CONCEPT_UUIDS.OTHER;
              break;
            default:
              continue;
          }

          if (riskFactorValue) {
            observations.push({
              concept: CONCEPT_UUIDS.RISK_FACTOR,
              value: riskFactorValue,
              obsDatetime,
            });

            if (riskFactor === LCG_ADMISSION_RISK_FACTOR_CODE.other && formData.riskFactorOtherText?.trim()) {
              observations.push({
                concept: CONCEPT_UUIDS.OTHER_SPECIFY,
                value: formData.riskFactorOtherText.trim(),
                obsDatetime,
              });
            }
          }
        }
      }
    }

    if (observations.length === 0) {
      return {
        success: false,
        message: t('noObservations', 'No observations to save'),
        error: 'NO_OBSERVATIONS',
      };
    }

    const now = new Date();
    now.setMinutes(now.getMinutes() - 3);

    const encounterPayload = {
      patient: patientUuid,
      encounterType: MCH_PARTOGRAPHY_ENCOUNTER_UUID,
      location: locationUuid,
      encounterDatetime: toOmrsIsoString(now),
      obs: observations,
      encounterProviders: [
        {
          provider: providerUuid,
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
      let errorMessage = t('saveAdmissionFailed', 'Failed to save admission details: {{status}} {{statusText}}', {
        status: response.status,
        statusText: response.statusText,
      });
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = t('saveAdmissionError', 'Failed to save admission details: {{message}}', {
            message: errorData.error.message,
          });
        }
      } catch {
        // ignore JSON parse errors
      }
      return { success: false, message: errorMessage, error: 'SAVE_FAILED' };
    }

    const encounter = await response.json();
    return { success: true, message: t('admissionDetailsSaved', 'Admission details saved successfully'), encounter };
  } catch (error) {
    return {
      success: false,
      message: t('saveAdmissionException', 'Failed to save admission details: {{message}}', {
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      error: 'EXCEPTION',
    };
  }
}

export function useAdmissionDetails(patientUuid: string) {
  const encounterRepresentation =
    'custom:(uuid,encounterDatetime,encounterType:(uuid,display),' +
    'obs:(uuid,concept:(uuid,display),value,obsDatetime),' +
    'patient:(uuid))';
  const url = patientUuid
    ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${MCH_PARTOGRAPHY_ENCOUNTER_UUID}&v=${encounterRepresentation}&limit=40&order=desc`
    : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { results: AdmissionDetailsEncounter[] } }>(
    url,
    openmrsFetch,
    { revalidateOnFocus: false, revalidateIfStale: false },
  );

  const allEncounters: AdmissionDetailsEncounter[] = data?.data?.results ?? [];

  const admissionEncounters = allEncounters.filter((encounter) =>
    encounter.obs?.some(
      (obs) =>
        obs.concept?.uuid === CONCEPT_UUIDS.LABOUR_ONSET ||
        obs.concept?.uuid === CONCEPT_UUIDS.RUPTURED_MEMBRANES ||
        obs.concept?.uuid === CONCEPT_UUIDS.RISK_FACTOR,
    ),
  );

  const latestEncounter = admissionEncounters.length > 0 ? admissionEncounters[0] : null;

  let admissionData: AdmissionDetailsFormData | null = null;

  if (latestEncounter) {
    const obs = latestEncounter.obs ?? [];

    // Labour Onset
    const labourOnsetObs = obs.find((o) => o.concept?.uuid === CONCEPT_UUIDS.LABOUR_ONSET);
    let labourOnset = '';
    if (labourOnsetObs && labourOnsetObs.value) {
      const valueStr =
        typeof labourOnsetObs.value === 'string' ? labourOnsetObs.value : (labourOnsetObs.value as any).uuid || '';

      if (valueStr === CONCEPT_UUIDS.SPONTANEOUS_LABOUR) {
        labourOnset = LCG_LABOUR_ONSET_CODE.spontaneous;
      } else if (valueStr === CONCEPT_UUIDS.INDUCTION) {
        labourOnset = LCG_LABOUR_ONSET_CODE.induction;
      } else if (valueStr === CONCEPT_UUIDS.PRE_LABOUR_CSECTION) {
        labourOnset = LCG_LABOUR_ONSET_CODE.preLabourCsection;
      }
    }

    // Active Labour Diagnosis Date
    const activeLabourDiagnosisObs = obs.find((o) => o.concept?.uuid === CONCEPT_UUIDS.ACTIVE_LABOUR_DIAGNOSIS);
    const activeLabourDiagnosisDate =
      activeLabourDiagnosisObs && typeof activeLabourDiagnosisObs.value === 'string'
        ? activeLabourDiagnosisObs.value
        : '';

    // Ruptured Membranes
    const rupturedMembranesObs = obs.find((o) => o.concept?.uuid === CONCEPT_UUIDS.RUPTURED_MEMBRANES);
    let rupturedMembranes = '';
    if (rupturedMembranesObs && rupturedMembranesObs.value) {
      const valueStr =
        typeof rupturedMembranesObs.value === 'string'
          ? rupturedMembranesObs.value
          : (rupturedMembranesObs.value as any).uuid || '';

      if (valueStr === CONCEPT_UUIDS.RUPTURED_MEMBRANES_YES) {
        rupturedMembranes = 'yes';
      } else if (valueStr === CONCEPT_UUIDS.RUPTURED_MEMBRANES_NO) {
        rupturedMembranes = 'no';
      } else if (valueStr === CONCEPT_UUIDS.RUPTURED_MEMBRANES_UNKNOWN) {
        rupturedMembranes = 'unknown';
      } else if (valueStr === CONCEPT_UUIDS.INTACT_MEMBRANES) {
        rupturedMembranes = 'intact';
      }
    }

    // Ruptured Membranes Date and Time
    const ruptureDateObs = obs.find((o) => o.concept?.uuid === CONCEPT_UUIDS.DATE_PICKER);
    const ruptureTimeObs = obs.find((o) => o.concept?.uuid === CONCEPT_UUIDS.TIME_PICKER);

    const rupturedMembranesDate =
      ruptureDateObs && typeof ruptureDateObs.value === 'string' ? ruptureDateObs.value : '';

    const rupturedMembranesTime =
      ruptureTimeObs && typeof ruptureTimeObs.value === 'string' ? ruptureTimeObs.value : '';

    // Risk Factors
    const riskFactorObs = obs.filter((o) => o.concept?.uuid === CONCEPT_UUIDS.RISK_FACTOR);
    const riskFactors: string[] = [];
    let riskFactorOtherText = '';

    const otherSpecifyObs = obs.find((o) => o.concept?.uuid === CONCEPT_UUIDS.OTHER_SPECIFY);
    if (otherSpecifyObs && typeof otherSpecifyObs.value === 'string') {
      riskFactorOtherText = otherSpecifyObs.value;
    }

    for (const riskObs of riskFactorObs) {
      if (riskObs.value) {
        const valueStr = typeof riskObs.value === 'string' ? riskObs.value : (riskObs.value as any).uuid || '';

        if (valueStr === CONCEPT_UUIDS.NONE) {
          riskFactors.push(LCG_ADMISSION_RISK_FACTOR_CODE.none);
          break;
        } else if (valueStr === CONCEPT_UUIDS.CHRONIC_HYPERTENSION) {
          riskFactors.push(LCG_ADMISSION_RISK_FACTOR_CODE.chronicHypertension);
        } else if (valueStr === CONCEPT_UUIDS.PRE_ECLAMPSIA) {
          riskFactors.push(LCG_ADMISSION_RISK_FACTOR_CODE.preEclampsia);
        } else if (valueStr === CONCEPT_UUIDS.WOMANS_ADVANCED_AGE) {
          riskFactors.push(LCG_ADMISSION_RISK_FACTOR_CODE.advancedAge);
        } else if (valueStr === CONCEPT_UUIDS.ADOLESCENT_PREGNANCY) {
          riskFactors.push(LCG_ADMISSION_RISK_FACTOR_CODE.adolescentPregnancy);
        } else if (valueStr === CONCEPT_UUIDS.PRETERM_LABOUR) {
          riskFactors.push(LCG_ADMISSION_RISK_FACTOR_CODE.pretermLabour);
        } else if (valueStr === CONCEPT_UUIDS.MULTIPLE_GESTATION) {
          riskFactors.push(LCG_ADMISSION_RISK_FACTOR_CODE.multipleGestation);
        } else if (valueStr === CONCEPT_UUIDS.COLONIZATION) {
          riskFactors.push(LCG_ADMISSION_RISK_FACTOR_CODE.colonization);
        } else if (valueStr === CONCEPT_UUIDS.OTHER) {
          riskFactors.push(LCG_ADMISSION_RISK_FACTOR_CODE.other);
        }
      }
    }

    admissionData = {
      labourOnset,
      activeLabourDiagnosisDate,
      rupturedMembranes,
      rupturedMembranesDate,
      rupturedMembranesTime,
      riskFactors,
      riskFactorOtherText,
    };
  }

  const memoizedMutate = useCallback(mutate, [mutate]);

  return {
    admissionData,
    isLoading,
    error,
    mutate: memoizedMutate,
  };
}
