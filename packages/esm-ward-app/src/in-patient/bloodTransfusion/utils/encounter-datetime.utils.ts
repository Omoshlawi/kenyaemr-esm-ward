import { toOmrsIsoString } from '@openmrs/esm-framework';

/**
 * OpenMRS rejects an encounterDatetime in the future or outside the visit's start/stop range.
 * Grid entries are stamped at the slot hour, which can fall before a visit that started mid-hour,
 * so clamp into [visit start, min(now, visit stop)]. Grid placement is kept on the obs comment.
 */
export function toVisitSafeEncounterDatetime(
  iso: string,
  visitStartDatetime?: string,
  visitStopDatetime?: string,
  now: Date = new Date(),
): string {
  const requested = new Date(iso);
  let safeMs = Number.isNaN(requested.getTime()) ? now.getTime() : requested.getTime();

  const stopMs = visitStopDatetime ? new Date(visitStopDatetime).getTime() : Number.NaN;
  const upperMs = Number.isNaN(stopMs) ? now.getTime() : Math.min(now.getTime(), stopMs);
  safeMs = Math.min(safeMs, upperMs);

  const startMs = visitStartDatetime ? new Date(visitStartDatetime).getTime() : Number.NaN;
  if (!Number.isNaN(startMs)) {
    safeMs = Math.max(safeMs, startMs);
  }

  return toOmrsIsoString(new Date(safeMs));
}
