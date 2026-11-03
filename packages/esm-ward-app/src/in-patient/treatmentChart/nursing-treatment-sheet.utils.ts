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
 * Daily administrations allowed for an order, based on frequency only
 * (e.g. BD → 2, TDS → 3). Dose / quantity is not used. PRN is unlimited.
 */
export function getDailyAdministrationLimit(frequency?: FrequencyLike, extraText?: string | null): number {
  const display = typeof frequency === 'string' ? frequency : (frequency?.display ?? '');
  const normalized = [display, extraText ?? ''].join(' ').trim().toLowerCase();
  const frequencyPerDay =
    typeof frequency === 'object' && frequency?.frequencyPerDay != null && frequency.frequencyPerDay !== ''
      ? Number(frequency.frequencyPerDay)
      : Number.NaN;

  if (/\b(prn|as needed|when required)\b/.test(normalized)) {
    return Number.POSITIVE_INFINITY;
  }

  let frequencyLimit = 1;

  if (Number.isFinite(frequencyPerDay) && frequencyPerDay > 0) {
    frequencyLimit = Math.max(1, Math.round(frequencyPerDay));
  } else {
    const everyHoursMatch = normalized.match(/(?:every\s+(\d+(?:\.\d+)?)\s*hours?|\bq(\d+)h\b)/i);
    if (everyHoursMatch) {
      const hours = Number(everyHoursMatch[1] ?? everyHoursMatch[2]);
      if (hours > 0 && hours <= 24) {
        frequencyLimit = Math.max(1, Math.round(24 / hours));
      }
    } else {
      const timesADayMatch = normalized.match(
        /(\d+(?:\.\d+)?)\s*(?:times?|x|fois)\s*(?:a|per|par)?\s*(?:day|jour|siku)?/,
      );
      if (timesADayMatch) {
        frequencyLimit = Math.max(1, Math.round(Number(timesADayMatch[1])));
      } else if (/\b(qds|qid|four times|quatre fois)\b/.test(normalized)) {
        frequencyLimit = 4;
      } else if (/\b(tds|tid|three times|trois fois)\b/.test(normalized)) {
        frequencyLimit = 3;
      } else if (/\b(bd|bid|twice|deux fois)\b/.test(normalized)) {
        frequencyLimit = 2;
      } else if (/\b(stat|immediately|od|once daily|once a day|once per day|once|daily|une fois)\b/.test(normalized)) {
        frequencyLimit = 1;
      }
    }
  }

  return frequencyLimit;
}

export function getRemainingAdministrationsToday(givenToday: number, selectedCount: number, dailyLimit: number) {
  if (!Number.isFinite(dailyLimit)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, dailyLimit - givenToday - selectedCount);
}

export function getTodayAdministrationCount(
  option: TreatmentChartOrderOption,
  administered: AdministeredOrderKeys,
): number {
  const byOrder = option.id ? (administered.todayCountsByOrderUuid.get(option.id) ?? 0) : 0;
  const labelKey = option.label.trim().toLowerCase();
  const byLabel = labelKey ? (administered.todayCountsByLabel.get(labelKey) ?? 0) : 0;

  // Count the same drug across a revised order (e.g. BD → TDS) so remaining is
  // newFrequencyLimit - already given today, not a full new day's worth.
  return Math.max(byOrder, byLabel);
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
