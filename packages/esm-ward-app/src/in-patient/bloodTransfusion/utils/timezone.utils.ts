/**
 * Facility timezone helpers.
 *
 * All ICU day boundaries and hour slots are evaluated in the configured facility
 * timezone rather than the browser's local timezone. When `timeZone` is omitted
 * the functions fall back to the browser local zone, which is safe for development.
 */

export type DateTimeParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
};

function getParts(date: Date, timeZone: string | undefined): DateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** ISO date string (YYYY-MM-DD) in the facility timezone. */
export function toFacilityDate(date: Date, timeZone?: string): string {
  const { year, month, day } = getParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Hour of day (0–23) in the facility timezone. */
export function toFacilityHour(date: Date, timeZone?: string): number {
  return getParts(date, timeZone).hour;
}

/** Full parts in the facility timezone. */
export function toFacilityParts(date: Date, timeZone?: string): DateTimeParts {
  return getParts(date, timeZone);
}

/** Locale-aware date label for the facility timezone, e.g. "Wed, Aug 5". */
export function formatFacilityDate(date: Date, timeZone: string | undefined, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Locale-aware time label in the facility timezone, e.g. "17:30". */
export function formatFacilityTime(date: Date, timeZone: string | undefined, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/** Hour label like "05:00" (timezone agnostic, just formats the hour). */
export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Build a Date object representing the start of the facility day for a given ISO date.
 * This is useful for stamping observations on the correct facility day.
 */
export function startOfFacilityDay(isoDate: string, timeZone?: string): Date {
  // Use the ISO date as a local input in the facility timezone. We construct a UTC date
  // with that YYYY-MM-DD and the facility offset, then convert to a true Date.
  // A robust way is to parse the date as if it were in the facility zone using Intl.
  const [y, m, d] = isoDate.split('-').map(Number);
  const candidate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const parts = getParts(candidate, timeZone);
  // If the facility date is still the same at noon UTC, candidate is close enough.
  // Adjust by the day difference to land exactly on the requested facility date.
  const dayDiff = parts.day - d;
  const adjusted = new Date(candidate.getTime() - dayDiff * 24 * 60 * 60 * 1000);
  const adjustedParts = getParts(adjusted, timeZone);
  if (adjustedParts.year !== y || adjustedParts.month !== m || adjustedParts.day !== d) {
    // Fallback: try one day earlier or later
    const secondTry = new Date(adjusted.getTime() - (adjustedParts.day > d ? 1 : -1) * 24 * 60 * 60 * 1000);
    return secondTry;
  }
  return adjusted;
}

/** Add (or subtract) whole calendar days to a YYYY-MM-DD string. */
export function addFacilityCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) {
    return isoDate;
  }
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(
    2,
    '0',
  )}`;
}

/** Whole days between two YYYY-MM-DD strings (b − a). */
export function facilityCalendarDaysBetween(fromIsoDate: string, toIsoDate: string): number {
  const [ay, am, ad] = fromIsoDate.split('-').map(Number);
  const [by, bm, bd] = toIsoDate.split('-').map(Number);
  const aMs = Date.UTC(ay, am - 1, ad);
  const bMs = Date.UTC(by, bm - 1, bd);
  return Math.round((bMs - aMs) / (24 * 60 * 60 * 1000));
}

/** True if the facility timezone observes DST. */
export function facilityTimeZoneHasDst(timeZone: string): boolean {
  const year = new Date().getFullYear();
  const jan = toFacilityParts(new Date(Date.UTC(year, 0, 1)), timeZone);
  const jul = toFacilityParts(new Date(Date.UTC(year, 6, 1)), timeZone);
  return jan.hour !== jul.hour || jan.month !== jul.month || jan.day !== jul.day;
}

/** UTC instant for the start of an hour slot on a facility calendar day (for grid alignment). */
export function buildFacilityDateTime(isoDate: string, hour: number, timeZone?: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const normalizedHour = ((hour % 24) + 24) % 24;
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  for (let offsetHours = -48; offsetHours <= 48; offsetHours++) {
    const probe = new Date(anchor.getTime() + offsetHours * 60 * 60 * 1000);
    const parts = getParts(probe, timeZone);
    if (
      parts.year === y &&
      parts.month === m &&
      parts.day === d &&
      parts.hour === normalizedHour &&
      parts.minute === 0
    ) {
      return probe;
    }
  }

  const dayStart = startOfFacilityDay(isoDate, timeZone);
  return new Date(dayStart.getTime() + normalizedHour * 60 * 60 * 1000);
}
