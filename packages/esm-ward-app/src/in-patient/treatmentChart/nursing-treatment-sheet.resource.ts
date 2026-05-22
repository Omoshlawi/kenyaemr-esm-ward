import { useMemo } from 'react';
import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type WardConfigObject } from '../../config-schema';
import { CARDEX_META_PREFIX } from './nursing-cardex-plan.resource';
import { t } from 'i18next';

const REP =
  'custom:(uuid,encounterDatetime,form:(uuid),' +
  'encounterProviders:(provider:(person:(display))),' +
  'obs:(uuid,concept:(uuid),value,groupMembers:(uuid,concept:(uuid),value)))';

type RawObs = {
  uuid: string;
  concept: { uuid: string };
  value: unknown;
  groupMembers?: RawObs[];
};

type RawEncounter = {
  uuid: string;
  encounterDatetime?: string;
  form?: { uuid?: string };
  obs?: RawObs[];
  encounterProviders?: Array<{ provider?: { person?: { display?: string } } }>;
};

type EncountersResponse = { results: RawEncounter[] };

export type CardexRow = {
  id: string;
  name: string;
  time: string;
  date: string;
  provider: string;
  dose: string;
  route: string;
  frequency: string;
  volume: string;
  duration: string;
  itemAndAdministrationInstructions: string;
};

export type CardexOrderMeta = {
  orderUuid?: string;
  orderDisplay?: string;
  dose?: number;
  doseUnits?: string;
  route?: string;
  frequency?: string;
  quantity?: number;
  quantityUnits?: string;
  duration?: number;
  durationUnits?: string;
  provider?: string;
};

const toStr = (value: unknown): string => {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object') {
    return (value as Record<string, string>).display ?? '';
  }
  return '';
};

const fmtTime = (raw: string) => {
  if (!raw) {
    return '--';
  }

  const dateTimeMatch = raw.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:[Z+-]\d{2}:?\d{2})?$/,
  );
  let hours = 0;
  let minutes = 0;

  if (dateTimeMatch) {
    hours = parseInt(dateTimeMatch[2], 10);
    minutes = parseInt(dateTimeMatch[3], 10);
  } else {
    const timeOnlyMatch = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (timeOnlyMatch) {
      hours = parseInt(timeOnlyMatch[1], 10);
      minutes = parseInt(timeOnlyMatch[2], 10);
    } else {
      return raw;
    }
  }

  const localized = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(1970, 0, 1, hours, minutes)));

  return localized;
};

const fmtDate = (raw?: string) => {
  if (!raw) {
    return '--';
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    return raw;
  }
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

const parseCardexMeta = (raw: string): CardexOrderMeta | undefined => {
  if (!raw.startsWith(CARDEX_META_PREFIX)) {
    return undefined;
  }
  try {
    return JSON.parse(raw.slice(CARDEX_META_PREFIX.length)) as CardexOrderMeta;
  } catch {
    return undefined;
  }
};

const emptyValue = '--';

const formatDose = (meta?: CardexOrderMeta) => {
  if (!meta) {
    return emptyValue;
  }
  const pieces = [meta.dose, meta.doseUnits].map((v) => (v ?? '').toString().trim()).filter(Boolean);
  return pieces.length ? pieces.join(' ') : emptyValue;
};

const formatVolume = (meta?: CardexOrderMeta) => {
  if (!meta) {
    return emptyValue;
  }
  const pieces = [meta.quantity, meta.quantityUnits].map((v) => (v ?? '').toString().trim()).filter(Boolean);
  return pieces.length ? pieces.join(' ') : emptyValue;
};

const formatDuration = (meta?: CardexOrderMeta) => {
  if (!meta) {
    return emptyValue;
  }
  const pieces = [meta.duration, meta.durationUnits].map((v) => (v ?? '').toString().trim()).filter(Boolean);
  return pieces.length ? pieces.join(' ') : emptyValue;
};

const hasCardexGroupObs = (enc: RawEncounter, medicationGroupUuid: string, fluidGroupUuid: string) =>
  (enc.obs ?? []).some((obs) => obs?.concept?.uuid === medicationGroupUuid || obs?.concept?.uuid === fluidGroupUuid);

const getEncounterSortTime = (enc: RawEncounter, treatmentChartTimeConceptUuid: string) => {
  const groupTimes = (enc.obs ?? [])
    .flatMap((obs) => obs.groupMembers ?? [])
    .filter((member) => member?.concept?.uuid === treatmentChartTimeConceptUuid)
    .map((member) => toStr(member.value).replace(' ', 'T'));

  const candidate = enc.encounterDatetime || groupTimes[0] || '';
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const extractRows = (
  encounters: RawEncounter[],
  groupConcept: string,
  treatmentChartNameConceptUuid: string,
  treatmentChartTimeConceptUuid: string,
): CardexRow[] =>
  encounters.flatMap((enc) => {
    const provider = enc.encounterProviders?.[0]?.provider?.person?.display ?? '--';
    return (enc.obs ?? [])
      .filter(
        (obs) => obs?.concept?.uuid === groupConcept && Array.isArray(obs.groupMembers) && obs.groupMembers.length > 0,
      )
      .map((group) => {
        const nameMember = group.groupMembers!.find(
          (m) => m?.concept?.uuid === treatmentChartNameConceptUuid && !toStr(m.value).startsWith(CARDEX_META_PREFIX),
        );
        const metaMember = group.groupMembers!.find(
          (m) => m?.concept?.uuid === treatmentChartNameConceptUuid && toStr(m.value).startsWith(CARDEX_META_PREFIX),
        );
        const metadata = parseCardexMeta(toStr(metaMember?.value));
        const timeMember = group.groupMembers!.find((m) => m?.concept?.uuid === treatmentChartTimeConceptUuid);
        const rawTime = toStr(timeMember?.value);
        return {
          id: group.uuid,
          name: toStr(nameMember?.value) || '--',
          time: fmtTime(rawTime),
          date: fmtDate(enc.encounterDatetime || rawTime),
          provider: metadata?.provider || provider,
          dose: formatDose(metadata),
          route: metadata?.route || '--',
          frequency: metadata?.frequency || '--',
          volume: formatVolume(metadata),
          duration: formatDuration(metadata),
          itemAndAdministrationInstructions: emptyValue,
        };
      });
  });

export function useNursingTreatmentSheet(patientUuid: string) {
  const {
    treatmentChartCardexEncounterTypeUuid,
    treatmentChartCardexFormUuid,
    treatmentChartMedicationGroupUuid,
    treatmentChartFluidGroupUuid,
    treatmentChartNameConceptUuid,
    treatmentChartTimeConceptUuid,
  } = useConfig<WardConfigObject>();

  const encounterTypeQuery = treatmentChartCardexEncounterTypeUuid
    ? `&encounterType=${treatmentChartCardexEncounterTypeUuid}`
    : '';

  const url = patientUuid
    ? `${restBaseUrl}/encounter?patient=${patientUuid}${encounterTypeQuery}&v=${encodeURIComponent(
        REP,
      )}&limit=100&order=desc`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FetchResponse<EncountersResponse>>(url, openmrsFetch, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });

  const encounters = useMemo(() => {
    const all = data?.data?.results ?? [];

    return all
      .filter((enc) => {
        if (enc.form?.uuid) {
          return enc.form.uuid === treatmentChartCardexFormUuid;
        }
        return hasCardexGroupObs(enc, treatmentChartMedicationGroupUuid, treatmentChartFluidGroupUuid);
      })
      .sort(
        (left, right) =>
          getEncounterSortTime(right, treatmentChartTimeConceptUuid) -
          getEncounterSortTime(left, treatmentChartTimeConceptUuid),
      );
  }, [
    data,
    treatmentChartCardexFormUuid,
    treatmentChartMedicationGroupUuid,
    treatmentChartFluidGroupUuid,
    treatmentChartTimeConceptUuid,
  ]);
  const medicationRows = useMemo(
    () =>
      extractRows(
        encounters,
        treatmentChartMedicationGroupUuid,
        treatmentChartNameConceptUuid,
        treatmentChartTimeConceptUuid,
      ),
    [encounters, treatmentChartMedicationGroupUuid, treatmentChartNameConceptUuid, treatmentChartTimeConceptUuid],
  );
  const fluidAndNutritionRows = useMemo(
    () =>
      extractRows(
        encounters,
        treatmentChartFluidGroupUuid,
        treatmentChartNameConceptUuid,
        treatmentChartTimeConceptUuid,
      ),
    [encounters, treatmentChartFluidGroupUuid, treatmentChartNameConceptUuid, treatmentChartTimeConceptUuid],
  );

  return {
    medicationRows,
    fluidAndNutritionRows,
    encounters,
    isLoading,
    error: error
      ? { message: t('failedToLoadNursingTreatmentSheet', 'Failed to load nursing treatment sheet') }
      : undefined,
    mutate,
  };
}
