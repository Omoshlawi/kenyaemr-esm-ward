import { LCG_ADMISSION_RISK_FACTOR_CODE } from './constants/admission-form.constants';
import {
  BABY_CONDITION_VALUES,
  DELIVERY_MODE_VALUES,
  UTEROTONIC_GIVEN_VALUES,
} from './constants/summary-of-labour.constants';
import type { SummaryOfLabourBabyFormData, SummaryOfLabourFormData } from './resources/summary-of-labour.resource';
import type { MedicationEntry } from './resources/medication.resource';
import { normalizeLcgConceptKey, resolveBirthActionLabel } from './labour-care-guide.utils';
import { UUID_SHARED_DECISION_TRANSFER_TO_CS, UUID_SHARED_DECISION_TWIN_ONE_BIRTH } from './types';
import { formatHHMM, parseHHMMToMinutes } from './time-slot-utils';

const MINUTES_IN_DAY = 24 * 60;

const createEmptyBaby = (): SummaryOfLabourBabyFormData => ({
  condition: '',
  sex: '',
  birthWeightKg: '',
  birthLengthCm: '',
  headCircumferenceCm: '',
  apgar1Min: '',
  apgar5Min: '',
  apgar10Min: '',
  resuscitationDone: '',
  vitaminKGiven: '',
  teoGivenAtBirth: '',
  birthWithDeformity: '',
  deformityType: '',
  deformityOtherSpecify: '',
  chlorhexidineOnCord: '',
  deliveryMode: '',
  durationOfLabourHours: '',
  deliveryDateTime: '',
  deliveryConductedBy: '',
  placentaComplete: '',
  placentaExpelledDateTime: '',
  placentaWeightG: '',
});

export type SummaryOfLabourPrefillContext = {
  baseTime?: string | null;
  workflowStopLabel?: 'BIRTH' | 'DEAD' | 'TERMINATED' | null;
  workflowStopTime?: string;
  workflowStopEncounterDatetime?: string;
  sharedDecisionEntries: Array<{ action: string; encounterDatetime: string; time?: string }>;
  admissionRiskFactorCodes: string[];
  providerDisplayName?: string;
  medicationEntries?: MedicationEntry[];
  savedDeliverySummary?: SummaryOfLabourFormData | null;
};

export type BabyFieldVisibility = {
  sex: boolean;
  birthWeightKg: boolean;
  birthLengthCm: boolean;
  headCircumferenceCm: boolean;
  apgarScores: boolean;
  birthWithDeformity: boolean;
};

export function getBabyFieldVisibility(babyCondition: string): BabyFieldVisibility {
  switch (babyCondition) {
    case BABY_CONDITION_VALUES.liveBirth:
      return {
        sex: true,
        birthWeightKg: true,
        birthLengthCm: true,
        headCircumferenceCm: true,
        apgarScores: true,
        birthWithDeformity: true,
      };
    case BABY_CONDITION_VALUES.freshStillBirth:
      return {
        sex: true,
        birthWeightKg: true,
        birthLengthCm: false,
        headCircumferenceCm: true,
        apgarScores: false,
        birthWithDeformity: true,
      };
    case BABY_CONDITION_VALUES.maceratedStillBirth:
      return {
        sex: false,
        birthWeightKg: true,
        birthLengthCm: false,
        headCircumferenceCm: false,
        apgarScores: false,
        birthWithDeformity: true,
      };
    default:
      return {
        sex: false,
        birthWeightKg: false,
        birthLengthCm: false,
        headCircumferenceCm: false,
        apgarScores: false,
        birthWithDeformity: false,
      };
  }
}

function wasOxytocinGivenInSession(medicationEntries: MedicationEntry[] = []): boolean {
  return medicationEntries.some((entry) => entry.oxytocin === 'Y');
}

function mergeBabyPrefill(
  baseBaby: SummaryOfLabourBabyFormData,
  savedBaby?: SummaryOfLabourBabyFormData,
): SummaryOfLabourBabyFormData {
  if (!savedBaby) {
    return baseBaby;
  }

  return {
    condition: savedBaby.condition || baseBaby.condition,
    sex: savedBaby.sex || baseBaby.sex,
    birthWeightKg: savedBaby.birthWeightKg !== '' ? savedBaby.birthWeightKg : baseBaby.birthWeightKg,
    birthLengthCm: savedBaby.birthLengthCm !== '' ? savedBaby.birthLengthCm : baseBaby.birthLengthCm,
    headCircumferenceCm:
      savedBaby.headCircumferenceCm !== '' ? savedBaby.headCircumferenceCm : baseBaby.headCircumferenceCm,
    apgar1Min: savedBaby.apgar1Min !== '' ? savedBaby.apgar1Min : baseBaby.apgar1Min,
    apgar5Min: savedBaby.apgar5Min !== '' ? savedBaby.apgar5Min : baseBaby.apgar5Min,
    apgar10Min: savedBaby.apgar10Min !== '' ? savedBaby.apgar10Min : baseBaby.apgar10Min,
    resuscitationDone: savedBaby.resuscitationDone || baseBaby.resuscitationDone,
    vitaminKGiven: savedBaby.vitaminKGiven || baseBaby.vitaminKGiven,
    teoGivenAtBirth: savedBaby.teoGivenAtBirth || baseBaby.teoGivenAtBirth,
    birthWithDeformity: savedBaby.birthWithDeformity || baseBaby.birthWithDeformity,
    deformityType: savedBaby.deformityType || baseBaby.deformityType,
    deformityOtherSpecify: savedBaby.deformityOtherSpecify || baseBaby.deformityOtherSpecify,
    chlorhexidineOnCord: savedBaby.chlorhexidineOnCord || baseBaby.chlorhexidineOnCord,
    deliveryMode: savedBaby.deliveryMode || baseBaby.deliveryMode,
    durationOfLabourHours:
      savedBaby.durationOfLabourHours !== '' ? savedBaby.durationOfLabourHours : baseBaby.durationOfLabourHours,
    deliveryDateTime: savedBaby.deliveryDateTime || baseBaby.deliveryDateTime,
    deliveryConductedBy: savedBaby.deliveryConductedBy || baseBaby.deliveryConductedBy,
    placentaComplete: savedBaby.placentaComplete || baseBaby.placentaComplete,
    placentaExpelledDateTime: savedBaby.placentaExpelledDateTime || baseBaby.placentaExpelledDateTime,
    placentaWeightG: savedBaby.placentaWeightG !== '' ? savedBaby.placentaWeightG : baseBaby.placentaWeightG,
  };
}

function mergeSavedDeliverySummary(
  base: SummaryOfLabourFormData,
  saved: SummaryOfLabourFormData,
): SummaryOfLabourFormData {
  const babyCount = Math.max(base.babies.length, saved.babies.length);

  return {
    deliveryMode: saved.deliveryMode || base.deliveryMode,
    durationOfLabourHours:
      saved.durationOfLabourHours !== '' ? saved.durationOfLabourHours : base.durationOfLabourHours,
    deliveryDateTime: saved.deliveryDateTime || base.deliveryDateTime,
    placentaComplete: saved.placentaComplete || base.placentaComplete,
    placentaExpelledDateTime: saved.placentaExpelledDateTime || base.placentaExpelledDateTime,
    placentaWeightG: saved.placentaWeightG !== '' ? saved.placentaWeightG : base.placentaWeightG,
    bloodLossMl: saved.bloodLossMl !== '' ? saved.bloodLossMl : base.bloodLossMl,
    perineumExamination: saved.perineumExamination || base.perineumExamination,
    repair: saved.repair || base.repair,
    repairDoneBy: saved.repairDoneBy || base.repairDoneBy,
    deliveryConductedBy: saved.deliveryConductedBy || base.deliveryConductedBy,
    cadre: saved.cadre || base.cadre,
    cadreOtherSpecify: saved.cadreOtherSpecify || base.cadreOtherSpecify,
    uterotonicGiven: saved.uterotonicGiven || base.uterotonicGiven,
    uterotonicOtherSpecify: saved.uterotonicOtherSpecify || base.uterotonicOtherSpecify,
    babies: Array.from({ length: babyCount }, (_, index) =>
      mergeBabyPrefill(base.babies[index] ?? createEmptyBaby(), saved.babies[index]),
    ),
  };
}

function hasCaesareanActionInSession(entries: SummaryOfLabourPrefillContext['sharedDecisionEntries']): boolean {
  const csKey = normalizeLcgConceptKey(UUID_SHARED_DECISION_TRANSFER_TO_CS);
  return entries.some((entry) => {
    const normalized = normalizeLcgConceptKey(entry.action);
    return (
      normalized === csKey ||
      normalized.includes('caesarean') ||
      normalized.includes('c-section') ||
      normalized === 'cs' ||
      entry.action === 'Emergency Caesarean section Prescribed'
    );
  });
}

function computeLabourDurationHours(baseTime: string, stopTime: string): number | '' {
  const baseMinutes = parseHHMMToMinutes(baseTime);
  const stopMinutes = parseHHMMToMinutes(stopTime);
  if (baseMinutes === null || stopMinutes === null) {
    return '';
  }

  let elapsedMinutes = stopMinutes - baseMinutes;
  if (elapsedMinutes < 0) {
    elapsedMinutes += MINUTES_IN_DAY;
  }

  return Math.round(elapsedMinutes / 60);
}

function formatDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildDeliveryDateTime(stopEncounterDatetime?: string, stopTime?: string): string {
  if (stopEncounterDatetime) {
    const parsed = new Date(stopEncounterDatetime);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateTimeLocalValue(parsed);
    }
  }

  if (stopTime && /^\d{2}:\d{2}$/.test(stopTime)) {
    const now = new Date();
    const [hours, minutes] = stopTime.split(':').map(Number);
    now.setHours(hours, minutes, 0, 0);
    return formatDateTimeLocalValue(now);
  }

  return formatDateTimeLocalValue(new Date());
}

type BirthEvent = {
  time: string;
  encounterDatetime: string;
};

function resolveBirthEventTime(entry: { encounterDatetime: string; time?: string }): string {
  if (entry.time && /^\d{2}:\d{2}$/.test(entry.time)) {
    return entry.time;
  }

  const parsed = new Date(entry.encounterDatetime);
  return Number.isNaN(parsed.getTime()) ? '' : formatHHMM(parsed);
}

function isTwinOneBirthAction(action: string): boolean {
  const normalized = normalizeLcgConceptKey(action);
  return (
    normalized === normalizeLcgConceptKey(UUID_SHARED_DECISION_TWIN_ONE_BIRTH) || normalized.includes('twin 1 birth')
  );
}

function collectBirthEvents(entries: SummaryOfLabourPrefillContext['sharedDecisionEntries']): BirthEvent[] {
  return [...entries]
    .sort((left, right) => new Date(left.encounterDatetime).getTime() - new Date(right.encounterDatetime).getTime())
    .flatMap((entry) => {
      if (resolveBirthActionLabel(entry.action) !== 'BIRTH') {
        return [];
      }

      const time = resolveBirthEventTime(entry);
      if (!time) {
        return [];
      }

      return [{ time, encounterDatetime: entry.encounterDatetime }];
    });
}

function collectTwinBirthEvents(entries: SummaryOfLabourPrefillContext['sharedDecisionEntries']): {
  twinOne?: BirthEvent;
  twinTwo?: BirthEvent;
} {
  const sortedEntries = [...entries].sort(
    (left, right) => new Date(left.encounterDatetime).getTime() - new Date(right.encounterDatetime).getTime(),
  );

  let twinOne: BirthEvent | undefined;
  let twinTwo: BirthEvent | undefined;

  for (const entry of sortedEntries) {
    const time = resolveBirthEventTime(entry);
    if (!time) {
      continue;
    }

    if (isTwinOneBirthAction(entry.action)) {
      twinOne = { time, encounterDatetime: entry.encounterDatetime };
      continue;
    }

    if (resolveBirthActionLabel(entry.action) === 'BIRTH') {
      twinTwo = { time, encounterDatetime: entry.encounterDatetime };
    }
  }

  return { twinOne, twinTwo };
}

function buildBirthDeliveryDateTime(encounterDatetime?: string, chartTime?: string): string {
  if (encounterDatetime) {
    const parsed = new Date(encounterDatetime);
    if (!Number.isNaN(parsed.getTime())) {
      if (chartTime && /^\d{2}:\d{2}$/.test(chartTime)) {
        const [hours, minutes] = chartTime.split(':').map(Number);
        parsed.setHours(hours, minutes, 0, 0);
      }
      return formatDateTimeLocalValue(parsed);
    }
  }

  if (chartTime && /^\d{2}:\d{2}$/.test(chartTime)) {
    return buildDeliveryDateTime(undefined, chartTime);
  }

  return '';
}

function buildPerBabyDeliveryPrefill(
  birthEvent: BirthEvent | undefined,
  fallbackEncounterDatetime: string | undefined,
  fallbackTime: string | undefined,
  baseTime: string | null | undefined,
  deliveryMode: string,
  deliveryConductedBy: string,
): Pick<
  SummaryOfLabourBabyFormData,
  'deliveryMode' | 'durationOfLabourHours' | 'deliveryDateTime' | 'deliveryConductedBy'
> {
  const birthTime = birthEvent?.time ?? fallbackTime;
  const hasBirthEvent = Boolean(birthEvent);
  const hasFallback = Boolean(fallbackEncounterDatetime || fallbackTime);

  if (!hasBirthEvent && !hasFallback) {
    return {
      deliveryMode,
      durationOfLabourHours: '',
      deliveryDateTime: '',
      deliveryConductedBy,
    };
  }

  const durationOfLabourHours = baseTime && birthTime ? computeLabourDurationHours(baseTime, birthTime) : ('' as const);

  return {
    deliveryMode,
    durationOfLabourHours,
    deliveryDateTime: hasBirthEvent
      ? buildBirthDeliveryDateTime(birthEvent!.encounterDatetime, birthEvent!.time)
      : buildBirthDeliveryDateTime(fallbackEncounterDatetime, fallbackTime),
    deliveryConductedBy,
  };
}

export function buildSummaryOfLabourPrefill(context: SummaryOfLabourPrefillContext): SummaryOfLabourFormData {
  const isTwin = context.admissionRiskFactorCodes.includes(LCG_ADMISSION_RISK_FACTOR_CODE.multipleGestation);
  const isCaesarean = hasCaesareanActionInSession(context.sharedDecisionEntries);
  const isStillbirth = context.workflowStopLabel === 'DEAD';

  const deliveryMode = isCaesarean
    ? DELIVERY_MODE_VALUES.caesareanSection
    : isStillbirth
      ? ''
      : DELIVERY_MODE_VALUES.spontaneousVaginal;

  const babyCondition = isStillbirth ? BABY_CONDITION_VALUES.freshStillBirth : BABY_CONDITION_VALUES.liveBirth;
  const deliveryConductedBy = context.providerDisplayName ?? '';
  const birthEvents = collectBirthEvents(context.sharedDecisionEntries);
  const twinBirthEvents = collectTwinBirthEvents(context.sharedDecisionEntries);
  const singletonBirthEvent = birthEvents[0];

  const singletonDelivery = buildPerBabyDeliveryPrefill(
    singletonBirthEvent,
    context.workflowStopEncounterDatetime,
    context.workflowStopTime,
    context.baseTime,
    deliveryMode,
    deliveryConductedBy,
  );

  const twinOneDelivery = buildPerBabyDeliveryPrefill(
    twinBirthEvents.twinOne,
    undefined,
    undefined,
    context.baseTime,
    deliveryMode,
    deliveryConductedBy,
  );

  const twinTwoDelivery = buildPerBabyDeliveryPrefill(
    twinBirthEvents.twinTwo,
    context.workflowStopEncounterDatetime,
    context.workflowStopTime,
    context.baseTime,
    deliveryMode,
    deliveryConductedBy,
  );

  const perBabyDeliveryFields = {
    placentaComplete: '',
    placentaExpelledDateTime: '',
    placentaWeightG: '' as const,
  };

  const babies: SummaryOfLabourBabyFormData[] = isTwin
    ? [
        { ...createEmptyBaby(), condition: babyCondition, ...perBabyDeliveryFields, ...twinOneDelivery },
        { ...createEmptyBaby(), condition: babyCondition, ...perBabyDeliveryFields, ...twinTwoDelivery },
      ]
    : [{ ...createEmptyBaby(), condition: babyCondition }];

  const uterotonicGiven = wasOxytocinGivenInSession(context.medicationEntries) ? UTEROTONIC_GIVEN_VALUES.oxytocin : '';

  const basePrefill = {
    deliveryMode: isTwin ? '' : singletonDelivery.deliveryMode,
    durationOfLabourHours: isTwin ? ('' as const) : singletonDelivery.durationOfLabourHours,
    deliveryDateTime: isTwin ? '' : singletonDelivery.deliveryDateTime,
    placentaComplete: isTwin ? '' : '',
    placentaExpelledDateTime: isTwin ? '' : '',
    placentaWeightG: isTwin ? ('' as const) : ('' as const),
    bloodLossMl: '',
    perineumExamination: '',
    repair: '',
    repairDoneBy: '',
    deliveryConductedBy: isTwin ? '' : singletonDelivery.deliveryConductedBy,
    cadre: '',
    cadreOtherSpecify: '',
    uterotonicGiven,
    uterotonicOtherSpecify: '',
    babies,
  } satisfies SummaryOfLabourFormData;

  if (context.savedDeliverySummary) {
    return mergeSavedDeliverySummary(basePrefill, context.savedDeliverySummary);
  }

  return basePrefill;
}

export function createEmptySummaryOfLabourForm(isTwin: boolean): SummaryOfLabourFormData {
  return buildSummaryOfLabourPrefill({
    sharedDecisionEntries: [],
    admissionRiskFactorCodes: isTwin ? [LCG_ADMISSION_RISK_FACTOR_CODE.multipleGestation] : [],
  });
}
