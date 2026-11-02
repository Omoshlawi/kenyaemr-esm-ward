import { useMemo } from 'react';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Encounter } from '../../encounter-observations/visit.resource';

const VISIT_ENCOUNTERS_REP =
  'custom:(uuid,encounters:(uuid,encounterDatetime,form:(uuid,name,display),' +
  'encounterType:(uuid,display,editPrivilege:(uuid,display)),' +
  'encounterProviders:(uuid,provider:(uuid,person:(uuid,display))),' +
  'obs:(uuid,display,value,obsDatetime,concept:(uuid,display,conceptClass:(uuid,display)),' +
  'groupMembers:(uuid,display,value,concept:(uuid,display)))))';

type VisitEncountersResponse = { uuid: string; encounters?: Array<Encounter> };

/**
 * Fetches the encounters of a visit filled with the given form, including their obs,
 * which the visit context's default representation leaves out.
 */
export const useVisitFormEncounters = (visitUuid: string | undefined, formUuid: string) => {
  const url = visitUuid && formUuid ? `${restBaseUrl}/visit/${visitUuid}?v=${VISIT_ENCOUNTERS_REP}` : null;
  const { data, error, isLoading, mutate } = useSWR<{ data: VisitEncountersResponse }>(url, openmrsFetch);

  const encounters = useMemo(
    () =>
      (data?.data?.encounters ?? [])
        .filter((encounter) => encounter.form?.uuid === formUuid)
        .sort((a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime()),
    [data, formUuid],
  );

  return { encounters, error, isLoading, mutate };
};
