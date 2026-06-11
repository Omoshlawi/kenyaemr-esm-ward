import { openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useCallback } from 'react';
import type { TFunction } from 'react-i18next';
import {
  LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
  LCG_EMERGENCY_REASON_CONCEPT_UUID,
  MCH_PARTOGRAPHY_ENCOUNTER_UUID,
  MEDICATION_CODED_VALUES,
  MEDICATION_FORM_CONCEPTS,
  getValidEncounterDatetime,
  PARTOGRAPHY_CONCEPTS,
  ENCOUNTER_ROLE,
} from '../types';

export interface MedicationFormPayload {
  time: string;
  oxytocinUsed: string;
  oxytocinUnitsPerLitre: number | '';
  oxytocinDropsPerMinute: number | '';
  medicine: string;
  drug: string;
  dosage: string;
  route: string;
  ivFluids: string;
  ivFluidType: string;
}

export interface MedicationEntry {
  id: string;
  encounterUuid: string;
  encounterDatetime: string;
  time: string;
  oxytocin: string;
  medicine: string;
  ivFluids: string;
  oxytocinU_L?: number;
  oxytocinDrops?: number;
  drugName?: string;
  dosage?: string;
  route?: string;
  ivFluidType?: string;
  isEmergency?: boolean;
  emergencyReason?: string;
}

type MedicationSaveOptions = {
  emergencyReason?: string;
};

const MEDICATION_CODE_TO_DISPLAY: Record<string, string> = {
  [MEDICATION_CODED_VALUES.YES]: 'Y',
  [MEDICATION_CODED_VALUES.NO]: 'N',
};

function parseTimeValue(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const match = raw.match(/Time:\s*([0-9]{2}:[0-9]{2})/);
  return match ? match[1] : /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : '';
}

function codedDisplay(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const code = typeof raw === 'object' && raw && 'uuid' in (raw as any) ? (raw as any).uuid : String(raw);
  return MEDICATION_CODE_TO_DISPLAY[code] ?? code;
}

const IV_FLUID_TYPE_TO_DISPLAY: Record<string, string> = {
  '80804AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'Normal saline',
  '78617AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': "Ringer's lactate",
};

function ivFluidTypeDisplay(raw: unknown): string {
  if (raw === null || raw === undefined) return '';

  if (typeof raw === 'object') {
    const value = raw as any;
    const code = value.uuid ?? value.value ?? value.code;
    const label = value.display ?? value.name ?? value.value;
    if (typeof code === 'string' && IV_FLUID_TYPE_TO_DISPLAY[code]) {
      return IV_FLUID_TYPE_TO_DISPLAY[code];
    }
    if (typeof label === 'string' && label.trim()) {
      return label.trim();
    }
  }

  const code = String(raw);
  return IV_FLUID_TYPE_TO_DISPLAY[code] ?? code;
}

function parseRouteValue(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  if (raw.startsWith('Route:')) {
    return raw.replace('Route:', '').trim();
  }
  return raw.trim();
}

export async function saveMedicationData(
  patientUuid: string,
  formData: MedicationFormPayload,
  t: TFunction,
  providerUuid?: string,
  locationUuid?: string,
  options?: MedicationSaveOptions,
) {
  try {
    const session = await openmrsFetch(`${restBaseUrl}/session`).then((res) => res.json());
    const finalProviderUuid = providerUuid || session?.currentProvider?.uuid;
    const finalLocationUuid = locationUuid || session?.sessionLocation?.uuid;

    const encounterPayload = {
      patient: patientUuid,
      encounterType: MCH_PARTOGRAPHY_ENCOUNTER_UUID,
      location: finalLocationUuid,
      encounterDatetime: getValidEncounterDatetime(),
      obs: buildMedicationObservations(formData, options),
      encounterProviders: [{ provider: finalProviderUuid, encounterRole: ENCOUNTER_ROLE }],
    };

    const response = await openmrsFetch(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encounterPayload),
    });

    return { success: response.ok, encounter: await response.json() };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}
function buildMedicationObservations(formData: MedicationFormPayload, options?: MedicationSaveOptions) {
  const obsDatetime = toOmrsIsoString(new Date());

  // Use a strictly typed array but cast to 'any' for the push operations
  // to bypass the strict Discriminated Union check if types aren't perfectly aligned
  const observations: Array<any> = [
    {
      concept: MEDICATION_FORM_CONCEPTS.time,
      value: `Time: ${formData.time}`,
      obsDatetime,
    },
    {
      concept: MEDICATION_FORM_CONCEPTS.oxytocinAdministered,
      value: formData.oxytocinUsed === 'yes' ? MEDICATION_CODED_VALUES.YES : MEDICATION_CODED_VALUES.NO,
      obsDatetime,
    },
    {
      concept: MEDICATION_FORM_CONCEPTS.medication,
      value: formData.medicine === 'yes' ? MEDICATION_CODED_VALUES.YES : MEDICATION_CODED_VALUES.NO,
      obsDatetime,
    },
    {
      concept: MEDICATION_FORM_CONCEPTS.ivFluids,
      value: formData.ivFluids === 'yes' ? MEDICATION_CODED_VALUES.YES : MEDICATION_CODED_VALUES.NO,
      obsDatetime,
    },
    ...(formData.ivFluids === 'yes' && formData.ivFluidType
      ? [
          {
            concept: MEDICATION_FORM_CONCEPTS.ivFluidType,
            value: formData.ivFluidType,
            obsDatetime,
          },
        ]
      : []),
  ];

  if (formData.oxytocinUsed === 'yes') {
    const dose = Number(formData.oxytocinUnitsPerLitre);
    const drops = Number(formData.oxytocinDropsPerMinute);

    if (Number.isFinite(dose)) {
      observations.push({
        concept: MEDICATION_FORM_CONCEPTS.oxytocinDose,
        value: dose,
        obsDatetime,
      });
    }

    if (Number.isFinite(drops)) {
      observations.push({
        concept: MEDICATION_FORM_CONCEPTS.oxytocinDropsPerMinute,
        value: drops,
        obsDatetime,
      });
    }
  }

  if (formData.medicine === 'yes') {
    observations.push(
      {
        concept: MEDICATION_FORM_CONCEPTS.medicationName,
        value: formData.drug,
        obsDatetime,
      },
      {
        concept: MEDICATION_FORM_CONCEPTS.dosage,
        value: formData.dosage,
        obsDatetime,
      },
      {
        concept: PARTOGRAPHY_CONCEPTS['event-description'],
        value: `Route: ${formData.route}`,
        obsDatetime,
      },
    );
  }

  if (options?.emergencyReason && options.emergencyReason.trim()) {
    observations.push(
      {
        concept: LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
        value: MEDICATION_CODED_VALUES.YES,
        obsDatetime,
      },
      {
        concept: LCG_EMERGENCY_REASON_CONCEPT_UUID,
        value: options.emergencyReason.trim(),
        obsDatetime,
      },
    );
  }

  return observations;
}

// function buildMedicationObservations(formData: MedicationFormPayload) {
//   const obsDatetime = toOmrsIsoString(new Date());
//   const obs = [
//     { concept: MEDICATION_FORM_CONCEPTS.time, value: `Time: ${formData.time}`, obsDatetime },
//     {
//       concept: MEDICATION_FORM_CONCEPTS.oxytocinAdministered,
//       value: formData.oxytocinUsed === 'yes' ? MEDICATION_CODED_VALUES.YES : MEDICATION_CODED_VALUES.NO,
//       obsDatetime,
//     },
//     {
//       concept: MEDICATION_FORM_CONCEPTS.medication,
//       value: formData.medicine === 'yes' ? MEDICATION_CODED_VALUES.YES : MEDICATION_CODED_VALUES.NO,
//       obsDatetime,
//     },
//     {
//       concept: MEDICATION_FORM_CONCEPTS.ivFluids,
//       value: formData.ivFluids === 'yes' ? MEDICATION_CODED_VALUES.YES : MEDICATION_CODED_VALUES.NO,
//       obsDatetime,
//     },
//   ];

//   if (formData.oxytocinUsed === 'yes') {
//     obs.push(
//       { concept: MEDICATION_FORM_CONCEPTS.oxytocinDose, value: formData.oxytocinUnitsPerLitre, obsDatetime },
//       { concept: MEDICATION_FORM_CONCEPTS.oxytocinDropsPerMinute, value: formData.oxytocinDropsPerMinute, obsDatetime },
//     );
//   }
//   if (formData.medicine === 'yes') {
//     obs.push(
//       { concept: MEDICATION_FORM_CONCEPTS.medicationName, value: formData.drug, obsDatetime },
//       { concept: MEDICATION_FORM_CONCEPTS.dosage, value: formData.dosage, obsDatetime },
//       { concept: MEDICATION_FORM_CONCEPTS.route, value: formData.route, obsDatetime },
//     );
//   }
//   return obs;
// }

export function useMedicationData(patientUuid: string) {
  const encounterRepresentation =
    'custom:(uuid,encounterDatetime,encounterType:(uuid),obs:(uuid,concept:(uuid),value,obsDatetime))';
  const fetcher = (url: string) => openmrsFetch(url).then((res) => res.json());
  const { data, error, mutate } = useSWR(
    patientUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${MCH_PARTOGRAPHY_ENCOUNTER_UUID}&v=${encounterRepresentation}&limit=40&order=desc`
      : null,
    fetcher,
    { revalidateOnFocus: false, revalidateIfStale: false },
  );

  const medicationEntries: MedicationEntry[] = (data?.results || [])
    .map((enc: any) => {
      const obs = enc.obs || [];
      const timeObs = obs.find((o: any) => o.concept?.uuid === MEDICATION_FORM_CONCEPTS.time);
      const oxyObs = obs.find((o: any) => o.concept?.uuid === MEDICATION_FORM_CONCEPTS.oxytocinAdministered);
      const medObs = obs.find((o: any) => o.concept?.uuid === MEDICATION_FORM_CONCEPTS.medication);
      const ivObs = obs.find((o: any) => o.concept?.uuid === MEDICATION_FORM_CONCEPTS.ivFluids);
      const ivFluidTypeObs = obs.find((o: any) => o.concept?.uuid === MEDICATION_FORM_CONCEPTS.ivFluidType);

      if (!oxyObs && !medObs && !ivObs) return null;

      return {
        id: enc.uuid,
        encounterUuid: enc.uuid,
        encounterDatetime: enc.encounterDatetime,
        time: parseTimeValue(timeObs?.value),
        oxytocin: codedDisplay(oxyObs?.value),
        medicine: codedDisplay(medObs?.value),
        ivFluids: codedDisplay(ivObs?.value),
        ivFluidType: ivFluidTypeDisplay(ivFluidTypeObs?.value),
        // Raw data kept for the Table view
        oxytocinU_L: obs.find((o: any) => o.concept?.uuid === MEDICATION_FORM_CONCEPTS.oxytocinDose)?.value,
        oxytocinDrops: obs.find((o: any) => o.concept?.uuid === MEDICATION_FORM_CONCEPTS.oxytocinDropsPerMinute)?.value,
        drugName: obs.find((o: any) => o.concept?.uuid === MEDICATION_FORM_CONCEPTS.medicationName)?.value,
        dosage: obs.find((o: any) => o.concept?.uuid === MEDICATION_FORM_CONCEPTS.dosage)?.value,
        route:
          parseRouteValue(obs.find((o: any) => o.concept?.uuid === MEDICATION_FORM_CONCEPTS.route)?.value) ||
          parseRouteValue(
            obs.find(
              (o: any) => o.concept?.uuid === PARTOGRAPHY_CONCEPTS['event-description'] && typeof o.value === 'string',
            )?.value,
          ),
        isEmergency: ['true', MEDICATION_CODED_VALUES.YES.toLowerCase()].includes(
          String(
            obs.find((o: any) => o.concept?.uuid === LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID)?.value || '',
          ).toLowerCase(),
        ),
        emergencyReason: String(
          obs.find((o: any) => o.concept?.uuid === LCG_EMERGENCY_REASON_CONCEPT_UUID)?.value || '',
        ),
      };
    })
    .filter(Boolean);

  const memoizedMutate = useCallback(mutate, [mutate]);
  return { medicationEntries, error, mutate: memoizedMutate };
}
