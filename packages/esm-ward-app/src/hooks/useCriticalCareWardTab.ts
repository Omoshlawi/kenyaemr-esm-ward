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

function locationLooksHdu(locationDisplay: string | undefined): boolean {
  const text = (locationDisplay ?? '').trim().toLowerCase();
  return /\bhdu\b/.test(text) || text.includes('high dependency');
}

function locationLooksPediatric(locationDisplay: string | undefined): boolean {
  const text = (locationDisplay ?? '').trim().toLowerCase();
  return (
    /\bnicu\b/.test(text) ||
    text.includes('neonatal') ||
    /\bpicu\b/.test(text) ||
    text.includes('paediatric intensive') ||
    text.includes('pediatric intensive')
  );
}

function locationLooksIcu(locationDisplay: string | undefined): boolean {
  const text = (locationDisplay ?? '').trim().toLowerCase();
  if (locationLooksPediatric(locationDisplay)) {
    return false;
  }
  if (locationLooksHdu(locationDisplay) && !/\bicu\b/.test(text)) {
    return false;
  }
  return /\bicu\b/.test(text) || text.includes('intensive care');
}

/**
 * Prefer a clear ward name over tags. Mis-tagged ICU locations otherwise show as HDU
 * (and dual HDU+ICU tags always “matched” HDU by age). Never steal NICU/PICU.
 */
function preferKindFromDisplay(
  kinds: CriticalCareWardKind[],
  locationDisplay: string | undefined,
): CriticalCareWardKind {
  const pediatric = kinds.find((kind) => kind === 'nicu' || kind === 'picu');
  if (pediatric) {
    return pediatric;
  }
  const looksHdu = locationLooksHdu(locationDisplay);
  const looksIcu = locationLooksIcu(locationDisplay);
  if (looksIcu && !looksHdu) {
    return 'icu';
  }
  if (looksHdu && !looksIcu) {
    return 'hdu';
  }
  if (kinds.includes('hdu') && kinds.includes('icu')) {
    return looksHdu ? 'hdu' : 'icu';
  }
  return kinds[0];
}

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
    const byTag = KIND_PRIORITY.filter((kind) => {
      const uuid = configured[kind]?.toLowerCase();
      return Boolean(uuid && present.has(uuid));
    });
    if (byTag.length) {
      const kind = preferKindFromDisplay(byTag, location.display);
      return { kind, label: KIND_LABELS[kind] };
    }

    // Fallback: match display/name when tag UUIDs are missing on the location payload.
    const display = tags
      .map((tag) => `${tag.name || ''} ${tag.display || ''}`)
      .join(' ')
      .toLowerCase();
    const locationDisplay = `${location.display || ''}`.toLowerCase();
    const haystack = `${display} ${locationDisplay}`;

    const byDisplay = (kind: CriticalCareWardKind): boolean => {
      if (kind === 'nicu') {
        return /\bnicu\b/.test(haystack) || haystack.includes('neonatal');
      }
      if (kind === 'picu') {
        return (
          /\bpicu\b/.test(haystack) ||
          haystack.includes('paediatric intensive') ||
          haystack.includes('pediatric intensive')
        );
      }
      if (kind === 'hdu') {
        return /\bhdu\b/.test(haystack) || haystack.includes('high dependency');
      }
      return /\bicu\b/.test(haystack) || haystack.includes('intensive care');
    };

    const displayMatches = (['nicu', 'picu', 'icu', 'hdu'] as CriticalCareWardKind[]).filter(byDisplay);
    if (!displayMatches.length) {
      return null;
    }
    const kind = preferKindFromDisplay(displayMatches, location.display);
    return { kind, label: KIND_LABELS[kind] };
  }, [inpatientLocationTags, location?.display, location?.uuid, tags]);

  return {
    tab,
    locationUuid: location?.uuid,
    isLoading: isLoadingLocation || isLoadingTags,
  };
}
