import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { type WardConfigObject } from '../config-schema';
import { type Encounter } from '../types';

export const DATE_FORMAT = 'DD-MMM-YYYY HH:mm';

interface VisitResponse {
  uuid: string;
  encounters: Array<Encounter>;
}

export function usePostProcedureEncounter(visitUuid: string) {
  const { postProcedureEncounterTypeUuid, postProcedureConceptUuids: c } = useConfig<WardConfigObject>();

  const url = `${restBaseUrl}/visit/${visitUuid}?v=custom:(uuid,encounters:(uuid,encounterType:(uuid),encounterDatetime,obs:(uuid,concept:(uuid,display),value:(uuid,display),groupMembers:(uuid,concept:(uuid),value:(uuid,display))),encounterProviders:(uuid,provider:(uuid,display))))`;

  const { data, error, isLoading } = useSWR<FetchResponse<VisitResponse>>(url, openmrsFetch);

  const encounter = data?.data?.encounters?.find((e) => e.encounterType?.uuid === postProcedureEncounterTypeUuid);

  const getObsDisplay = (conceptUuid: string): string | undefined => {
    const obs = encounter?.obs?.find((o) => o.concept?.uuid === conceptUuid);
    if (!obs) return undefined;
    return typeof obs.value === 'object' ? (obs.value as { display?: string })?.display : String(obs.value);
  };

  const procedureGroup = encounter?.obs?.find((o) => o.concept?.uuid === c.procedurePerformed);

  const getGroupObs = (conceptUuid: string): string | undefined => {
    const member = procedureGroup?.groupMembers?.find((m) => m.concept?.uuid === conceptUuid);
    if (!member) return undefined;
    return typeof member.value === 'object' ? (member.value as { display?: string })?.display : String(member.value);
  };

  const providerName = (() => {
    const providers = encounter?.encounterProviders;
    if (!providers?.length) return undefined;
    const raw = providers[providers.length - 1]?.provider?.display ?? '';
    const parts = raw.split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ') : raw;
  })();

  return {
    isLoading,
    error,
    encounter,
    providerName,
    surgeryDateTime: getObsDisplay(c.surgeryDateTime),
    operativeProcedure: getObsDisplay(c.operativeProcedure),
    anaesthesiaType: getGroupObs(c.anaesthesiaType),
    patientPosition: getGroupObs(c.patientPosition),
    incisionLocation: getGroupObs(c.incisionLocation),
    incisionType: getGroupObs(c.incisionType),
    closureMethod: getGroupObs(c.closureMethod),
    findings: getObsDisplay(c.findings),
    histologySpecimen: getObsDisplay(c.histologySpecimen),
    specimenType: getObsDisplay(c.specimenType),
    procedureNotes: getObsDisplay(c.procedureNotes),
  };
}
