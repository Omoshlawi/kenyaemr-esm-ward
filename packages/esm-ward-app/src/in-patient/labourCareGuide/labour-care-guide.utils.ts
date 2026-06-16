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

export const resolveStopActionLabel = (action: string) => {
  const normalized = String(action ?? '')
    .trim()
    .toLowerCase();

  if (normalized.includes('twin 1 birth') || normalized === 'd9ad3cc2-5800-4cd0-ab51-fa3306295617') {
    return null;
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
  const normalized = String(action ?? '')
    .trim()
    .toLowerCase();

  if (
    normalized === '159739aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' ||
    normalized.includes('caesarean') ||
    normalized === 'cs'
  ) {
    return 'Transferred to CS';
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
  label === 'Transferred to CS' || label === 'Referral';

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
