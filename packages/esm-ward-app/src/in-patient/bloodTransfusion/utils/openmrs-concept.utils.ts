/** Expand numeric dictionary ids to OpenMRS legacy concept UUIDs (36 chars). */
export function toOpenMrsConceptUuid(conceptRef: string | undefined): string {
  const trimmed = conceptRef?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (trimmed.includes('-')) {
    return trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed}${'A'.repeat(Math.max(0, 36 - trimmed.length))}`;
  }
  const legacyMatch = trimmed.match(/^(\d+)(A+)$/i);
  if (legacyMatch) {
    const [, digits] = legacyMatch;
    return `${digits}${'A'.repeat(Math.max(0, 36 - digits.length))}`;
  }
  return trimmed;
}

export function openMrsConceptUuidsMatch(a: string | undefined, b: string | undefined): boolean {
  const left = toOpenMrsConceptUuid(a);
  const right = toOpenMrsConceptUuid(b);
  return Boolean(left && right && left === right);
}

/**
 * Normalize a value that is already known to be an answer *concept id*
 * (e.g. ODS "2027572"), not a UI score like GCS "3".
 * Do not call this on free-text or numeric form scores — that pads "3" into a fake UUID.
 */
export function toOpenMrsObsValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Only pad long numeric dictionary ids (5+ digits), never single-digit UI scores.
    if (/^\d{5,}$/.test(trimmed)) {
      return toOpenMrsConceptUuid(trimmed);
    }
  }
  return value;
}
