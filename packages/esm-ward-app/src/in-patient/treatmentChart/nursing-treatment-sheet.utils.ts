export type FrequencyLike =
  | {
      display?: string | null;
      frequencyPerDay?: number | string | null;
    }
  | string
  | null
  | undefined;

export type AdministeredOrderKeys = {
  todayCountsByOrderUuid: Map<string, number>;
  todayCountsByLabel: Map<string, number>;
};

export type TreatmentChartOrderOption = {
  id: string;
  label: string;
};

const DATE_KEY_RE = /^(\d{4}-\d{2}-\d{2})/;

export function getTodayDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toLocalDateKey(raw?: string): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return getTodayDateKey(parsed);
    }
  }

  const prefixMatch = trimmed.match(DATE_KEY_RE);
  if (prefixMatch) {
    return prefixMatch[1];
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return getTodayDateKey(parsed);
}

export function createEmptyAdministeredOrderKeys(): AdministeredOrderKeys {
  return {
    todayCountsByOrderUuid: new Map(),
    todayCountsByLabel: new Map(),
  };
}

const incrementCount = (counts: Map<string, number>, key: string) => {
  if (!key) {
    return;
  }
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

export function incrementAdministeredOrderCount(
  administered: AdministeredOrderKeys,
  orderUuid: string | undefined,
  label: string | undefined,
) {
  if (orderUuid) {
    incrementCount(administered.todayCountsByOrderUuid, orderUuid);
  }
  if (label) {
    incrementCount(administered.todayCountsByLabel, label.trim().toLowerCase());
  }
}

/**
 * Daily administrations allowed by the current order frequency.
 * PRN / as-needed orders are unlimited. Unknown frequencies default to once daily.
 */
export function getDailyAdministrationLimit(frequency?: FrequencyLike): number {
  if (frequency == null || frequency === '') {
    return 1;
  }

  const display = typeof frequency === 'string' ? frequency : (frequency.display ?? '');
  const normalized = display.trim().toLowerCase();
  const frequencyPerDay =
    typeof frequency === 'object' && frequency.frequencyPerDay != null && frequency.frequencyPerDay !== ''
      ? Number(frequency.frequencyPerDay)
      : Number.NaN;

  if (/\b(prn|as needed|when required)\b/.test(normalized)) {
    return Number.POSITIVE_INFINITY;
  }

  if (Number.isFinite(frequencyPerDay) && frequencyPerDay > 0) {
    return Math.max(1, Math.round(frequencyPerDay));
  }

  const everyHoursMatch = normalized.match(/(?:every\s+(\d+(?:\.\d+)?)\s*hours?|\bq(\d+)h\b)/i);
  if (everyHoursMatch) {
    const hours = Number(everyHoursMatch[1] ?? everyHoursMatch[2]);
    if (hours > 0 && hours <= 24) {
      return Math.max(1, Math.round(24 / hours));
    }
  }

  const timesADayMatch = normalized.match(/(\d+(?:\.\d+)?)\s*times?\s*(?:a|per)?\s*day/);
  if (timesADayMatch) {
    return Math.max(1, Math.round(Number(timesADayMatch[1])));
  }

  if (/\b(qds|qid|four times)\b/.test(normalized)) {
    return 4;
  }
  if (/\b(tds|tid|three times)\b/.test(normalized)) {
    return 3;
  }
  if (/\b(bd|bid|twice)\b/.test(normalized)) {
    return 2;
  }
  if (/\b(stat|immediately|od|once daily|once a day|once per day|once|daily)\b/.test(normalized)) {
    return 1;
  }

  return 1;
}

export function getTodayAdministrationCount(
  option: TreatmentChartOrderOption,
  administered: AdministeredOrderKeys,
): number {
  if (option.id) {
    return administered.todayCountsByOrderUuid.get(option.id) ?? 0;
  }

  const labelKey = option.label.trim().toLowerCase();
  if (!labelKey) {
    return 0;
  }

  return administered.todayCountsByLabel.get(labelKey) ?? 0;
}

export function isTreatmentChartOrderLocked(
  option: TreatmentChartOrderOption,
  fieldName: 'medicationRows' | 'fluidRows',
  administeredMedication: AdministeredOrderKeys,
  administeredFluid: AdministeredOrderKeys,
  dailyLimit: number,
): boolean {
  const labelKey = option.label.trim().toLowerCase();
  if (!labelKey && !option.id) {
    return false;
  }

  if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
    return false;
  }

  const administered = fieldName === 'medicationRows' ? administeredMedication : administeredFluid;
  return getTodayAdministrationCount(option, administered) >= dailyLimit;
}
