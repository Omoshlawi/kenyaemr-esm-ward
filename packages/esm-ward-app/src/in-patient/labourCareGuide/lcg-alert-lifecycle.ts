import { parseLcgEntryTimeString, resolveEntryTimeMs } from './labour-care-guide.utils';
import { LCG_SHARED_DECISION_PROMPT_HOUR_MINUTES } from './types';
import { formatHHMM, getGridSlotBounds, getSlotIndexForTime, parseHHMMToMinutes } from './time-slot-utils';

const MINUTES_IN_DAY = 24 * 60;
const MAX_TRACKED_HOURLY_SLOTS = 48;

const normalizeMinutes = (minutes: number) => ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;

const setClockMinutesOnAnchorDay = (anchorMs: number, totalMinutes: number) => {
  const normalized = normalizeMinutes(totalMinutes);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const date = new Date(anchorMs);
  date.setHours(hours, minutes, 0, 0);
  let candidateMs = date.getTime();

  if (candidateMs > anchorMs + 12 * 60 * 60_000) {
    candidateMs -= MINUTES_IN_DAY * 60_000;
  } else if (candidateMs < anchorMs - 12 * 60 * 60_000) {
    candidateMs += MINUTES_IN_DAY * 60_000;
  }

  return candidateMs;
};

export type LcgHourlyCellBounds = {
  periodStartMs: number;
  periodEndMs: number;
};

export const getLcgHourlyCellBoundsForEntry = (
  baseTime: string | null | undefined,
  entry: { encounterDatetime?: string; time?: string },
  slotIntervalMinutes = LCG_SHARED_DECISION_PROMPT_HOUR_MINUTES,
): LcgHourlyCellBounds | null => {
  const entryTimeMs = resolveEntryTimeMs(entry);
  if (entryTimeMs === null) {
    return null;
  }

  if (!baseTime) {
    const periodMs = slotIntervalMinutes * 60_000;
    const periodStartMs = Math.floor(entryTimeMs / periodMs) * periodMs;
    return { periodStartMs, periodEndMs: periodStartMs + periodMs };
  }

  const entryTimeHHMM = parseLcgEntryTimeString(entry.time) || formatHHMM(new Date(entryTimeMs));
  const slotIndex = getSlotIndexForTime(baseTime, entryTimeHHMM, MAX_TRACKED_HOURLY_SLOTS);
  const baseMinutes = parseHHMMToMinutes(baseTime);

  if (slotIndex === null || baseMinutes === null) {
    return null;
  }

  const { slotStart, slotEnd } = getGridSlotBounds(slotIndex, { slotIntervalMinutes });
  const periodStartMs = setClockMinutesOnAnchorDay(entryTimeMs, baseMinutes + slotStart);
  const periodEndMs = setClockMinutesOnAnchorDay(entryTimeMs, baseMinutes + slotEnd);

  if (periodEndMs <= periodStartMs) {
    return { periodStartMs, periodEndMs: periodStartMs + slotIntervalMinutes * 60_000 };
  }

  return { periodStartMs, periodEndMs };
};

export const computeLcgAlertActivationMs = (
  timestampCreatedMs: number,
  periodEndMs: number,
  alertTimerMinutes: number,
): number | null => {
  const rawActivationMs = timestampCreatedMs + alertTimerMinutes * 60_000;
  if (rawActivationMs >= periodEndMs) {
    return null;
  }

  return rawActivationMs;
};

export const isLcgAlertWithinHourlyCell = (nowMs: number, periodEndMs: number) => nowMs < periodEndMs;

export const buildLcgAlertId = (periodStartMs: number, section: string, code: string, timestampCreatedMs: number) =>
  `${periodStartMs}|${section}|${code}|${timestampCreatedMs}`;

export const getLastAcknowledgedMsForPeriod = (
  periodStartMs: number,
  periodEndMs: number,
  sharedDecisionEntryTimesMs: number[],
  sessionAcknowledgedAtMs = 0,
) => {
  const submissionAckMs = sharedDecisionEntryTimesMs
    .filter((entryTimeMs) => entryTimeMs >= periodStartMs && entryTimeMs < periodEndMs)
    .reduce((latest, entryTimeMs) => Math.max(latest, entryTimeMs), 0);

  return Math.max(sessionAcknowledgedAtMs, submissionAckMs);
};

export const isLcgAlertObservationActive = (
  timestampCreatedMs: number,
  periodStartMs: number,
  periodEndMs: number,
  lastAcknowledgedMs: number,
  nowMs: number,
) => {
  if (!isLcgAlertWithinHourlyCell(nowMs, periodEndMs)) {
    return false;
  }

  return timestampCreatedMs > lastAcknowledgedMs;
};

export const isLcgMicroSessionPromptRetired = (
  promptTriggerTimeMs: number,
  periodStartMs: number,
  periodEndMs: number,
  lastAcknowledgedMs: number,
  nowMs: number,
) => {
  if (!isLcgAlertWithinHourlyCell(nowMs, periodEndMs)) {
    return true;
  }

  return promptTriggerTimeMs <= lastAcknowledgedMs;
};

/** @deprecated Prefer isLcgAlertObservationActive with getLastAcknowledgedMsForPeriod */
export const isLcgAlertAddressedBySharedDecision = (
  alertObservedAtMs: number,
  periodStartMs: number,
  sharedDecisionEntryTimesMs: number[],
) => {
  return sharedDecisionEntryTimesMs.some((sdmTimeMs) => sdmTimeMs >= periodStartMs && sdmTimeMs >= alertObservedAtMs);
};

/** @deprecated Prefer isLcgMicroSessionPromptRetired with getLastAcknowledgedMsForPeriod */
export const isLcgPromptAddressedBySharedDecision = (
  promptTriggerTimeMs: number,
  periodStartMs: number,
  sharedDecisionEntryTimesMs: number[],
) => {
  return sharedDecisionEntryTimesMs.some((sdmTimeMs) => sdmTimeMs >= periodStartMs && sdmTimeMs >= promptTriggerTimeMs);
};

export const shouldFireLcgAlertAlarm = (
  nowMs: number,
  activatesAtMs: number | null,
  periodEndMs: number,
  isAddressed: boolean,
) => {
  if (isAddressed || activatesAtMs === null) {
    return false;
  }

  if (!isLcgAlertWithinHourlyCell(nowMs, periodEndMs)) {
    return false;
  }

  return nowMs >= activatesAtMs;
};

export const getMsUntilNextHourlyBoundary = (nowMs: number, periodEndMs: number) => Math.max(0, periodEndMs - nowMs);
