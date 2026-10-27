import {
  type Encounter,
  type FetchResponse,
  formatDate,
  openmrsFetch,
  parseDate,
  restBaseUrl,
  useConfig,
} from '@openmrs/esm-framework';
import pickBy from 'lodash-es/pickBy';
import { useMemo } from 'react';
import useSWR from 'swr';
import { type WardConfigObject } from '../../../config-schema';

type ContactTrace = {
  date: string;
  contactType: string;
  status: string;
  reasonNotContacted?: string;
  facilityLinkedTo?: string;
  remarks?: string;
  encounterUuid: string;
};

type TraceEncounter = Encounter & {
  form: {
    uuid: string;
    display: string;
  };
  location: {
    uuid: string;
    display: string;
  };
  obs: Array<{
    uuid: string;
    display: string;
    concept: {
      uuid: string;
      display: string;
    };
    value:
      | string
      | {
          uuid: string;
          display: string;
        };
  }>;
};
const useEncounters = (
  patientUuid: string,
  encounterTypeUuid: string,
  fromdate?: string,
  todate?: string,
  v?: string,
) => {
  const customRepresentation = v ?? 'custom:(uuid,display,encounterDatetime,obs:(uuid,display,value:(uuid,display)))';

  const params = new URLSearchParams(
    pickBy(
      { patient: patientUuid, encounterType: encounterTypeUuid, v: customRepresentation, fromdate, todate },
      (value) => Boolean(value),
    ) as Record<string, string>,
  );

  const url = `${restBaseUrl}/encounter?${params.toString()}`;

  const { data, isLoading, error, mutate } = useSWR<FetchResponse<{ results: Array<Encounter> }>>(url, openmrsFetch);
  return {
    encounters: data?.data?.results ?? [],
    isLoading,
    error,
    mutate,
  };
};

const getObsValueByConceptUuid = (obs: TraceEncounter['obs'], conceptUuid: string) => {
  const obsValue = (obs ?? []).find((item) => item.concept?.uuid === conceptUuid)?.value;
  if (typeof obsValue === 'string') {
    return obsValue;
  }
  if (obsValue && typeof obsValue === 'object') {
    return obsValue.display;
  }
};
export const useContactTraceHistory = (patientUuid: string) => {
  const customRep =
    'custom:(uuid,display,encounterDatetime,location:(uuid,display),form:(uuid,display),obs:(uuid,display,concept:(uuid,display),value:(uuid,display)))';
  const {
    htsEcounterUuid,
    contactTracingFormUuid,
    contactTracingConceptsUuids: {
      modeOfClienttracingConceptUuid,
      reasonNotContactedConceptUuid,
      remarksConceptUuid,
      tracingStatusConceptUuid,
    },
  } = useConfig<WardConfigObject>();

  const { encounters, error, isLoading } = useEncounters(patientUuid, htsEcounterUuid, undefined, undefined, customRep);

  const tracingHistory = useMemo(
    () =>
      encounters
        .filter((encounter: TraceEncounter) => encounter?.form?.uuid === contactTracingFormUuid)
        .map<ContactTrace>((encounter: TraceEncounter) => ({
          encounterUuid: encounter?.uuid,
          contactType: getObsValueByConceptUuid(encounter.obs, modeOfClienttracingConceptUuid),
          status: getObsValueByConceptUuid(encounter.obs, tracingStatusConceptUuid),
          reasonNotContacted: getObsValueByConceptUuid(encounter.obs, reasonNotContactedConceptUuid),
          date: encounter.encounterDatetime ? formatDate(parseDate(encounter.encounterDatetime)) : '--',
          facilityLinkedTo: encounter?.location?.display ?? '--',
          remarks: getObsValueByConceptUuid(encounter.obs, remarksConceptUuid) ?? '--',
        })),
    [
      contactTracingFormUuid,
      encounters,
      modeOfClienttracingConceptUuid,
      reasonNotContactedConceptUuid,
      remarksConceptUuid,
      tracingStatusConceptUuid,
    ],
  );
  return { isLoading, error, contactTracesHistory: tracingHistory ?? ([] as Array<ContactTrace>) };
};
export const PAGE_SIZE_OPTIONS = [3, 5, 10, 20, 50, 100];
