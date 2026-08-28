import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWRImmutable from 'swr/immutable';

export interface FacilityRegistryBedOccupancy {
  totalBeds?: number;
  normalBeds?: number;
  icuBeds?: number;
  hduBeds?: number;
  dialysisBeds?: number;
  numberOfCots?: number;
}

export interface FacilityRegistryResponse {
  fr_code?: string;
  official_name?: string;
  keph_level?: string;
  bed_occupancy?: FacilityRegistryBedOccupancy;
  last_synced_at?: string;
  last_sync_status?: string;
}

export function useFacilityRegistry() {
  const url = `${restBaseUrl}/virtualclaims/facility-registry`;
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<FacilityRegistryResponse>>(url, openmrsFetch);

  return {
    facility: data?.data,
    bedOccupancy: data?.data?.bed_occupancy,
    isLoading,
    error,
  };
}
