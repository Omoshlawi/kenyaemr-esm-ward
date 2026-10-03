import { openmrsFetch, restBaseUrl, useConfig, type FetchResponse } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';
import { type Location } from '@openmrs/esm-emr-api';

import { type WardConfigObject } from '../config-schema';
import { criticalCareWardDisplay } from './critical-care-ward.utils';
import { useLocationsByTag } from './useAdmissionLocation';

const LOCATION_REP = 'custom:(uuid,display,name,tags:(uuid,display,name))';

function useLocationsForConfiguredWard(uuid: string | undefined, label: 'NICU' | 'PICU') {
  const byUuidUrl = uuid ? `${restBaseUrl}/location/${uuid}?v=${LOCATION_REP}` : null;
  const byTagUrl = uuid ? `${restBaseUrl}/location?tag=${encodeURIComponent(uuid)}&v=${LOCATION_REP}` : null;
  const byUuid = useSWRImmutable<FetchResponse<Location>>(byUuidUrl, openmrsFetch);
  const byTag = useSWRImmutable<FetchResponse<{ results: Array<Location> }>>(byTagUrl, openmrsFetch);

  const locations = useMemo(() => {
    const fromTag = byTag.data?.data?.results ?? [];
    const direct = byUuid.data?.data?.uuid ? [byUuid.data.data] : [];
    const merged = new Map<string, Location>();
    for (const location of [...fromTag, ...direct]) {
      if (!location?.uuid) {
        continue;
      }
      const display = criticalCareWardDisplay(location.display || location.name, label);
      const key = `${location.uuid}:${display}`;
      if (!merged.has(key)) {
        merged.set(key, { ...location, display });
      }
    }
    return [...merged.values()];
  }, [byTag.data, byUuid.data, label]);

  return {
    locations,
    isLoading: Boolean(uuid) && ((byUuidUrl && byUuid.isLoading) || (byTagUrl && byTag.isLoading)),
  };
}

/**
 * Admission wards plus NICU and PICU.
 * NICU/PICU are included even when those locations are not tagged "Admission Location".
 */
export function useSelectableWards() {
  const { inpatientLocationTags } = useConfig<WardConfigObject>();
  const admission = useLocationsByTag('Admission Location');
  const nicu = useLocationsForConfiguredWard(inpatientLocationTags?.nicuWard, 'NICU');
  const picu = useLocationsForConfiguredWard(inpatientLocationTags?.picuWard, 'PICU');

  const locations = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<Location> = [];
    for (const location of [...(admission.locations ?? []), ...nicu.locations, ...picu.locations]) {
      const key = `${location.uuid}:${location.display}`;
      if (!location.uuid || seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push(location);
    }
    return items;
  }, [admission.locations, nicu.locations, picu.locations]);

  return {
    locations,
    nicuLocations: nicu.locations,
    picuLocations: picu.locations,
    isLoading: admission.isLoading || nicu.isLoading || picu.isLoading,
    error: admission.error,
  };
}
