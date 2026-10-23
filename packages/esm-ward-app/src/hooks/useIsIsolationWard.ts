import { useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';

import type { WardConfigObject } from '../config-schema';
import { useAdmissionLocationTags } from '../in-patient/in-patient.resource';
import useWardLocation from './useWardLocation';

/**
 * True when the selected admissions location has the configured isolation ward tag UUID.
 */
export function useIsIsolationWard(overrideLocation?: string) {
  const { inpatientLocationTags } = useConfig<WardConfigObject>();
  const { location, isLoadingLocation } = useWardLocation(overrideLocation);
  const { tags, isLoading: isLoadingTags } = useAdmissionLocationTags(location?.uuid);
  const isolationUuid = inpatientLocationTags?.isolationWard;

  const isIsolationWard = useMemo(() => {
    if (!location?.uuid || !isolationUuid) {
      return false;
    }
    if (location.uuid === isolationUuid) {
      return true;
    }
    return tags.some((tag) => tag.uuid === isolationUuid);
  }, [isolationUuid, location?.uuid, tags]);

  return {
    isIsolationWard,
    isolationUuid,
    location,
    isLoading: isLoadingLocation || isLoadingTags,
  };
}
