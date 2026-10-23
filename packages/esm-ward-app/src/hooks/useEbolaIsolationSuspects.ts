import { openmrsFetch, restBaseUrl, type Patient, type Visit } from '@openmrs/esm-framework';
import useSWR from 'swr';

export type EbolaIsolationSuspect = {
  patient: Patient;
  visit: Visit;
  dispositionType: 'ADMIT';
  dateQueued?: string;
};

type SuspectsResponse = { results?: Array<EbolaIsolationSuspect> };

export function excludeAdmittedIsolationSuspects(
  suspects: EbolaIsolationSuspect[],
  admittedPatientUuids?: Iterable<string> | null,
  unassignedAdmissions?: Array<{ patient?: { uuid?: string } }> | null,
): EbolaIsolationSuspect[] {
  const admitted = new Set<string>(admittedPatientUuids ?? []);
  for (const admission of unassignedAdmissions ?? []) {
    if (admission?.patient?.uuid) {
      admitted.add(admission.patient.uuid);
    }
  }
  return suspects.filter((row) => Boolean(row?.patient?.uuid) && !admitted.has(row.patient.uuid));
}

export function useEbolaIsolationSuspects(enabled: boolean) {
  const url = enabled ? `${restBaseUrl}/kenyaemr/ebola-isolation-suspects` : null;
  const { data, error, isLoading, mutate } = useSWR<SuspectsResponse>(url, async (requestUrl: string) => {
    const response = await openmrsFetch(requestUrl);
    return response.data;
  });

  return {
    suspects: data?.results ?? [],
    error,
    isLoading,
    mutate,
  };
}

export function createIsolationAdmissionRequest(patientUuid: string, visitUuid: string, locationUuid?: string) {
  const params = new URLSearchParams({ patientUuid, visitUuid });
  if (locationUuid) {
    params.set('locationUuid', locationUuid);
  }
  return openmrsFetch(`${restBaseUrl}/kenyaemr/ebola-isolation-admission-request?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}
