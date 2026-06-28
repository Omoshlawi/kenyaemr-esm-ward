import { openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useCallback } from 'react';
import type { TFunction } from 'react-i18next';
import { ENCOUNTER_ROLE } from '../types';
import {
  DELIVERY_FORM_ENCOUNTER_TYPE_UUID,
  SUMMARY_OF_LABOUR_CONCEPTS,
} from '../constants/summary-of-labour.constants';

export type SummaryOfLabourBabyFormData = {
  condition: string;
  sex: string;
  birthWeightKg: number | '';
  birthLengthCm: number | '';
  headCircumferenceCm: number | '';
  apgar1Min: number | '';
  apgar5Min: number | '';
  apgar10Min: number | '';
  resuscitationDone: string;
  vitaminKGiven: string;
  teoGivenAtBirth: string;
  birthWithDeformity: string;
  deformityType: string;
  deformityOtherSpecify: string;
  chlorhexidineOnCord: string;
  deliveryMode: string;
  durationOfLabourHours: number | '';
  deliveryDateTime: string;
  deliveryConductedBy: string;
  placentaComplete: string;
  placentaExpelledDateTime: string;
  placentaWeightG: number | '';
};

export type SummaryOfLabourFormData = {
  deliveryMode: string;
  durationOfLabourHours: number | '';
  deliveryDateTime: string;
  placentaComplete: string;
  placentaExpelledDateTime: string;
  placentaWeightG: number | '';
  bloodLossMl: number | '';
  perineumExamination: string;
  repair: string;
  repairDoneBy: string;
  deliveryConductedBy: string;
  cadre: string;
  cadreOtherSpecify: string;
  uterotonicGiven: string;
  uterotonicOtherSpecify: string;
  babies: SummaryOfLabourBabyFormData[];
};

export type SummaryOfLabourEntry = SummaryOfLabourFormData & {
  id: string;
  encounterUuid: string;
  encounterDatetime: string;
};

type DeliveryEncounter = {
  uuid: string;
  encounterDatetime: string;
  voided?: boolean;
  obs?: Array<{
    concept?: { uuid?: string };
    value?: unknown;
  }>;
};

function toOpenmrsObsDateTimeString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function parseFormDateTime(value: string): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatObsDateTimeForForm(savedValue: string): string {
  const parsed = parseFormDateTime(savedValue);
  if (!parsed) {
    return savedValue ?? '';
  }

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function formatObsDateTimeForSave(formValue: string): string {
  const parsed = parseFormDateTime(formValue);
  if (!parsed) {
    return '';
  }

  return toOpenmrsObsDateTimeString(parsed);
}

export function getMaxDatetimeLocalValue(referenceDate = new Date()): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${referenceDate.getFullYear()}-${pad(referenceDate.getMonth() + 1)}-${pad(referenceDate.getDate())}T${pad(referenceDate.getHours())}:${pad(referenceDate.getMinutes())}`;
}

export function isFutureDateTimeLocalValue(value: string, referenceDate = new Date()): boolean {
  const parsed = parseFormDateTime(value);
  if (!parsed) {
    return false;
  }

  return parsed.getTime() > referenceDate.getTime();
}

function readObsUuid(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return '';
  }
  if (typeof raw === 'object' && raw && 'uuid' in (raw as object)) {
    return String((raw as { uuid?: string }).uuid ?? '');
  }
  return String(raw).trim();
}

function readObsText(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return '';
  }
  if (typeof raw === 'number') {
    return String(raw);
  }
  if (typeof raw === 'object' && raw && 'display' in (raw as object)) {
    return String((raw as { display?: string }).display ?? readObsUuid(raw));
  }
  return String(raw).trim();
}

function readObsNumber(raw: unknown): number | '' {
  const text = readObsText(raw);
  if (!text) {
    return '';
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : '';
}

function normalizeIntegerObsValue(value: string | number | '' | undefined): number | '' {
  if (value === '' || value === undefined || value === null) {
    return '';
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : '';
}

function pushObs(
  observations: Array<{ concept: string; value: string | number; obsDatetime: string }>,
  concept: string,
  value: string | number | '' | undefined,
  obsDatetime: string,
) {
  if (value === '' || value === undefined || value === null) {
    return;
  }
  observations.push({ concept, value, obsDatetime });
}

function pushIntegerObs(
  observations: Array<{ concept: string; value: string | number; obsDatetime: string }>,
  concept: string,
  value: string | number | '' | undefined,
  obsDatetime: string,
) {
  const normalized = normalizeIntegerObsValue(value);
  if (normalized === '') {
    return;
  }
  observations.push({ concept, value: normalized, obsDatetime });
}

function buildBabyObservations(
  baby: SummaryOfLabourBabyFormData,
  observations: Array<{ concept: string; value: string | number; obsDatetime: string }>,
  obsDatetime: string,
  includeDeliveryAndPlacenta: boolean,
) {
  if (includeDeliveryAndPlacenta) {
    pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.deliveryMode, baby.deliveryMode, obsDatetime);
    pushIntegerObs(
      observations,
      SUMMARY_OF_LABOUR_CONCEPTS.durationOfLabourHours,
      baby.durationOfLabourHours,
      obsDatetime,
    );
    pushObs(
      observations,
      SUMMARY_OF_LABOUR_CONCEPTS.deliveryDateTime,
      formatObsDateTimeForSave(baby.deliveryDateTime),
      obsDatetime,
    );
    // deliveryConductedBy shares concept 1473 with repairDoneBy; UI-only until a distinct concept is configured.
    pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.placentaComplete, baby.placentaComplete, obsDatetime);
    pushObs(
      observations,
      SUMMARY_OF_LABOUR_CONCEPTS.placentaExpelledDateTime,
      formatObsDateTimeForSave(baby.placentaExpelledDateTime),
      obsDatetime,
    );
    pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.placentaWeightG, baby.placentaWeightG, obsDatetime);
  }

  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.babyCondition, baby.condition, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.sex, baby.sex, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.birthWeightKg, baby.birthWeightKg, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.birthLengthCm, baby.birthLengthCm, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.headCircumferenceCm, baby.headCircumferenceCm, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.apgar1Min, baby.apgar1Min, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.apgar5Min, baby.apgar5Min, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.apgar10Min, baby.apgar10Min, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.resuscitationDone, baby.resuscitationDone, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.vitaminKGiven, baby.vitaminKGiven, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.teoGivenAtBirth, baby.teoGivenAtBirth, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.birthWithDeformity, baby.birthWithDeformity, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.deformityType, baby.deformityType, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.deformityOtherSpecify, baby.deformityOtherSpecify, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.chlorhexidineOnCord, baby.chlorhexidineOnCord, obsDatetime);
}

function parseBabyFromObs(obs: DeliveryEncounter['obs'], index: number, isTwin: boolean): SummaryOfLabourBabyFormData {
  const readAtIndex = (conceptUuid: string) => {
    const matches = (obs ?? []).filter((item) => item.concept?.uuid === conceptUuid);
    return matches[index]?.value;
  };

  const deliveryDateTimeRaw = readObsText(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.deliveryDateTime));
  const placentaExpelledRaw = readObsText(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.placentaExpelledDateTime));

  return {
    deliveryMode: isTwin ? readObsUuid(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.deliveryMode)) : '',
    durationOfLabourHours: isTwin ? readObsNumber(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.durationOfLabourHours)) : '',
    deliveryDateTime: isTwin ? formatObsDateTimeForForm(deliveryDateTimeRaw) : '',
    deliveryConductedBy: '',
    placentaComplete: isTwin ? readObsUuid(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.placentaComplete)) : '',
    placentaExpelledDateTime: isTwin ? formatObsDateTimeForForm(placentaExpelledRaw) : '',
    placentaWeightG: isTwin ? readObsNumber(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.placentaWeightG)) : '',
    condition: readObsUuid(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.babyCondition)),
    sex: readObsUuid(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.sex)),
    birthWeightKg: readObsNumber(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.birthWeightKg)),
    birthLengthCm: readObsNumber(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.birthLengthCm)),
    headCircumferenceCm: readObsNumber(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.headCircumferenceCm)),
    apgar1Min: readObsNumber(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.apgar1Min)),
    apgar5Min: readObsNumber(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.apgar5Min)),
    apgar10Min: readObsNumber(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.apgar10Min)),
    resuscitationDone: readObsUuid(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.resuscitationDone)),
    vitaminKGiven: readObsUuid(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.vitaminKGiven)),
    teoGivenAtBirth: readObsUuid(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.teoGivenAtBirth)),
    birthWithDeformity: readObsUuid(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.birthWithDeformity)),
    deformityType: readObsUuid(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.deformityType)),
    deformityOtherSpecify: readObsText(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.deformityOtherSpecify)),
    chlorhexidineOnCord: readObsUuid(readAtIndex(SUMMARY_OF_LABOUR_CONCEPTS.chlorhexidineOnCord)),
  };
}

function parseSummaryFromEncounter(encounter: DeliveryEncounter): SummaryOfLabourEntry | null {
  const obs = encounter.obs ?? [];
  const readSingle = (conceptUuid: string) => obs.find((item) => item.concept?.uuid === conceptUuid)?.value;

  const sexCount = obs.filter((item) => item.concept?.uuid === SUMMARY_OF_LABOUR_CONCEPTS.sex).length;
  const babyCount = Math.max(1, sexCount || 1);
  const isTwin = babyCount > 1;
  const babies = Array.from({ length: babyCount }, (_, index) => parseBabyFromObs(obs, index, isTwin));

  const deliveryDateTimeRaw = readObsText(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.deliveryDateTime));
  const placentaExpelledRaw = readObsText(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.placentaExpelledDateTime));

  return {
    id: encounter.uuid,
    encounterUuid: encounter.uuid,
    encounterDatetime: encounter.encounterDatetime,
    deliveryMode: isTwin ? '' : readObsUuid(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.deliveryMode)),
    durationOfLabourHours: isTwin ? '' : readObsNumber(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.durationOfLabourHours)),
    deliveryDateTime: isTwin ? '' : formatObsDateTimeForForm(deliveryDateTimeRaw),
    placentaComplete: isTwin ? '' : readObsUuid(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.placentaComplete)),
    placentaExpelledDateTime: isTwin ? '' : formatObsDateTimeForForm(placentaExpelledRaw),
    placentaWeightG: isTwin ? '' : readObsNumber(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.placentaWeightG)),
    bloodLossMl: readObsNumber(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.bloodLossMl)),
    perineumExamination: readObsUuid(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.perineumExamination)),
    repair: readObsUuid(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.repair)),
    repairDoneBy: readObsText(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.repairDoneBy)),
    deliveryConductedBy: '',
    cadre: readObsUuid(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.cadre)),
    cadreOtherSpecify: readObsText(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.cadreOtherSpecify)),
    uterotonicGiven: readObsUuid(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.uterotonicGiven)),
    uterotonicOtherSpecify: readObsText(readSingle(SUMMARY_OF_LABOUR_CONCEPTS.uterotonicOtherSpecify)),
    babies,
  };
}

function buildSummaryObservations(formData: SummaryOfLabourFormData) {
  const obsDatetime = toOmrsIsoString(new Date());
  const observations: Array<{ concept: string; value: string | number; obsDatetime: string }> = [];
  const isTwin = formData.babies.length > 1;

  if (!isTwin) {
    pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.deliveryMode, formData.deliveryMode, obsDatetime);
    pushIntegerObs(
      observations,
      SUMMARY_OF_LABOUR_CONCEPTS.durationOfLabourHours,
      formData.durationOfLabourHours,
      obsDatetime,
    );
    pushObs(
      observations,
      SUMMARY_OF_LABOUR_CONCEPTS.deliveryDateTime,
      formatObsDateTimeForSave(formData.deliveryDateTime),
      obsDatetime,
    );
    pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.placentaComplete, formData.placentaComplete, obsDatetime);
    pushObs(
      observations,
      SUMMARY_OF_LABOUR_CONCEPTS.placentaExpelledDateTime,
      formatObsDateTimeForSave(formData.placentaExpelledDateTime),
      obsDatetime,
    );
    pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.placentaWeightG, formData.placentaWeightG, obsDatetime);
  }

  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.bloodLossMl, formData.bloodLossMl, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.perineumExamination, formData.perineumExamination, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.repair, formData.repair, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.repairDoneBy, formData.repairDoneBy, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.cadre, formData.cadre, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.cadreOtherSpecify, formData.cadreOtherSpecify, obsDatetime);
  pushObs(observations, SUMMARY_OF_LABOUR_CONCEPTS.uterotonicGiven, formData.uterotonicGiven, obsDatetime);
  pushObs(
    observations,
    SUMMARY_OF_LABOUR_CONCEPTS.uterotonicOtherSpecify,
    formData.uterotonicOtherSpecify,
    obsDatetime,
  );

  formData.babies.forEach((baby) => buildBabyObservations(baby, observations, obsDatetime, isTwin));

  return observations;
}

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

export async function saveSummaryOfLabour(
  patientUuid: string,
  formData: SummaryOfLabourFormData,
  t: TFunction,
): Promise<{ success: boolean; message: string; encounter?: DeliveryEncounter; error?: string }> {
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

    const encounterPayload = {
      patient: patientUuid,
      encounterType: DELIVERY_FORM_ENCOUNTER_TYPE_UUID,
      location: locationUuid,
      encounterDatetime: getValidEncounterDatetime(formData),
      obs: buildSummaryObservations(formData),
      encounterProviders: [{ provider: providerUuid, encounterRole: ENCOUNTER_ROLE }],
    };

    const response = await openmrsFetch(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: encounterPayload,
    });

    if (!response.ok) {
      return {
        success: false,
        message: t('saveError', 'Failed to save data'),
        error: 'SAVE_FAILED',
      };
    }

    const encounter = (await response.json()) as DeliveryEncounter;
    return {
      success: true,
      message: t('summaryOfLabourSaved', 'Summary of labour saved successfully'),
      encounter,
    };
  } catch {
    return { success: false, message: t('saveError', 'Failed to save data'), error: 'EXCEPTION' };
  }
}

function getValidEncounterDatetime(formData: SummaryOfLabourFormData): string {
  const dateTimeCandidates =
    formData.babies.length > 1 ? formData.babies.map((baby) => baby.deliveryDateTime) : [formData.deliveryDateTime];

  for (const candidate of dateTimeCandidates) {
    const parsed = parseFormDateTime(candidate);
    if (parsed) {
      return toOmrsIsoString(parsed);
    }
  }

  return toOmrsIsoString(new Date());
}

export function useSummaryOfLabourData(patientUuid: string, sessionStartMs?: number | null) {
  const url = patientUuid
    ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${DELIVERY_FORM_ENCOUNTER_TYPE_UUID}&v=full&order=desc&limit=20`
    : null;

  const { data, error, isLoading, mutate } = useSWR(url, (requestUrl: string) =>
    openmrsFetch(requestUrl).then((response) => response.json()),
  );

  const encounters: DeliveryEncounter[] = data?.results ?? [];
  const filteredEncounters = encounters.filter((encounter) => {
    if (encounter.voided) {
      return false;
    }
    if (!sessionStartMs) {
      return true;
    }
    const encounterMs = new Date(encounter.encounterDatetime).getTime();
    return Number.isFinite(encounterMs) && encounterMs >= sessionStartMs;
  });

  const summaryEntry = filteredEncounters.length ? parseSummaryFromEncounter(filteredEncounters[0]) : null;

  const memoizedMutate = useCallback(() => mutate(), [mutate]);

  return {
    summaryEntry,
    isLoading,
    error,
    mutate: memoizedMutate,
    summaryFilled: Boolean(summaryEntry),
  };
}

export function formatSummaryCodedLabel(value: string, options: Array<{ value: string; label: string }>): string {
  if (!value) {
    return '';
  }
  return options.find((option) => option.value === value)?.label ?? value;
}
