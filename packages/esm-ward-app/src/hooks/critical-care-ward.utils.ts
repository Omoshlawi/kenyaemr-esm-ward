export type CriticalCareAdmitKind = 'nicu' | 'picu';

const NICU_MAX_AGE_DAYS = 28;
const PICU_MIN_AGE_DAYS = 29;
const PICU_MAX_AGE_YEARS = 12;

function normalizeUuid(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function calendarDaysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((end - start) / 86_400_000);
}

export function hasReachedAgeYears(birth: Date, years: number, now: Date): boolean {
  const anniversary = new Date(birth.getFullYear() + years, birth.getMonth(), birth.getDate());
  const anniversaryUtc = Date.UTC(anniversary.getFullYear(), anniversary.getMonth(), anniversary.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return nowUtc >= anniversaryUtc;
}

export function patientBirthDate(patient: { person?: { birthdate?: string }; birthDate?: string } | undefined): string | undefined {
  return patient?.person?.birthdate || patient?.birthDate;
}

export function parseBirthDate(birthDate: string | undefined): Date | null {
  if (!birthDate) {
    return null;
  }
  const parsed = new Date(birthDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True when this patient may be admitted to NICU (0–28 days) or PICU (29 days until the 12th birthday). */
export function patientMatchesCriticalCareAge(
  kind: CriticalCareAdmitKind,
  birthDate: string | undefined,
  now = new Date(),
): boolean {
  const birth = parseBirthDate(birthDate);
  if (!birth) {
    return false;
  }
  const ageDays = calendarDaysBetween(birth, now);
  if (ageDays < 0) {
    return false;
  }
  if (kind === 'nicu') {
    return ageDays <= NICU_MAX_AGE_DAYS;
  }
  return ageDays >= PICU_MIN_AGE_DAYS && !hasReachedAgeYears(birth, PICU_MAX_AGE_YEARS, now);
}

/** Age from date of birth. Under 1 year is shown in days so NICU and PICU ages are visible. */
export function formatAgeFromBirthDate(birthDate: string | undefined, now = new Date()): string | null {
  const birth = parseBirthDate(birthDate);
  if (!birth) {
    return null;
  }
  const ageDays = calendarDaysBetween(birth, now);
  if (ageDays < 0) {
    return null;
  }
  if (!hasReachedAgeYears(birth, 1, now)) {
    return ageDays === 1 ? '1 day' : `${ageDays} days`;
  }
  let years = now.getFullYear() - birth.getFullYear();
  if (!hasReachedAgeYears(birth, years, now)) {
    years -= 1;
  }
  return years === 1 ? '1 year' : `${years} years`;
}

type WardLike = {
  uuid?: string;
  display?: string;
  name?: string;
  tags?: Array<{ uuid?: string; display?: string; name?: string }>;
};

export function criticalCareKindForWard(
  ward: WardLike | undefined,
  configured: { nicuWard?: string; picuWard?: string },
): CriticalCareAdmitKind | null {
  if (!ward) {
    return null;
  }
  const nicuUuid = normalizeUuid(configured.nicuWard);
  const picuUuid = normalizeUuid(configured.picuWard);
  const present = new Set<string>();
  if (ward.uuid) {
    present.add(normalizeUuid(ward.uuid));
  }
  for (const tag of ward.tags ?? []) {
    const uuid = normalizeUuid(tag.uuid);
    if (uuid) {
      present.add(uuid);
    }
  }
  if (nicuUuid && present.has(nicuUuid)) {
    return 'nicu';
  }
  if (picuUuid && present.has(picuUuid)) {
    return 'picu';
  }

  const text = `${ward.display || ''} ${ward.name || ''}`.toLowerCase();
  if (/\bnicu\b/.test(text) || text.includes('neonatal')) {
    return 'nicu';
  }
  if (/\bpicu\b/.test(text) || text.includes('paediatric intensive') || text.includes('pediatric intensive')) {
    return 'picu';
  }
  return null;
}

/** Keep a location's own name when it already says NICU or PICU; otherwise show the ward label. */
export function criticalCareWardDisplay(display: string | undefined, label: 'NICU' | 'PICU'): string {
  const text = (display ?? '').trim();
  const lower = text.toLowerCase();
  if (!text) {
    return label;
  }
  if (label === 'NICU' && (/\bnicu\b/.test(lower) || lower.includes('neonatal'))) {
    return text;
  }
  if (
    label === 'PICU' &&
    (/\bpicu\b/.test(lower) || lower.includes('paediatric intensive') || lower.includes('pediatric intensive'))
  ) {
    return text;
  }
  return label;
}
