import { PARTOGRAPHY_CONCEPTS, URINE_TEST_TIME_SLOT_CONCEPT } from './types';

export const activeFirstStageHours = Array.from({ length: 12 }, (_, index) => index + 1);
export const secondStageHours = Array.from({ length: 3 }, (_, index) => index + 1);

export const calculateAgeFromBirthDate = (birthDate?: string) => {
  if (!birthDate) {
    return '';
  }

  const parsedBirthDate = new Date(birthDate);
  if (Number.isNaN(parsedBirthDate.getTime())) {
    return '';
  }

  const today = new Date();
  let age = today.getFullYear() - parsedBirthDate.getFullYear();
  const monthDiff = today.getMonth() - parsedBirthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsedBirthDate.getDate())) {
    age -= 1;
  }

  return String(Math.max(age, 0));
};

export const isEncounterAfterSessionReset = (
  encounterDatetime: string | undefined,
  sessionResetAfterMs: number | null | undefined,
) => {
  if (!sessionResetAfterMs) {
    return true;
  }

  if (!encounterDatetime) {
    return false;
  }

  const encounterTimeMs = new Date(encounterDatetime).getTime();
  return Number.isFinite(encounterTimeMs) && encounterTimeMs > sessionResetAfterMs;
};

export const readObsValue = (obs: any) => {
  const value = obs?.value;

  if (value && typeof value === 'object') {
    if ('display' in value && typeof value.display === 'string') {
      return value.display;
    }

    if ('uuid' in value && typeof value.uuid === 'string') {
      return value.uuid;
    }
  }

  return value != null ? String(value) : '';
};

export const getEncounterObsValue = (encounter: any, conceptUuid: string) => {
  const found = encounter?.obs?.find((obs: any) => obs.concept?.uuid === conceptUuid);
  return found ? readObsValue(found) : '';
};

export const getLabourContractionObsFromEncounter = (encounter: any) => {
  const countConceptUuid = PARTOGRAPHY_CONCEPTS['contraction-count'];
  const durationConceptUuid = PARTOGRAPHY_CONCEPTS['uterine-contraction-duration'];

  if (countConceptUuid !== durationConceptUuid) {
    return {
      contractionsPer10Mins: getEncounterObsValue(encounter, countConceptUuid),
      durationOfContractions: getEncounterObsValue(encounter, durationConceptUuid),
    };
  }

  const legacyValues = (encounter?.obs ?? [])
    .filter((obs: any) => obs.concept?.uuid === countConceptUuid)
    .map((obs: any) => readObsValue(obs));

  return {
    contractionsPer10Mins: legacyValues[0] ?? '',
    durationOfContractions: legacyValues[1] ?? '',
  };
};

export const getEncounterObsNumber = (encounter: any, conceptUuid: string) => {
  const value = getEncounterObsValue(encounter, conceptUuid);
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const getEncounterRecordedTime = (encounter: any) => {
  const explicitTimeObs = encounter?.obs?.find(
    (obs: any) =>
      (obs.concept?.uuid === '160632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' ||
        obs.concept?.uuid === PARTOGRAPHY_CONCEPTS['pulse-time-slot'] ||
        obs.concept?.uuid === PARTOGRAPHY_CONCEPTS['time-slot'] ||
        obs.concept?.uuid === URINE_TEST_TIME_SLOT_CONCEPT) &&
      typeof obs.value === 'string' &&
      (obs.value.startsWith('Time:') || /^\d{1,2}:\d{2}$/.test(obs.value)),
  );

  if (explicitTimeObs?.value) {
    const match = String(explicitTimeObs.value).match(/Time:\s*(.+)/);
    if (match) {
      return match[1].trim();
    }

    if (/^\d{1,2}:\d{2}$/.test(String(explicitTimeObs.value).trim())) {
      return String(explicitTimeObs.value).trim();
    }
  }

  const encounterDate = new Date(encounter?.encounterDatetime);
  if (Number.isNaN(encounterDate.getTime())) {
    return '';
  }

  return encounterDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const parseLcgEntryTimeString = (raw: unknown): string => {
  if (raw === null || raw === undefined) {
    return '';
  }

  const text = String(raw).trim();
  if (!text) {
    return '';
  }

  const timeMatch = text.match(/Time:\s*([0-9]{1,2}:[0-9]{2})/i);
  if (timeMatch) {
    return timeMatch[1];
  }

  if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(text)) {
    return text;
  }

  return '';
};

export const resolveEntryTimeMs = (entry: { encounterDatetime?: string; time?: string }) => {
  const encounterDate = new Date(entry.encounterDatetime ?? Date.now());
  const resolvedTime = parseLcgEntryTimeString(entry.time);

  if (!resolvedTime) {
    const fallbackTime = encounterDate.getTime();
    return Number.isFinite(fallbackTime) ? fallbackTime : null;
  }

  const [hours, minutes] = resolvedTime.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    const fallbackTime = encounterDate.getTime();
    return Number.isFinite(fallbackTime) ? fallbackTime : null;
  }

  const entryDate = new Date(encounterDate);
  entryDate.setHours(hours, minutes, 0, 0);
  const entryTimeMs = entryDate.getTime();

  return Number.isFinite(entryTimeMs) ? entryTimeMs : null;
};

/** Alert lifecycle timestamp: max(slot time, recorded encounter time) for same-hour re-entry. */
export const resolveAlertCreatedTimeMs = (entry: { encounterDatetime?: string; time?: string }) => {
  const slotTimeMs = resolveEntryTimeMs(entry);
  if (!entry.encounterDatetime) {
    return slotTimeMs;
  }

  const recordedTimeMs = new Date(entry.encounterDatetime).getTime();
  if (!Number.isFinite(recordedTimeMs)) {
    return slotTimeMs;
  }

  if (slotTimeMs === null) {
    return recordedTimeMs;
  }

  return Math.max(slotTimeMs, recordedTimeMs);
};

export const parseCervicalDilationValue = (value: string) => {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return null;
  }

  const numericValue = Number(normalizedValue);
  if (Number.isFinite(numericValue)) {
    if (numericValue <= 0) {
      return null;
    }
    return numericValue;
  }

  const match = normalizedValue.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return parsed > 0 ? parsed : null;
};

export const parseDescentOfHeadValue = (value: string) => {
  const trimmedValue = String(value ?? '').trim();
  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  const match = trimmedValue.match(/([0-5])\s*\/\s*5|\b([0-5])\b/);
  return match ? Number(match[1] ?? match[2]) : null;
};

export const parseUrgeToPushValue = (value: string) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized === 'yes' || normalized === '1065aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') {
    return 'yes';
  }

  if (normalized === 'no' || normalized === '1066aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') {
    return 'no';
  }

  return '';
};

export const normalizeLcgConceptKey = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export const isTerminateOngoingProgressAction = (action: string) => {
  const normalized = normalizeLcgConceptKey(action);
  return (
    normalized === '737fa73a-509f-40d8-9e84-91dc71db7f4c' ||
    normalized.includes('terminate ongoing progress') ||
    normalized.includes('terminate ongoing')
  );
};

export const resolveStopActionLabel = (action: string) => {
  const normalized = normalizeLcgConceptKey(action);

  if (normalized.includes('twin 1 birth') || normalized === 'd9ad3cc2-5800-4cd0-ab51-fa3306295617') {
    return null;
  }

  if (isTerminateOngoingProgressAction(action)) {
    return 'TERMINATED';
  }

  if (normalized === 'fb50f3e1-0971-4f82-9774-41ff57e38043' || normalized === 'delivery' || normalized === 'birth') {
    return 'BIRTH';
  }

  if (normalized === '160433aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' || normalized.includes('dead')) {
    return 'DEAD';
  }

  return null;
};

export const resolveSharedDecisionActionDisplayLabel = (action: string) => {
  const normalized = normalizeLcgConceptKey(action);

  if (isTerminateOngoingProgressAction(action)) {
    return 'Session Terminated';
  }

  if (
    normalized === '159739aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' ||
    normalized.includes('caesarean') ||
    normalized === 'cs'
  ) {
    return 'Emergency Caesarean section Prescribed';
  }

  if (normalized === '0dcc1312-e83e-4317-97c3-4b127b599744' || normalized.includes('referral')) {
    return 'Referral';
  }

  if (normalized === 'd9ad3cc2-5800-4cd0-ab51-fa3306295617' || normalized.includes('twin 1 birth')) {
    return 'Twin 1 Birth';
  }

  if (normalized === 'fb50f3e1-0971-4f82-9774-41ff57e38043' || normalized.includes('delivery')) {
    return 'BIRTH';
  }

  if (normalized === '160433aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' || normalized.includes('dead')) {
    return 'DEAD';
  }

  return action;
};

export const isSharedDecisionCriticalActionDisplayLabel = (label: string) =>
  label === 'Emergency Caesarean section Prescribed' || label === 'Referral';

export const resolveBirthActionLabel = (action: string) => {
  const normalized = String(action ?? '')
    .trim()
    .toLowerCase();

  if (
    normalized === 'd9ad3cc2-5800-4cd0-ab51-fa3306295617' ||
    normalized.includes('twin 1 birth') ||
    normalized === 'fb50f3e1-0971-4f82-9774-41ff57e38043' ||
    normalized === 'delivery'
  ) {
    return 'BIRTH';
  }

  return null;
};

export const SHARED_DECISION_GRID_TEXT_MAX_LENGTH = 80;

export const truncateSharedDecisionGridText = (
  text: string,
  maxLength: number = SHARED_DECISION_GRID_TEXT_MAX_LENGTH,
): { display: string; isTruncated: boolean } => {
  const normalized = String(text ?? '').trim();
  if (!normalized) {
    return { display: '', isTruncated: false };
  }

  if (normalized.length <= maxLength) {
    return { display: normalized, isTruncated: false };
  }

  return {
    display: `${normalized.slice(0, maxLength).trimEnd()}…`,
    isTruncated: true,
  };
};
