import {
  TRANSFUSION_FLAG_RULES,
  TRANSFUSION_INPUT_LIMITS,
  TRANSFUSION_NO_REACTION,
  TRANSFUSION_OBSERVATION_ROWS,
  type TransfusionObservationRowDef,
} from '../config/blood-transfusion.defaults';
import {
  type BloodTransfusion,
  type BloodTransfusionStore,
  type TransfusionObservation,
  type TransfusionRequiredField,
} from '../types/blood-transfusion.types';
/** Minutes after the due time before a missing reading counts as overdue. */
export const TRANSFUSION_OVERDUE_GRACE_MINUTES = 10;

export const emptyTransfusionStore = (): BloodTransfusionStore => ({ transfusions: [] });

export function upsertTransfusion(store: BloodTransfusionStore, transfusion: BloodTransfusion): BloodTransfusionStore {
  const others = store.transfusions.filter((item) => item.id !== transfusion.id);
  return { ...store, transfusions: [...others, transfusion] };
}

export function sortTransfusions(transfusions: BloodTransfusion[]): BloodTransfusion[] {
  return [...transfusions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** T-YYMMDD-NN, numbered per patient per day. */
export function nextTransfusionNumber(store: BloodTransfusionStore, date: string): string {
  const prefix = `T-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-`;
  const used = store.transfusions
    .map((item) => item.number)
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.slice(prefix.length)))
    .filter(Number.isFinite);
  return `${prefix}${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0')}`;
}

/** Days up to 28, months up to 2 years, then years. */
export function ageLabel(birthDate: string | undefined, now: Date): string | undefined {
  if (!birthDate) {
    return undefined;
  }
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return undefined;
  }
  const days = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(birth.getFullYear(), birth.getMonth(), birth.getDate())) /
      86_400_000,
  );
  if (days < 0) {
    return undefined;
  }
  if (days <= 28) {
    return days === 1 ? '1 day' : `${days} days`;
  }
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 24) {
    return months <= 1 ? '1 mo' : `${months} mo`;
  }
  return `${Math.floor(months / 12)} yrs`;
}

function addMinutes(time: string | undefined, minutes: number): string | undefined {
  const match = time?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const total = (((Number(match[1]) * 60 + Number(match[2]) + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** When a row's reading is due, from the start time (or the end time for the 4-hours-after row). */
export function observationDueTime(
  row: TransfusionObservationRowDef,
  timeStarted: string | undefined,
  endedTime: string | undefined,
): string | undefined {
  if (row.anchor === 'before') {
    return undefined;
  }
  return addMinutes(row.anchor === 'end' ? endedTime : timeStarted, row.offsetMinutes ?? 0);
}

/**
 * Earliest clock time allowed for `rowId`: the latest Exact Time already set on any
 * earlier observation row. Later slots cannot go backwards in the chart.
 */
export function previousObservationMinTime(
  rowId: string,
  observations: BloodTransfusion['observations'],
): string | undefined {
  let minTime: string | undefined;
  for (const row of TRANSFUSION_OBSERVATION_ROWS) {
    if (row.id === rowId) {
      return minTime;
    }
    const time = observations[row.id]?.time;
    if (time?.includes(':') && (!minTime || time > minTime)) {
      minTime = time;
    }
  }
  return minTime;
}

export type ObservationFlags = { temperature?: string; pulse?: string };

export function observationFlags(
  baseline: TransfusionObservation | undefined,
  reading: TransfusionObservation | undefined,
  isBaseline = false,
): ObservationFlags {
  const flags: ObservationFlags = {};
  const temperature = reading?.temperature;
  if (temperature !== undefined) {
    if (temperature >= TRANSFUSION_FLAG_RULES.feverC) {
      flags.temperature = 'fever';
    } else if (
      !isBaseline &&
      baseline?.temperature !== undefined &&
      temperature - baseline.temperature >= TRANSFUSION_FLAG_RULES.temperatureRiseC
    ) {
      flags.temperature = 'rise';
    }
  }
  const pulse = reading?.pulse;
  if (
    !isBaseline &&
    pulse !== undefined &&
    baseline?.pulse !== undefined &&
    pulse - baseline.pulse >= TRANSFUSION_FLAG_RULES.pulseRiseBpm
  ) {
    flags.pulse = 'rise';
  }
  return flags;
}

/** Any reaction other than "None" ticked. */
export function hasTransfusionReaction(reactions: string[]): boolean {
  return reactions.some((id) => id !== TRANSFUSION_NO_REACTION);
}

/** "None" excludes every other reaction and vice versa. */
export function toggleTransfusionReaction(reactions: string[], id: string, checked: boolean): string[] {
  if (!checked) {
    return reactions.filter((item) => item !== id);
  }
  if (id === TRANSFUSION_NO_REACTION) {
    return [TRANSFUSION_NO_REACTION];
  }
  return [...reactions.filter((item) => item !== TRANSFUSION_NO_REACTION && item !== id), id];
}

export function hasAbnormalObservation(transfusion: BloodTransfusion): boolean {
  const baseline = transfusion.observations.before;
  return Object.entries(transfusion.observations).some(([id, reading]) => {
    const flags = observationFlags(baseline, reading, id === 'before');
    return Boolean(flags.temperature || flags.pulse);
  });
}

export type TransfusionVitalField = 'temperature' | 'pulse' | 'respiratoryRate' | 'systolic' | 'diastolic';

export const TRANSFUSION_VITAL_FIELDS: TransfusionVitalField[] = [
  'temperature',
  'pulse',
  'respiratoryRate',
  'systolic',
  'diastolic',
];

/** True when a vital is filled in but outside the range OpenMRS accepts. */
export function isVitalOutOfRange(field: TransfusionVitalField, value: number | undefined): boolean {
  if (value === undefined || Number.isNaN(value)) {
    return false;
  }
  const { min, max } = TRANSFUSION_INPUT_LIMITS[field];
  return value < min || value > max;
}

export function outOfRangeVitals(reading: TransfusionObservation | undefined): TransfusionVitalField[] {
  return TRANSFUSION_VITAL_FIELDS.filter((field) => isVitalOutOfRange(field, reading?.[field]));
}

/** Observation rows holding a vital OpenMRS would reject. */
export function rowsWithOutOfRangeVitals(transfusion: BloodTransfusion): string[] {
  return Object.entries(transfusion.observations)
    .filter(([, reading]) => outOfRangeVitals(reading).length > 0)
    .map(([rowId]) => rowId);
}

const blank = (value: unknown) => value === undefined || value === null || String(value).trim() === '';

/** Fields that must be filled before a transfusion record can be submitted. */
export function missingForSubmit(transfusion: BloodTransfusion): TransfusionRequiredField[] {
  const missing: TransfusionRequiredField[] = [];
  const required: Array<[TransfusionRequiredField, unknown]> = [
    ['transfusionDate', transfusion.transfusionDate],
    ['transfusionTime', transfusion.transfusionTime],
    ['donorNumber', transfusion.donorNumber],
    ['startedBy', transfusion.startedBy],
    ['counterCheckedBy', transfusion.counterCheckedBy],
    ['timeStarted', transfusion.timeStarted],
    ['baselineTemperature', transfusion.observations.before?.temperature],
    ['baselinePulse', transfusion.observations.before?.pulse],
    ['endedDate', transfusion.endedDate],
    ['endedTime', transfusion.endedTime],
    ['amountMl', transfusion.amountMl],
  ];
  for (const [field, value] of required) {
    if (blank(value)) {
      missing.push(field);
    }
  }
  if (!transfusion.bloodTypes.length) {
    missing.push('bloodTypes');
  }
  if (transfusion.bloodTypes.includes('others') && blank(transfusion.otherType)) {
    missing.push('otherType');
  }
  return missing;
}

/** The end must not be before the start of the transfusion. */
export function isEndBeforeStart(transfusion: BloodTransfusion): boolean {
  const { transfusionDate, timeStarted, endedDate, endedTime } = transfusion;
  if (!transfusionDate || !timeStarted || !endedDate || !endedTime) {
    return false;
  }
  return `${endedDate}T${endedTime}` < `${transfusionDate}T${timeStarted}`;
}

/** The start can't be later than the facility clock (`nowLocal` is `YYYY-MM-DDTHH:MM`). */
export function isStartInFuture(transfusion: BloodTransfusion, nowLocal: string): boolean {
  const { transfusionDate, timeStarted } = transfusion;
  if (!transfusionDate || !timeStarted) {
    return false;
  }
  return `${transfusionDate}T${timeStarted}` > nowLocal;
}

/** `YYYY-MM-DDTHH:MM` local (facility) timestamp shifted by whole minutes. */
export function addMinutesToLocal(date: string | undefined, time: string | undefined, minutes: number) {
  const d = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = time?.match(/^(\d{1,2}):(\d{2})$/);
  if (!d || !t) {
    return undefined;
  }
  const ms = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]) + minutes);
  return new Date(ms).toISOString().slice(0, 16);
}

/** Full local due timestamp for a row, so overdue checks work across midnight. */
export function observationDueAt(row: TransfusionObservationRowDef, transfusion: BloodTransfusion) {
  if (row.anchor === 'before') {
    return undefined;
  }
  return row.anchor === 'end'
    ? addMinutesToLocal(transfusion.endedDate, transfusion.endedTime, row.offsetMinutes ?? 0)
    : addMinutesToLocal(transfusion.transfusionDate, transfusion.timeStarted, row.offsetMinutes ?? 0);
}

export function isObservationRecorded(reading: TransfusionObservation | undefined): boolean {
  return (
    reading?.temperature !== undefined ||
    reading?.pulse !== undefined ||
    reading?.respiratoryRate !== undefined ||
    reading?.systolic !== undefined ||
    reading?.diastolic !== undefined
  );
}

export type ObservationRowState = 'recorded' | 'overdue' | 'due' | 'upcoming' | 'notApplicable';

/**
 * Rows after the transfusion ended (other than the 4-hours-after check) are not needed.
 * `nowLocal` is the facility clock as `YYYY-MM-DDTHH:MM`.
 */
export function observationRowState(
  row: TransfusionObservationRowDef,
  transfusion: BloodTransfusion,
  nowLocal: string,
): ObservationRowState {
  if (isObservationRecorded(transfusion.observations[row.id])) {
    return 'recorded';
  }
  if (row.anchor === 'before') {
    return transfusion.timeStarted ? 'overdue' : 'due';
  }
  const dueAt = observationDueAt(row, transfusion);
  const endedAt = addMinutesToLocal(transfusion.endedDate, transfusion.endedTime, 0);
  if (row.anchor === 'start' && dueAt && endedAt && dueAt > endedAt) {
    return 'notApplicable';
  }
  if (!dueAt) {
    return 'upcoming';
  }
  const overdueAt = addMinutesToLocal(dueAt.slice(0, 10), dueAt.slice(11), TRANSFUSION_OVERDUE_GRACE_MINUTES) ?? dueAt;
  if (nowLocal > overdueAt) {
    return 'overdue';
  }
  return nowLocal >= dueAt ? 'due' : 'upcoming';
}

export type TransfusionProgress = {
  recorded: number;
  expected: number;
  overdue: number;
  nextDue?: string;
};

export function transfusionProgress(transfusion: BloodTransfusion, nowLocal: string): TransfusionProgress {
  const progress: TransfusionProgress = { recorded: 0, expected: 0, overdue: 0 };
  for (const row of TRANSFUSION_OBSERVATION_ROWS) {
    const state = observationRowState(row, transfusion, nowLocal);
    if (state === 'notApplicable') {
      continue;
    }
    progress.expected += 1;
    if (state === 'recorded') {
      progress.recorded += 1;
    } else if (state === 'overdue') {
      progress.overdue += 1;
    } else if (!progress.nextDue) {
      progress.nextDue = observationDueAt(row, transfusion);
    }
  }
  return progress;
}

export type TransfusionPhase = 'draft' | 'inProgress' | 'ended' | 'submitted';

export function transfusionPhase(transfusion: BloodTransfusion): TransfusionPhase {
  if (transfusion.status === 'submitted') {
    return 'submitted';
  }
  if (transfusion.endedTime) {
    return 'ended';
  }
  return transfusion.timeStarted ? 'inProgress' : 'draft';
}

/** Calendar day the transfusion started on. */
export function transfusionChartDay(transfusion: BloodTransfusion): string | undefined {
  return transfusion.transfusionDate;
}

export function transfusionsEqual(a: BloodTransfusion, b: BloodTransfusion): boolean {
  const strip = ({ updatedAt: _u, encounterUuid: _e, syncedRows: _s, ...rest }: BloodTransfusion) => rest;
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}
