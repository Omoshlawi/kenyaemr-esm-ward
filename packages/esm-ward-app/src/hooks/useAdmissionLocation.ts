import {
  type FetchResponse,
  openmrsFetch,
  restBaseUrl,
  useFeatureFlag,
  useOpenmrsPagination,
} from '@openmrs/esm-framework';
import useSWR from 'swr';
import { type AdmissionLocationFetchResponse } from '../types/index';
import useWardLocation from './useWardLocation';
import { useState } from 'react';
import useSWRImmutable from 'swr/immutable';
import { type Location } from '@openmrs/esm-emr-api';

const requestRep =
  'custom:(ward,totalBeds,occupiedBeds,bedLayouts:(rowNumber,bedType,columnNumber,bedNumber,bedId,bedUuid,status,location,patients:(person:full,identifiers,uuid)))';

/**
 * Fetches bed layouts (including patients in those beds) for the current ward via Bed Management's
 * `admissionLocation` endpoint. "Admitted" in the ward linelist = patients present on these beds;
 * "Unassigned" = inpatient admissions with no bed on this layout.
 *
 * Always requests when a ward location is set. Do not gate on the `bedmanagement-module` feature
 * flag alone — that flag was historically tied to bedmanagement ^6 while the app requires >=7, so
 * the flag stayed off and every patient appeared under Unassigned.
 */
export function useAdmissionLocation(rep: string = requestRep, overrideLocation: string | null = null) {
  const { location } = useWardLocation(overrideLocation);
  const isBedManagementModuleInstalled = useFeatureFlag('bedmanagement-module');

  const apiUrl = location?.uuid ? `${restBaseUrl}/admissionLocation/${location?.uuid}?v=${rep}` : null;
  const { data, ...rest } = useSWR<FetchResponse<AdmissionLocationFetchResponse>, Error>(apiUrl, openmrsFetch, {
    shouldRetryOnError: false,
  });

  return {
    admissionLocation: data?.data,
    isBedManagementModuleInstalled,
    ...rest,
  };
}

export const useAdmisiionLocations = () => {
  const apiUrl = `${restBaseUrl}/admissionLocation`;
  const pageSizes = [10, 20, 50, 100];
  const [currPageSize, setCurrPageSize] = useState(10);
  const { data, ...rest } = useOpenmrsPagination<AdmissionLocationFetchResponse>(apiUrl, currPageSize);
  return {
    ...rest,
    admissionLocations: data ?? [],
    pageSizes,
    currPageSize,
    setCurrPageSize,
  };
};

export const useLocationsByTag = (tag: string) => {
  const url = `${restBaseUrl}/location?tag=${encodeURIComponent(tag)}`;
  const { data, ...rest } = useSWRImmutable<FetchResponse<{ results: Array<Location> }>>(url, openmrsFetch);
  return {
    ...rest,
    locations: data?.data?.results ?? [],
  };
};
