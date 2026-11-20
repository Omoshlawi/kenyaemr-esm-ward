import { openmrsFetch, type OpenmrsResource, type Patient, restBaseUrl, useSession } from '@openmrs/esm-framework';
import type { DispositionType, Encounter, EncounterPayload, ObsPayload } from './types';
import useEmrConfiguration from './hooks/useEmrConfiguration';
import useWardLocation from './hooks/useWardLocation';

export function useCreateEncounter() {
  const { location } = useWardLocation();
  const { currentProvider } = useSession();
  const { emrConfiguration, isLoadingEmrConfiguration, errorFetchingEmrConfiguration } = useEmrConfiguration();

  const createEncounter = (
    patient: Patient,
    encounterType: OpenmrsResource,
    visitUuid: string,
    obs: ObsPayload[] = [],
    dateOfAdmission?: Date,
    formUuid?: string,
  ) => {
    const encounterTypeUuid = encounterType?.uuid;
    if (!encounterTypeUuid) {
      return Promise.reject(new Error('Missing admission/transfer encounter type from EMR configuration'));
    }
    if (!location?.uuid) {
      return Promise.reject(new Error('Missing ward location for the admission encounter'));
    }

    const encounterPayload = {
      patient: patient.uuid,
      encounterType: encounterTypeUuid,
      location: location.uuid,
      encounterProviders: [
        {
          provider: currentProvider?.uuid,
          encounterRole: emrConfiguration.clinicianEncounterRole.uuid,
        },
      ],
      obs,
      visit: visitUuid,
      encounterDatetime: dateOfAdmission?.toISOString() ?? undefined,
      form: formUuid,
    };

    return openmrsFetch<Encounter>(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: encounterPayload,
    });
  };

  return { createEncounter, emrConfiguration, isLoadingEmrConfiguration, errorFetchingEmrConfiguration };
}

export function useAdmitPatient() {
  const { createEncounter, emrConfiguration, isLoadingEmrConfiguration, errorFetchingEmrConfiguration } =
    useCreateEncounter();

  const admitPatient = (
    patient: Patient,
    dispositionType: DispositionType,
    visitUuid: string,
    obs?: ObsPayload[],
    dateOfAdmission?: Date,
    formUuid?: string,
  ) => {
    const encounterType =
      dispositionType === 'ADMIT'
        ? emrConfiguration.admissionEncounterType
        : dispositionType === 'TRANSFER'
          ? emrConfiguration.transferWithinHospitalEncounterType
          : null;
    return createEncounter(patient, encounterType, visitUuid, obs, dateOfAdmission, formUuid);
  };

  return { admitPatient, isLoadingEmrConfiguration, errorFetchingEmrConfiguration };
}

/**
 * Assign a patient to a bed.
 * Bed Management expects the numeric bed id in the path (`/beds/{bedId}`). Passing a bed UUID
 * often returns HTTP 500 on KenyaEMR / bedmanagement builds.
 */
export function assignPatientToBed(bedId: number | string, patientUuid: string, encounterUuid: string) {
  if (bedId === undefined || bedId === null || bedId === '') {
    return Promise.reject(new Error('Missing bed id for bed assignment'));
  }
  if (!encounterUuid) {
    return Promise.reject(new Error('Missing encounter for bed assignment'));
  }
  return openmrsFetch(`${restBaseUrl}/beds/${bedId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: {
      patientUuid,
      encounterUuid,
    },
  });
}

export function removePatientFromBed(bedId: number, patientUuid: string) {
  return openmrsFetch(`${restBaseUrl}/beds/${bedId}?patientUuid=${patientUuid}`, {
    method: 'DELETE',
  });
}
