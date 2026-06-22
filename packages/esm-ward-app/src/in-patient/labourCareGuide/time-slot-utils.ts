import {
  BABY_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  BABY_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
  LCG_BABY_HALF_GRID_OFFSET_MINUTES,
  LCG_BABY_SECOND_STAGE_LOWER_EARLY_ALLOWANCE_MINUTES,
  LCG_BABY_SECOND_STAGE_LOWER_INTERVAL_MINUTES,
  LCG_BABY_SECOND_STAGE_LOWER_LATE_ALLOWANCE_MINUTES,
  LCG_BABY_SECOND_STAGE_UPPER_EARLY_ALLOWANCE_MINUTES,
  LCG_BABY_SECOND_STAGE_UPPER_INTERVAL_MINUTES,
  LCG_BABY_SECOND_STAGE_UPPER_LATE_ALLOWANCE_MINUTES,
  LCG_SHARED_DECISION_ASSESSMENT_OFFSET_MINUTES,
  LCG_SHARED_DECISION_SLOT_INTERVAL_MINUTES,
  LCG_TIME_INCREMENT_MINUTES,
  SHARED_DECISION_MAKING_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  SHARED_DECISION_MAKING_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
  SUPPORTIVE_CARE_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  SUPPORTIVE_CARE_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
} from './types';

const MINUTES_IN_DAY = 24 * 60;
const LCG_GRID_SLOT_INTERVAL_MINUTES = LCG_TIME_INCREMENT_MINUTES;

export type LcgSlotState = 'pending' | 'active' | 'locked';

export type LcgGridSlotOptions = {
  slotIntervalMinutes?: number;
  earlyAllowanceMinutes?: number;
  lateAllowanceMinutes?: number;
};

export type LcgPointSlotOptions = {
  slotIntervalMinutes?: number;
  offsetMinutes?: number;
  earlyAllowanceMinutes?: number;
  lateAllowanceMinutes?: number;
};

export type LcgSlotBounds = {
  slotStart: number;
  slotEnd: number;
};

export type LcgSlotSubmissionValidation = {
  valid: boolean;
  slotIndex: number | null;
  slotState: LcgSlotState | null;
  errorCode?: 'OUT_OF_RANGE' | 'SLOT_LOCKED' | 'SLOT_PENDING';
};

export const BABY_BASE_ROW_SLOT_OPTIONS: Required<LcgPointSlotOptions> = {
  slotIntervalMinutes: LCG_GRID_SLOT_INTERVAL_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: SUPPORTIVE_CARE_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  lateAllowanceMinutes: SUPPORTIVE_CARE_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
};

export const BABY_PRIMARY_FHR_SLOT_OPTIONS: Required<LcgPointSlotOptions> = {
  slotIntervalMinutes: LCG_GRID_SLOT_INTERVAL_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: BABY_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  lateAllowanceMinutes: BABY_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
};

export const BABY_HALF_GRID_SLOT_OPTIONS: Required<LcgPointSlotOptions> = {
  slotIntervalMinutes: LCG_GRID_SLOT_INTERVAL_MINUTES,
  offsetMinutes: LCG_BABY_HALF_GRID_OFFSET_MINUTES,
  earlyAllowanceMinutes: BABY_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  lateAllowanceMinutes: BABY_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
};

export const BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS: Array<Required<LcgPointSlotOptions>> = Array.from(
  { length: 4 },
  (_, offsetIndex) => ({
    slotIntervalMinutes: LCG_GRID_SLOT_INTERVAL_MINUTES,
    offsetMinutes: offsetIndex * LCG_BABY_SECOND_STAGE_UPPER_INTERVAL_MINUTES,
    earlyAllowanceMinutes: LCG_BABY_SECOND_STAGE_UPPER_EARLY_ALLOWANCE_MINUTES,
    lateAllowanceMinutes: LCG_BABY_SECOND_STAGE_UPPER_LATE_ALLOWANCE_MINUTES,
  }),
);

export const BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS: Array<Required<LcgPointSlotOptions>> = [
  {
    slotIntervalMinutes: LCG_GRID_SLOT_INTERVAL_MINUTES,
    offsetMinutes: 0,
    earlyAllowanceMinutes: LCG_BABY_SECOND_STAGE_LOWER_EARLY_ALLOWANCE_MINUTES,
    lateAllowanceMinutes: LCG_BABY_SECOND_STAGE_LOWER_LATE_ALLOWANCE_MINUTES,
  },
];

export const SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS: Required<LcgPointSlotOptions> = {
  slotIntervalMinutes: LCG_SHARED_DECISION_SLOT_INTERVAL_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: SHARED_DECISION_MAKING_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  lateAllowanceMinutes: SHARED_DECISION_MAKING_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
};

export const SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS: Required<LcgPointSlotOptions> = {
  slotIntervalMinutes: LCG_SHARED_DECISION_SLOT_INTERVAL_MINUTES,
  offsetMinutes: LCG_SHARED_DECISION_ASSESSMENT_OFFSET_MINUTES,
  earlyAllowanceMinutes: SHARED_DECISION_MAKING_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  lateAllowanceMinutes: SHARED_DECISION_MAKING_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
};

const normalizeMinutes = (minutes: number) => ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;

const resolveGridSlotOptions = (options?: LcgGridSlotOptions) => ({
  slotIntervalMinutes: options?.slotIntervalMinutes ?? LCG_GRID_SLOT_INTERVAL_MINUTES,
  earlyAllowanceMinutes: options?.earlyAllowanceMinutes ?? SUPPORTIVE_CARE_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  lateAllowanceMinutes: options?.lateAllowanceMinutes ?? SUPPORTIVE_CARE_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
});

const resolvePointSlotOptions = (options?: LcgPointSlotOptions): Required<LcgPointSlotOptions> => ({
  slotIntervalMinutes: options?.slotIntervalMinutes ?? LCG_GRID_SLOT_INTERVAL_MINUTES,
  offsetMinutes: options?.offsetMinutes ?? 0,
  earlyAllowanceMinutes: options?.earlyAllowanceMinutes ?? SUPPORTIVE_CARE_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  lateAllowanceMinutes: options?.lateAllowanceMinutes ?? SUPPORTIVE_CARE_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
});

const toBaseRelativeMinutes = (baseMinutes: number, targetMinutes: number, allowedNegativeMinutes = 0) => {
  let delta = targetMinutes - baseMinutes;
  if (delta < -allowedNegativeMinutes) {
    delta += MINUTES_IN_DAY;
  }
  return delta;
};

const isRelativeMinutesWithinRange = (relativeMinutes: number, slotCount: number, options?: LcgPointSlotOptions) => {
  const resolvedOptions = resolvePointSlotOptions(options);
  const minimumRelativeMinutes = -resolvedOptions.earlyAllowanceMinutes;
  const maximumRelativeMinutes =
    (slotCount - 1) * resolvedOptions.slotIntervalMinutes +
    resolvedOptions.offsetMinutes +
    resolvedOptions.lateAllowanceMinutes;

  return relativeMinutes >= minimumRelativeMinutes && relativeMinutes <= maximumRelativeMinutes;
};

export const parseHHMMToMinutes = (hhmm: string): number | null => {
  const parts = (hhmm ?? '').split(':');
  if (parts.length !== 2) {
    return null;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

export const formatMinutesToHHMM = (minutes: number) => {
  const normalized = normalizeMinutes(minutes);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const getForwardMinutesDelta = (fromTime: string, toTime: string) => {
  const fromMinutes = parseHHMMToMinutes(fromTime);
  const toMinutes = parseHHMMToMinutes(toTime);

  if (fromMinutes === null || toMinutes === null) {
    return null;
  }

  let delta = toMinutes - fromMinutes;
  if (delta < 0) {
    delta += MINUTES_IN_DAY;
  }

  return delta;
};

export const getNextAllowedTime = (lastObservationTime: string, intervalMinutes: number) => {
  const lastMinutes = parseHHMMToMinutes(lastObservationTime);
  if (lastMinutes === null) {
    return null;
  }

  return formatMinutesToHHMM(lastMinutes + intervalMinutes);
};

export const isWithinIntervalLockWindow = (
  lastObservationTime: string,
  candidateTime: string,
  intervalMinutes: number,
) => {
  const delta = getForwardMinutesDelta(lastObservationTime, candidateTime);
  if (delta === null) {
    return false;
  }

  return delta < intervalMinutes;
};

export const addStepsToHHMM = (hhmm: string, stepIndex: number): string | null => {
  const baseMinutes = parseHHMMToMinutes(hhmm);
  if (baseMinutes === null) {
    return null;
  }

  return formatMinutesToHHMM(baseMinutes + stepIndex * LCG_GRID_SLOT_INTERVAL_MINUTES);
};

export const getGridSlotBounds = (slotIndex: number, options?: LcgGridSlotOptions): LcgSlotBounds => {
  const { slotIntervalMinutes } = resolveGridSlotOptions(options);
  const slotStart = slotIndex * slotIntervalMinutes;
  return { slotStart, slotEnd: slotStart + slotIntervalMinutes };
};

export const getPointSlotBounds = (slotIndex: number, options?: LcgPointSlotOptions): LcgSlotBounds => {
  const resolvedOptions = resolvePointSlotOptions(options);
  const slotStart = resolvedOptions.offsetMinutes + slotIndex * resolvedOptions.slotIntervalMinutes;
  return { slotStart, slotEnd: slotStart + resolvedOptions.slotIntervalMinutes };
};

export const getSlotOffsets = (slotIndex: number, options?: LcgGridSlotOptions) => {
  const { slotIntervalMinutes, earlyAllowanceMinutes, lateAllowanceMinutes } = resolveGridSlotOptions(options);
  const { slotStart, slotEnd } = getGridSlotBounds(slotIndex, options);

  return {
    slotStart,
    slotEnd,
    opensAt: slotStart - earlyAllowanceMinutes,
    closesAt: slotEnd + lateAllowanceMinutes,
  };
};

export const getPointSlotOffsets = (slotIndex: number, options?: LcgPointSlotOptions) => {
  const { slotIntervalMinutes, offsetMinutes, earlyAllowanceMinutes, lateAllowanceMinutes } =
    resolvePointSlotOptions(options);
  const targetMinute = offsetMinutes + slotIndex * slotIntervalMinutes;

  return {
    targetMinute,
    opensAt: targetMinute - earlyAllowanceMinutes,
    closesAtExclusive: targetMinute + lateAllowanceMinutes + 1,
  };
};

export const getCurrentRelativeMinutes = (baseTime: string, now: Date) => {
  const baseMinutes = parseHHMMToMinutes(baseTime);
  if (baseMinutes === null) {
    return null;
  }

  return toBaseRelativeMinutes(baseMinutes, now.getHours() * 60 + now.getMinutes());
};

export const getSlotState = (
  baseTime: string,
  slotIndex: number,
  now: Date,
  options?: LcgGridSlotOptions,
): LcgSlotState | null => {
  const currentRelativeMinutes = getCurrentRelativeMinutes(baseTime, now);
  if (currentRelativeMinutes === null) {
    return null;
  }

  const { opensAt, closesAt } = getSlotOffsets(slotIndex, options);
  if (currentRelativeMinutes < opensAt) {
    return 'pending';
  }
  if (currentRelativeMinutes >= closesAt) {
    return 'locked';
  }
  return 'active';
};

export const getPointSlotState = (
  baseTime: string,
  slotIndex: number,
  now: Date,
  options?: LcgPointSlotOptions,
): LcgSlotState | null => {
  const currentRelativeMinutes = getCurrentRelativeMinutes(baseTime, now);
  if (currentRelativeMinutes === null) {
    return null;
  }

  const { opensAt, closesAtExclusive } = getPointSlotOffsets(slotIndex, options);
  if (currentRelativeMinutes < opensAt) {
    return 'pending';
  }
  if (currentRelativeMinutes >= closesAtExclusive) {
    return 'locked';
  }
  return 'active';
};

export const getSlotIndexForTime = (
  baseTime: string,
  time: string,
  slotCount: number,
  options?: LcgGridSlotOptions,
): number | null => {
  const { earlyAllowanceMinutes, slotIntervalMinutes } = resolveGridSlotOptions(options);
  const baseMinutes = parseHHMMToMinutes(baseTime);
  const targetMinutes = parseHHMMToMinutes(time);
  if (baseMinutes === null || targetMinutes === null) {
    return null;
  }

  const relativeMinutes = toBaseRelativeMinutes(baseMinutes, targetMinutes, earlyAllowanceMinutes);

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const { slotStart, slotEnd } = getGridSlotBounds(slotIndex, options);
    if (relativeMinutes >= slotStart && relativeMinutes < slotEnd) {
      return slotIndex;
    }
  }

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const { opensAt, closesAt } = getSlotOffsets(slotIndex, options);
    if (relativeMinutes >= opensAt && relativeMinutes < closesAt) {
      return slotIndex;
    }
  }

  return null;
};

export const getPointSlotIndexForTime = (
  baseTime: string,
  time: string,
  slotCount: number,
  options?: LcgPointSlotOptions,
): number | null => {
  const resolvedOptions = resolvePointSlotOptions(options);
  const baseMinutes = parseHHMMToMinutes(baseTime);
  const targetMinutes = parseHHMMToMinutes(time);
  if (baseMinutes === null || targetMinutes === null) {
    return null;
  }

  const allowedNegativeMinutes = Math.max(0, resolvedOptions.earlyAllowanceMinutes - resolvedOptions.offsetMinutes);
  const relativeMinutes = toBaseRelativeMinutes(baseMinutes, targetMinutes, allowedNegativeMinutes);

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const { opensAt, closesAtExclusive } = getPointSlotOffsets(slotIndex, resolvedOptions);
    if (relativeMinutes >= opensAt && relativeMinutes < closesAtExclusive) {
      return slotIndex;
    }
  }

  return null;
};

/** Same-calendar-day delta without midnight wrap (labour sessions stay within one day). */
export const getSameDayMinutesDelta = (fromTime: string, toTime: string): number | null => {
  const fromMinutes = parseHHMMToMinutes(fromTime);
  const toMinutes = parseHHMMToMinutes(toTime);

  if (fromMinutes === null || toMinutes === null) {
    return null;
  }

  return toMinutes - fromMinutes;
};

export const isSameDayTimeAtOrAfter = (referenceTime: string, time: string): boolean => {
  const delta = getSameDayMinutesDelta(referenceTime, time);
  return delta !== null && delta >= 0;
};

const resolveSecondStageSlotIndex = (
  secondStageStartTime: string,
  time: string,
  secondStageSlotCount: number,
  sameDayDeltaMinutes: number,
  resolvedOptions: Required<LcgPointSlotOptions>,
  usePointSlots: boolean,
): number | null => {
  if (sameDayDeltaMinutes < 0) {
    return null;
  }

  if (usePointSlots) {
    const secondStageIndex = getPointSlotIndexForTime(
      secondStageStartTime,
      time,
      secondStageSlotCount,
      resolvedOptions,
    );
    if (secondStageIndex !== null) {
      return secondStageIndex;
    }
  } else {
    const secondStageIndex = getSlotIndexForTime(secondStageStartTime, time, secondStageSlotCount);
    if (secondStageIndex !== null) {
      return secondStageIndex;
    }
  }

  const interval = resolvedOptions.slotIntervalMinutes;
  const offset = resolvedOptions.offsetMinutes;
  const adjustedMinutes = Math.max(0, sameDayDeltaMinutes - offset);

  return Math.min(secondStageSlotCount - 1, Math.floor(adjustedMinutes / interval));
};

const shouldKeepEntryInFirstStage = (
  baseTime: string,
  time: string,
  firstStageSlotCount: number,
  secondStageStartTime: string | undefined,
  firstStageCutoffSlotIndex?: number,
): boolean => {
  if (firstStageCutoffSlotIndex === undefined || !secondStageStartTime) {
    return false;
  }

  // Times at or after second-stage start belong in second stage (never pin to first-stage cutoff).
  if (isSameDayTimeAtOrAfter(secondStageStartTime, time)) {
    return false;
  }

  const firstStageSlot = getSlotIndexForTime(baseTime, time, firstStageSlotCount);
  return firstStageSlot !== null && firstStageSlot <= firstStageCutoffSlotIndex;
};

export const getStageAwareSlotIndexForTime = (
  baseTime: string,
  time: string,
  firstStageSlotCount: number,
  secondStageSlotCount: number,
  secondStageStartTime?: string,
  firstStageCutoffSlotIndex?: number,
) => {
  const firstStageSlot = getSlotIndexForTime(baseTime, time, firstStageSlotCount);

  if (!secondStageStartTime || secondStageSlotCount <= 0) {
    return firstStageSlot;
  }

  if (
    shouldKeepEntryInFirstStage(baseTime, time, firstStageSlotCount, secondStageStartTime, firstStageCutoffSlotIndex)
  ) {
    return firstStageSlot;
  }

  if (!isSameDayTimeAtOrAfter(secondStageStartTime, time)) {
    return firstStageSlot;
  }

  const sameDayDelta = getSameDayMinutesDelta(secondStageStartTime, time);
  if (sameDayDelta === null) {
    return firstStageSlot;
  }

  const secondStageIndex = resolveSecondStageSlotIndex(
    secondStageStartTime,
    time,
    secondStageSlotCount,
    sameDayDelta,
    resolvePointSlotOptions(),
    false,
  );

  if (secondStageIndex !== null) {
    return firstStageSlotCount + secondStageIndex;
  }

  return firstStageSlot;
};

export const getStageAwarePointSlotIndexForTime = (
  baseTime: string,
  time: string,
  firstStageSlotCount: number,
  secondStageSlotCount: number,
  secondStageStartTime?: string,
  options?: LcgPointSlotOptions,
  firstStageCutoffSlotIndex?: number,
) => {
  const resolvedOptions = resolvePointSlotOptions(options);
  const firstStageSlot = getPointSlotIndexForTime(baseTime, time, firstStageSlotCount, resolvedOptions);

  if (!secondStageStartTime || secondStageSlotCount <= 0) {
    return firstStageSlot;
  }

  if (
    shouldKeepEntryInFirstStage(baseTime, time, firstStageSlotCount, secondStageStartTime, firstStageCutoffSlotIndex)
  ) {
    return firstStageSlot;
  }

  if (!isSameDayTimeAtOrAfter(secondStageStartTime, time)) {
    return firstStageSlot;
  }

  const sameDayDelta = getSameDayMinutesDelta(secondStageStartTime, time);
  if (sameDayDelta === null) {
    return firstStageSlot;
  }

  const secondStageIndex = resolveSecondStageSlotIndex(
    secondStageStartTime,
    time,
    secondStageSlotCount,
    sameDayDelta,
    resolvedOptions,
    true,
  );

  if (secondStageIndex !== null) {
    return firstStageSlotCount + secondStageIndex;
  }

  return firstStageSlot;
};

export type LcgWorkflowStopSlotState = {
  actionSlotIndex: number;
  markerSlotIndex: number;
};

export const resolveStageAwareStopSlots = (
  baseTime: string,
  stopTime: string,
  firstStageSlotCount: number,
  secondStageSlotCount: number,
  secondStageStartTime?: string,
  options?: LcgPointSlotOptions,
): LcgWorkflowStopSlotState | null => {
  const actionSlotIndex = getStageAwarePointSlotIndexForTime(
    baseTime,
    stopTime,
    firstStageSlotCount,
    secondStageSlotCount,
    secondStageStartTime,
    options,
    undefined,
  );

  if (actionSlotIndex === null) {
    return null;
  }

  const totalSlots = firstStageSlotCount + secondStageSlotCount;

  return {
    actionSlotIndex,
    markerSlotIndex: Math.min(actionSlotIndex + 1, totalSlots - 1),
  };
};

export const formatHHMM = (date: Date): string => {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const getAllowedEmergencyTimes = (now: Date): string[] => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const allowedTimes: string[] = [];

  // Emergency overrides are for elapsed/lapsed time windows, not future entries.
  for (let minute = 0; minute <= nowMinutes; minute += 1) {
    allowedTimes.push(formatMinutesToHHMM(minute));
  }

  return allowedTimes;
};

export const getAllowedTimesForSlots = (
  baseTime: string,
  activeIndices: number[],
  _now: Date,
  options?: LcgGridSlotOptions,
) => {
  const { slotIntervalMinutes, earlyAllowanceMinutes, lateAllowanceMinutes } = resolveGridSlotOptions(options);
  const baseMinutes = parseHHMMToMinutes(baseTime);

  if (baseMinutes === null) {
    return [];
  }

  const nowRelativeMinutes = getCurrentRelativeMinutes(baseTime, _now);
  const allowedTimes = new Set<string>();
  const useExactSlotTimeOnly = earlyAllowanceMinutes === 0 && lateAllowanceMinutes === 0;

  activeIndices.forEach((idx) => {
    const slotTargetMinutes = baseMinutes + idx * slotIntervalMinutes;

    if (useExactSlotTimeOnly) {
      for (let minute = slotTargetMinutes; minute < slotTargetMinutes + slotIntervalMinutes; minute += 1) {
        allowedTimes.add(formatMinutesToHHMM(minute));
      }
      return;
    }

    const slotRelativeMinutes = idx * slotIntervalMinutes;
    const isCurrentOrPastActiveSlot = nowRelativeMinutes !== null && slotRelativeMinutes <= nowRelativeMinutes;

    const rangeStart = isCurrentOrPastActiveSlot
      ? Math.max(slotTargetMinutes - earlyAllowanceMinutes, baseMinutes)
      : slotTargetMinutes;
    const rangeEnd = isCurrentOrPastActiveSlot
      ? slotTargetMinutes + slotIntervalMinutes - 1 + lateAllowanceMinutes
      : slotTargetMinutes + lateAllowanceMinutes;

    for (let minute = rangeStart; minute <= rangeEnd; minute += 1) {
      allowedTimes.add(formatMinutesToHHMM(minute));
    }
  });

  return Array.from(allowedTimes).sort((left, right) => {
    const leftMinutes = parseHHMMToMinutes(left);
    const rightMinutes = parseHHMMToMinutes(right);

    if (leftMinutes === null || rightMinutes === null) {
      return left.localeCompare(right);
    }

    return toBaseRelativeMinutes(baseMinutes, leftMinutes) - toBaseRelativeMinutes(baseMinutes, rightMinutes);
  });
};

export const getAllowedPointTimesForSlots = (
  baseTime: string,
  slotIndices: number[],
  options?: LcgPointSlotOptions,
  now?: Date,
) => {
  const baseMinutes = parseHHMMToMinutes(baseTime);
  if (baseMinutes === null) {
    return [];
  }

  const resolvedOptions = resolvePointSlotOptions(options);
  const currentRelativeMinutes = now ? getCurrentRelativeMinutes(baseTime, now) : null;
  const times = new Set<string>();
  const useExactSlotTimeOnly =
    resolvedOptions.earlyAllowanceMinutes === 0 && resolvedOptions.lateAllowanceMinutes === 0;

  for (const slotIndex of slotIndices) {
    const { targetMinute, opensAt } = getPointSlotOffsets(slotIndex, resolvedOptions);

    if (useExactSlotTimeOnly) {
      for (
        let minuteOffset = targetMinute;
        minuteOffset < targetMinute + resolvedOptions.slotIntervalMinutes;
        minuteOffset += 1
      ) {
        times.add(formatMinutesToHHMM(baseMinutes + minuteOffset));
      }
      continue;
    }

    const visibleStart =
      currentRelativeMinutes === null
        ? opensAt
        : Math.max(opensAt, currentRelativeMinutes - resolvedOptions.earlyAllowanceMinutes);
    // Point-slot window must align with getPointSlotState/getPointSlotOffsets:
    // [target - earlyAllowance, target + lateAllowance] inclusive.
    const visibleEndExclusive = targetMinute + resolvedOptions.lateAllowanceMinutes + 1;

    for (let minuteOffset = visibleStart; minuteOffset < visibleEndExclusive; minuteOffset += 1) {
      times.add(formatMinutesToHHMM(baseMinutes + minuteOffset));
    }
  }

  return Array.from(times).sort((left, right) => {
    const leftMinutes = parseHHMMToMinutes(left);
    const rightMinutes = parseHHMMToMinutes(right);
    if (leftMinutes === null || rightMinutes === null) {
      return left.localeCompare(right);
    }

    const allowedNegativeMinutes = Math.max(0, resolvedOptions.earlyAllowanceMinutes - resolvedOptions.offsetMinutes);

    return (
      toBaseRelativeMinutes(baseMinutes, leftMinutes, allowedNegativeMinutes) -
      toBaseRelativeMinutes(baseMinutes, rightMinutes, allowedNegativeMinutes)
    );
  });
};

/** Rejects submissions whose timestamp maps to a slot that has already closed. */
export const validateGridSlotSubmission = (
  baseTime: string,
  submissionTime: string,
  now: Date,
  slotCount: number,
  options?: LcgGridSlotOptions,
): LcgSlotSubmissionValidation => {
  const slotIndex = getSlotIndexForTime(baseTime, submissionTime, slotCount, options);
  if (slotIndex === null) {
    return { valid: false, slotIndex: null, slotState: null, errorCode: 'OUT_OF_RANGE' };
  }

  const slotState = getSlotState(baseTime, slotIndex, now, options);
  if (slotState === 'locked') {
    return { valid: false, slotIndex, slotState, errorCode: 'SLOT_LOCKED' };
  }
  if (slotState === 'pending') {
    return { valid: false, slotIndex, slotState, errorCode: 'SLOT_PENDING' };
  }

  return { valid: true, slotIndex, slotState };
};

/** Rejects point-slot submissions whose timestamp maps to a slot that has already closed. */
export const validatePointSlotSubmission = (
  baseTime: string,
  submissionTime: string,
  now: Date,
  slotCount: number,
  options?: LcgPointSlotOptions,
): LcgSlotSubmissionValidation => {
  const slotIndex = getPointSlotIndexForTime(baseTime, submissionTime, slotCount, options);
  if (slotIndex === null) {
    return { valid: false, slotIndex: null, slotState: null, errorCode: 'OUT_OF_RANGE' };
  }

  const slotState = getPointSlotState(baseTime, slotIndex, now, options);
  if (slotState === 'locked') {
    return { valid: false, slotIndex, slotState, errorCode: 'SLOT_LOCKED' };
  }
  if (slotState === 'pending') {
    return { valid: false, slotIndex, slotState, errorCode: 'SLOT_PENDING' };
  }

  return { valid: true, slotIndex, slotState };
};

/** Validates grid-slot submissions across first/second stage boundaries. */
export const validateStageAwareGridSlotSubmission = (
  baseTime: string,
  submissionTime: string,
  now: Date,
  firstStageSlotCount: number,
  secondStageSlotCount: number,
  secondStageStartTime?: string,
  options?: LcgGridSlotOptions,
): LcgSlotSubmissionValidation => {
  const stageAwareIndex = getStageAwareSlotIndexForTime(
    baseTime,
    submissionTime,
    firstStageSlotCount,
    secondStageSlotCount,
    secondStageStartTime,
  );

  if (stageAwareIndex === null) {
    return { valid: false, slotIndex: null, slotState: null, errorCode: 'OUT_OF_RANGE' };
  }

  const isSecondStage =
    Boolean(secondStageStartTime) && secondStageSlotCount > 0 && stageAwareIndex >= firstStageSlotCount;

  if (isSecondStage) {
    return validateGridSlotSubmission(secondStageStartTime!, submissionTime, now, secondStageSlotCount, options);
  }

  return validateGridSlotSubmission(baseTime, submissionTime, now, firstStageSlotCount, options);
};

export const getEntrySortTimestamp = (entry: { encounterDatetime?: string; time?: string }) => {
  const encounterMs = entry.encounterDatetime ? new Date(entry.encounterDatetime).getTime() : Number.NaN;
  if (Number.isFinite(encounterMs)) {
    return encounterMs;
  }

  const timeMinutes = parseHHMMToMinutes(entry.time ?? '');
  return timeMinutes ?? 0;
};

/** Groups entries by slot key; the last entry in chronological order wins. */
export const pickLatestEntryPerSlot = <T extends { encounterDatetime?: string; time?: string }>(
  entries: T[],
  getSlotKey: (entry: T) => string | number | null,
): Map<string | number, T> => {
  const mapped = new Map<string | number, T>();
  const sorted = [...entries].sort((left, right) => getEntrySortTimestamp(left) - getEntrySortTimestamp(right));

  for (const entry of sorted) {
    const slotKey = getSlotKey(entry);
    if (slotKey !== null) {
      mapped.set(slotKey, entry);
    }
  }

  return mapped;
};
