import { useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';

import type { WardConfigObject } from '../config-schema';
import { useAdmissionLocationTags } from '../in-patient/in-patient.resource';
import useWardLocation from './useWardLocation';

export const isIsolationLocation = (
  locationUuid: string | undefined,
  tags: Array<{ uuid: string }>,
  isolationUuid?: string,
) => {
  if (!locationUuid || !isolationUuid) {
    return false;
  }
  return locationUuid === isolationUuid || tags.some((tag) => tag.uuid === isolationUuid);
};

/**
 * True when the selected admissions location has the configured isolation ward tag UUID.
 */
export function useIsIsolationWard(overrideLocation?: string) {
  const { inpatientLocationTags } = useConfig<WardConfigObject>();
  const { location, isLoadingLocation } = useWardLocation(overrideLocation);
  const { tags, isLoading: isLoadingTags } = useAdmissionLocationTags(location?.uuid);
  const isolationUuid = inpatientLocationTags?.isolationWard;

  const isIsolationWard = useMemo(
    () => isIsolationLocation(location?.uuid, tags, isolationUuid),
    [isolationUuid, location?.uuid, tags],
  );

  return {
    isIsolationWard,
    isolationUuid,
    location,
    isLoading: isLoadingLocation || isLoadingTags,
  };
}

export function useIsIsolationAdmission(locationUuid?: string) {
  const { inpatientLocationTags } = useConfig<WardConfigObject>();
  const { tags, isLoading } = useAdmissionLocationTags(locationUuid);
  const isolationUuid = inpatientLocationTags?.isolationWard;

  return {
    isIsolationAdmission: isIsolationLocation(locationUuid, tags, isolationUuid),
    hasAdmissionLocation: Boolean(locationUuid),
    isLoading,
  };
}
