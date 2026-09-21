import { useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';

import type { WardConfigObject } from '../config-schema';
import useWardLocation from '../hooks/useWardLocation';
import { useAdmissionLocationTags } from '../in-patient/in-patient.resource';

export type CriticalCareWardKind = 'icu' | 'hdu' | 'nicu' | 'picu';

export type CriticalCareWardTab = {
  kind: CriticalCareWardKind;
  label: string;
};

const KIND_PRIORITY: CriticalCareWardKind[] = ['nicu', 'picu', 'icu', 'hdu'];

const KIND_LABELS: Record<CriticalCareWardKind, string> = {
  icu: 'ICU',
  hdu: 'HDU',
  nicu: 'NICU',
  picu: 'PICU',
};

/**
 * When the selected admissions ward is ICU / HDU / NICU / PICU, returns the tab
 * label to show next to Discharged. Labour and other wards return null.
 */
export function useCriticalCareWardTab(): {
  tab: CriticalCareWardTab | null;
  locationUuid?: string;
  isLoading: boolean;
} {
  const { inpatientLocationTags } = useConfig<WardConfigObject>();
  const { location, isLoadingLocation } = useWardLocation();
  const { tags, isLoading: isLoadingTags } = useAdmissionLocationTags(location?.uuid);

  const tab = useMemo(() => {
    if (!location?.uuid || !tags.length) {
      return null;
    }

    const configured: Record<CriticalCareWardKind, string | undefined> = {
      icu: inpatientLocationTags?.icuWard,
      hdu: inpatientLocationTags?.hduWard,
      nicu: inpatientLocationTags?.nicuWard,
      picu: inpatientLocationTags?.picuWard,
    };

    const present = new Set(tags.map((tag) => tag.uuid?.toLowerCase()).filter(Boolean));

    for (const kind of KIND_PRIORITY) {
      const uuid = configured[kind]?.toLowerCase();
      if (uuid && present.has(uuid)) {
        return { kind, label: KIND_LABELS[kind] };
      }
    }

    // Fallback: match display/name when tag UUIDs are missing on the location payload.
    const display = tags
      .map((tag) => `${tag.name || ''} ${tag.display || ''}`)
      .join(' ')
      .toLowerCase();
    const locationDisplay = `${location.display || ''}`.toLowerCase();
    const haystack = `${display} ${locationDisplay}`;

    for (const kind of KIND_PRIORITY) {
      if (kind === 'nicu' && (/\bnicu\b/.test(haystack) || haystack.includes('neonatal'))) {
        return { kind, label: KIND_LABELS[kind] };
      }
      if (
        kind === 'picu' &&
        (/\bpicu\b/.test(haystack) ||
          haystack.includes('paediatric intensive') ||
          haystack.includes('pediatric intensive'))
      ) {
        return { kind, label: KIND_LABELS[kind] };
      }
      if (kind === 'hdu' && (/\bhdu\b/.test(haystack) || haystack.includes('high dependency'))) {
        return { kind, label: KIND_LABELS[kind] };
      }
      if (kind === 'icu' && (/\bicu\b/.test(haystack) || haystack.includes('intensive care'))) {
        return { kind, label: KIND_LABELS[kind] };
      }
    }

    return null;
  }, [inpatientLocationTags, location?.display, location?.uuid, tags]);

  return {
    tab,
    locationUuid: location?.uuid,
    isLoading: isLoadingLocation || isLoadingTags,
  };
}
