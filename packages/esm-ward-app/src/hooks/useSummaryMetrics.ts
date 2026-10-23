import { type OpenmrsResource, restBaseUrl, useConfig, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import type { WardConfigObject } from '../config-schema';
import type { AdmissionLocationFetchResponse } from '../types';
import { excludeAdmittedIsolationSuspects, useEbolaIsolationSuspects } from './useEbolaIsolationSuspects';
import { useIpdDischargeEncounter } from './useIpdDischargeEncounter';
import { useIsIsolationWard } from './useIsIsolationWard';
import { useWardPatientGrouping } from './useWardPatientGrouping';

export const useWardsSummaryMetrics = () => {
  const rep = 'custom:(ward:(tags:(uuid,display)),totalBeds,occupiedBeds,bedLayouts:(patients:(uuid,display)))';

  const apiUrl = `${restBaseUrl}/admissionLocation?v=${rep}`;
  const { data = [], isLoading, error } = useOpenmrsFetchAll<AdmissionLocationFetchResponse>(apiUrl);
  const { mortuaryAdmissionLoctionTagUuid } = useConfig<WardConfigObject>();

  const filteredData = useMemo(() => {
    if (!mortuaryAdmissionLoctionTagUuid) return data;

    return data.filter((location) => {
      const hasMortuaryTag = location.ward.tags?.some((tag) => tag.uuid === mortuaryAdmissionLoctionTagUuid);
      return !hasMortuaryTag;
    });
  }, [data, mortuaryAdmissionLoctionTagUuid]);

  const totalBeds = useMemo(() => {
    return filteredData.reduce((prev, curr) => {
      return prev + curr.totalBeds;
    }, 0);
  }, [filteredData]);

  const occupiedBeds = useMemo(() => {
    return filteredData.reduce((prev, curr) => {
      return prev + curr.occupiedBeds;
    }, 0);
  }, [filteredData]);

  const bedOccupancy = useMemo(() => {
    if (!totalBeds) return `0%`;
    return `${((occupiedBeds / totalBeds) * 100).toFixed(2)}%`;
  }, [totalBeds, occupiedBeds]);

  const admittedPatients = useMemo(() => {
    return filteredData.reduce((prev, curr) => {
      return (
        prev +
        curr.bedLayouts?.reduce((p, c) => {
          return p + (c.patients?.length ?? 0);
        }, 0)
      );
    }, 0);
  }, [filteredData]);

  return {
    totalBeds,
    occupiedBeds,
    freeBeds: totalBeds - occupiedBeds,
    bedOccupancy,
    admittedPatients,
    isLoading,
    error,
  };
};

export const useWardSummaryMetrics = () => {
  const wardPatientGroupDetails = useWardPatientGrouping();

  const { totalCount: dischargedPatients } = useIpdDischargeEncounter();
  const config = useConfig<WardConfigObject>();
  const { admittedPatients, dischargeInPatients } = useMemo(() => {
    let admittedPatients = 0;
    let dischargeInPatients = 0;
    wardPatientGroupDetails.bedLayouts?.forEach((bedLayout) => {
      const { patients } = bedLayout;
      for (const patient of patients) {
        const inpatientAdmission = wardPatientGroupDetails.wardAdmittedPatientsWithBed?.get(patient.uuid);
        if (inpatientAdmission) {
          const { visit } = inpatientAdmission;
          const ipdDischargeEncounter = visit?.encounters?.find(
            (encounter) => encounter.encounterType?.uuid === config.ipdDischargeEncounterTypeUuid,
          );
          if (!ipdDischargeEncounter) {
            admittedPatients++;
            continue;
          } else {
            dischargeInPatients++;
            continue;
          }
        } else {
          admittedPatients++;
        }
      }
    });
    return { admittedPatients, dischargeInPatients };
  }, [wardPatientGroupDetails, config]);
  const { isIsolationWard } = useIsIsolationWard();
  const { suspects } = useEbolaIsolationSuspects(isIsolationWard);
  const awaitingAdmissionPatient = useMemo(() => {
    if (isIsolationWard) {
      return excludeAdmittedIsolationSuspects(
        suspects,
        wardPatientGroupDetails?.wardAdmittedPatientsWithBed?.keys(),
        wardPatientGroupDetails?.wardUnassignedPatientsList,
      ).length;
    }
    return wardPatientGroupDetails.inpatientRequestResponse?.inpatientRequests?.length ?? 0;
  }, [isIsolationWard, suspects, wardPatientGroupDetails]);
  return {
    dischargedPatients,
    admittedPatients,
    dischargeInPatients,
    awaitingAdmissionPatient,
  };
};
