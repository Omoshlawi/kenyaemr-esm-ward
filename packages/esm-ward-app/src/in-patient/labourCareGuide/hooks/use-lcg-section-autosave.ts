import React from 'react';
import { replaceLcgSectionEntries, type LcgStorageSection } from '../storage/lcg-local-storage';

const DEFAULT_AUTOSAVE_DELAY_MS = 800;

export function useLcgSectionAutosave<T>(
  patientUuid: string,
  section: Exclude<LcgStorageSection, 'partography'>,
  entries: T[],
  enabled = true,
  delayMs = DEFAULT_AUTOSAVE_DELAY_MS,
) {
  const latestEntriesRef = React.useRef(entries);
  latestEntriesRef.current = entries;

  React.useEffect(() => {
    if (!enabled || !patientUuid) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void replaceLcgSectionEntries(patientUuid, section, latestEntriesRef.current).then((result) => {
        if (!result.success && result.error) {
          console.warn(`[LCG autosave:${section}]`, result.error);
        }
      });
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, enabled, entries, patientUuid, section]);
}
