import { openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useCallback } from 'react';
import type { TFunction } from 'react-i18next';
import {
  ENCOUNTER_ROLE,
  BABY_CODED_VALUES,
  BABY_FORM_CONCEPTS,
  LCG_BABY_TWIN_INDEX_CONCEPT_UUID,
  LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
  LCG_EMERGENCY_REASON_CONCEPT_UUID,
  MCH_PARTOGRAPHY_ENCOUNTER_UUID,
} from '../types';
import type { BabyEntry } from '../graphs/baby.component';

export interface SaveBabyResponse {
  success: boolean;
  message: string;
  encounter?: any;
  error?: string;
}

export interface BabyFormPayload {
  time: string;
  baselineFhr: string;
  fhrDeceleration: string;
  amnioticFluid: string;
  fetalPosition: string;
  caput: string;
  moulding: string;
}

const CODED_YES = '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

type BabySaveOptions = {
  emergencyReason?: string;
  twinIndex?: number;
};

const BABY_DISPLAY_VALUES: Record<string, string> = {
  [BABY_CODED_VALUES.FHR_DECELERATION.LATE]: 'L',
  [BABY_CODED_VALUES.FHR_DECELERATION.EARLY]: 'E',
  [BABY_CODED_VALUES.FHR_DECELERATION.VARIABLE]: 'V',
  [BABY_CODED_VALUES.FHR_DECELERATION.NO]: 'N',
  [BABY_CODED_VALUES.AMNIOTIC_FLUID.INTACT]: 'I',
  [BABY_CODED_VALUES.AMNIOTIC_FLUID.CLEAR]: 'C',
  [BABY_CODED_VALUES.AMNIOTIC_FLUID.BLOOD]: 'B',
  [BABY_CODED_VALUES.AMNIOTIC_FLUID.MECONIUM_PLACEHOLDER]: 'M',
  [BABY_CODED_VALUES.FETAL_POSITION.ANTERIOR]: 'A',
  [BABY_CODED_VALUES.FETAL_POSITION.POSTERIOR]: 'P',
  [BABY_CODED_VALUES.FETAL_POSITION.TRANSVERSE]: 'T',
  [BABY_CODED_VALUES.DEGREE.NONE]: '0',
  [BABY_CODED_VALUES.DEGREE.ONE_PLUS]: '+',
  [BABY_CODED_VALUES.DEGREE.TWO_PLUS]: '++',
  [BABY_CODED_VALUES.DEGREE.THREE_PLUS]: '+++',
};

function parseTimeMetadata(raw: unknown): { time: string; twinIndex: number } {
  if (typeof raw !== 'string') {
    return { time: '', twinIndex: 1 };
  }

  const match = raw.match(/Time:\s*([0-9]{2}:[0-9]{2})(?:\s*\|\s*Twin:\s*(\d+))?/i);
  if (match) {
    const twinIndex = Number.parseInt(match[2] ?? '1', 10);
    return {
      time: match[1],
      twinIndex: Number.isFinite(twinIndex) && twinIndex > 0 ? twinIndex : 1,
    };
  }

  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
    return { time: raw, twinIndex: 1 };
  }

  return { time: '', twinIndex: 1 };
}

function parseTwinIndexValue(raw: unknown): number {
  if (raw === null || raw === undefined) {
    return 1;
  }

  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  }

  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  if (typeof raw === 'object' && raw && 'uuid' in (raw as Record<string, unknown>)) {
    const maybeUuid = String((raw as { uuid?: string }).uuid ?? '').trim();
    const parsed = Number.parseInt(maybeUuid, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  return 1;
}

function codedDisplay(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return '';
  }

  const code =
    typeof raw === 'object' && raw && 'uuid' in (raw as Record<string, unknown>)
      ? String((raw as { uuid?: string }).uuid ?? '')
      : String(raw);

  return BABY_DISPLAY_VALUES[code] ?? code;
}

export function useBabyData(patientUuid: string, enabled = true) {
  const encounterRepresentation =
    'custom:(uuid,encounterDatetime,encounterType:(uuid),obs:(uuid,concept:(uuid),value,obsDatetime))';
  const fetcher = (url: string) => openmrsFetch(url).then((res) => res.json());
  const { data, error, isLoading, mutate } = useSWR(
    patientUuid && enabled
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${MCH_PARTOGRAPHY_ENCOUNTER_UUID}&v=${encounterRepresentation}&limit=40&order=desc`
      : null,
    fetcher,
    { revalidateOnFocus: false, revalidateIfStale: false },
  );

  const babyEntries: BabyEntry[] = Array.isArray(data?.results)
    ? (data.results
        .map((encounter) => {
          const observations = Array.isArray(encounter.obs) ? encounter.obs : [];
          const baselineFhrObs = observations.find((obs) => obs.concept?.uuid === BABY_FORM_CONCEPTS.baselineFhr);
          const fhrDecelerationObs = observations.find(
            (obs) => obs.concept?.uuid === BABY_FORM_CONCEPTS.fhrDeceleration,
          );
          const amnioticFluidObs = observations.find((obs) => obs.concept?.uuid === BABY_FORM_CONCEPTS.amnioticFluid);
          const fetalPositionObs = observations.find((obs) => obs.concept?.uuid === BABY_FORM_CONCEPTS.fetalPosition);
          const caputObs = observations.find((obs) => obs.concept?.uuid === BABY_FORM_CONCEPTS.caput);
          const mouldingObs = observations.find((obs) => obs.concept?.uuid === BABY_FORM_CONCEPTS.moulding);
          const timeObs = observations.find((obs) => obs.concept?.uuid === BABY_FORM_CONCEPTS.time);
          const twinIndexObs = observations.find((obs) => obs.concept?.uuid === LCG_BABY_TWIN_INDEX_CONCEPT_UUID);
          const parsedTimeMetadata = parseTimeMetadata(timeObs?.value);
          const observedTwinIndex = twinIndexObs ? parseTwinIndexValue(twinIndexObs.value) : undefined;

          if (
            !baselineFhrObs &&
            !fhrDecelerationObs &&
            !amnioticFluidObs &&
            !fetalPositionObs &&
            !caputObs &&
            !mouldingObs
          ) {
            return null;
          }

          return {
            id: `baby-${encounter.uuid}`,
            encounterDatetime: encounter.encounterDatetime,
            time: parsedTimeMetadata.time,
            twinIndex: observedTwinIndex ?? parsedTimeMetadata.twinIndex,
            baselineFhr:
              baselineFhrObs?.value !== undefined && baselineFhrObs?.value !== null ? String(baselineFhrObs.value) : '',
            fhrDeceleration: codedDisplay(fhrDecelerationObs?.value),
            amnioticFluid: codedDisplay(amnioticFluidObs?.value),
            fetalPosition: codedDisplay(fetalPositionObs?.value),
            caput: codedDisplay(caputObs?.value),
            moulding: codedDisplay(mouldingObs?.value),
            isEmergency: ['true', CODED_YES.toLowerCase()].includes(
              String(
                observations.find((obs) => obs.concept?.uuid === LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID)?.value || '',
              ).toLowerCase(),
            ),
            emergencyReason: String(
              observations.find((obs) => obs.concept?.uuid === LCG_EMERGENCY_REASON_CONCEPT_UUID)?.value || '',
            ),
          } satisfies BabyEntry;
        })
        .filter(Boolean)
        .sort(
          (a, b) => new Date(a!.encounterDatetime).getTime() - new Date(b!.encounterDatetime).getTime(),
        ) as BabyEntry[])
    : [];

  const memoizedMutate = useCallback(mutate, [mutate]);

  return {
    babyEntries,
    error,
    isLoading,
    mutate: memoizedMutate,
  };
}

export async function saveBabyData(
  patientUuid: string,
  formData: BabyFormPayload,
  t: TFunction,
  locationUuid?: string,
  providerUuid?: string,
  options?: BabySaveOptions,
): Promise<SaveBabyResponse> {
  try {
    if (!formData.time?.trim()) {
      return {
        success: false,
        message: t('Time is required'),
        error: 'INVALID_FIELDS',
      };
    }

    const hasAnyObservation = Boolean(
      formData.baselineFhr?.trim() ||
      formData.fhrDeceleration ||
      formData.amnioticFluid ||
      formData.fetalPosition ||
      formData.caput ||
      formData.moulding,
    );

    if (!hasAnyObservation) {
      return {
        success: false,
        message: t('At least one baby observation is required'),
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

    const encounterPayload = {
      patient: patientUuid,
      encounterType: MCH_PARTOGRAPHY_ENCOUNTER_UUID,
      location: finalLocationUuid,
      encounterDatetime: toOmrsIsoString(new Date(Date.now() - 3 * 60 * 1000)),
      obs: buildBabyObservations(formData, options),
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
      let errorMessage = t(`Failed to save baby data: ${response.status} ${response.statusText}`);
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = t(`Failed to save baby data: ${errorData.error.message}`);
        }
      } catch {
        // Keep default error message.
      }
      return { success: false, message: errorMessage, error: 'SAVE_FAILED' };
    }

    return {
      success: true,
      message: t('Baby data saved successfully'),
      encounter: await response.json(),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : t('failedToSaveBabyData', 'Failed to save baby data'),
      error: 'EXCEPTION',
    };
  }
}

function buildBabyObservations(formData: BabyFormPayload, options?: BabySaveOptions) {
  const obsDatetime = toOmrsIsoString(new Date());
  const twinIndex = Number.isFinite(options?.twinIndex) && (options?.twinIndex as number) > 0 ? options!.twinIndex! : 1;

  const fhrDecelerationMap = {
    L: BABY_CODED_VALUES.FHR_DECELERATION.LATE,
    E: BABY_CODED_VALUES.FHR_DECELERATION.EARLY,
    V: BABY_CODED_VALUES.FHR_DECELERATION.VARIABLE,
    N: BABY_CODED_VALUES.FHR_DECELERATION.NO,
    [BABY_CODED_VALUES.FHR_DECELERATION.NO]: BABY_CODED_VALUES.FHR_DECELERATION.NO,
  } as const;

  const amnioticFluidMap = {
    I: BABY_CODED_VALUES.AMNIOTIC_FLUID.INTACT,
    C: BABY_CODED_VALUES.AMNIOTIC_FLUID.CLEAR,
    B: BABY_CODED_VALUES.AMNIOTIC_FLUID.BLOOD,
    M: BABY_CODED_VALUES.AMNIOTIC_FLUID.MECONIUM_PLACEHOLDER,
    'M+': BABY_CODED_VALUES.AMNIOTIC_FLUID.MECONIUM_PLACEHOLDER,
    'M++': BABY_CODED_VALUES.AMNIOTIC_FLUID.MECONIUM_PLACEHOLDER,
    'M+++': BABY_CODED_VALUES.AMNIOTIC_FLUID.MECONIUM_PLACEHOLDER,
  } as const;

  const fetalPositionMap = {
    A: BABY_CODED_VALUES.FETAL_POSITION.ANTERIOR,
    P: BABY_CODED_VALUES.FETAL_POSITION.POSTERIOR,
    T: BABY_CODED_VALUES.FETAL_POSITION.TRANSVERSE,
  } as const;

  const degreeMap = {
    '0': BABY_CODED_VALUES.DEGREE.NONE,
    '+': BABY_CODED_VALUES.DEGREE.ONE_PLUS,
    '++': BABY_CODED_VALUES.DEGREE.TWO_PLUS,
    '+++': BABY_CODED_VALUES.DEGREE.THREE_PLUS,
  } as const;

  const observations = [
    {
      concept: BABY_FORM_CONCEPTS.time,
      value: formData.time.startsWith('Time:') ? formData.time : `Time: ${formData.time}`,
      obsDatetime,
    },
    formData.baselineFhr?.trim()
      ? {
          concept: BABY_FORM_CONCEPTS.baselineFhr,
          value: parseFloat(formData.baselineFhr),
          obsDatetime,
        }
      : null,
    formData.fhrDeceleration
      ? {
          concept: BABY_FORM_CONCEPTS.fhrDeceleration,
          value:
            fhrDecelerationMap[formData.fhrDeceleration as keyof typeof fhrDecelerationMap] ?? formData.fhrDeceleration,
          obsDatetime,
        }
      : null,
    formData.amnioticFluid
      ? {
          concept: BABY_FORM_CONCEPTS.amnioticFluid,
          value: amnioticFluidMap[formData.amnioticFluid as keyof typeof amnioticFluidMap] ?? formData.amnioticFluid,
          obsDatetime,
        }
      : null,
    formData.fetalPosition
      ? {
          concept: BABY_FORM_CONCEPTS.fetalPosition,
          value: fetalPositionMap[formData.fetalPosition as keyof typeof fetalPositionMap] ?? formData.fetalPosition,
          obsDatetime,
        }
      : null,
    formData.caput
      ? {
          concept: BABY_FORM_CONCEPTS.caput,
          value: degreeMap[formData.caput as keyof typeof degreeMap] ?? formData.caput,
          obsDatetime,
        }
      : null,
    formData.moulding
      ? {
          concept: BABY_FORM_CONCEPTS.moulding,
          value: degreeMap[formData.moulding as keyof typeof degreeMap] ?? formData.moulding,
          obsDatetime,
        }
      : null,
  ].filter(Boolean);

  if (LCG_BABY_TWIN_INDEX_CONCEPT_UUID) {
    observations.push({
      concept: LCG_BABY_TWIN_INDEX_CONCEPT_UUID,
      value: twinIndex,
      obsDatetime,
    } as any);
  }

  if (options?.emergencyReason && options.emergencyReason.trim()) {
    observations.push(
      {
        concept: LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
        value: CODED_YES,
        obsDatetime,
      } as any,
      {
        concept: LCG_EMERGENCY_REASON_CONCEPT_UUID,
        value: options.emergencyReason.trim(),
        obsDatetime,
      } as any,
    );
  }

  return observations;
}

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
