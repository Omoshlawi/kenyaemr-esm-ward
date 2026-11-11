import { useMemo } from 'react';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Encounter } from '../encounter-observations/visit.resource';

const VISIT_ENCOUNTERS_REP =
  'custom:(uuid,encounters:(uuid,encounterDatetime,form:(uuid,name,display),' +
  'encounterType:(uuid,display,editPrivilege:(uuid,display)),' +
  'encounterProviders:(uuid,provider:(uuid,person:(uuid,display))),' +
  'obs:(uuid,display,value,obsDatetime,concept:(uuid,display,conceptClass:(uuid,display)),' +
  'groupMembers:(uuid,display,value,concept:(uuid,display)))))';

type VisitEncountersResponse = { uuid: string; encounters?: Array<Encounter> };

/**
 * Fetches the encounters of a visit filled with any of the given forms, including their obs,
 * which the visit context's default representation leaves out.
 */
export const useVisitFormEncounters = (visitUuid: string | undefined, formUuids: Array<string>) => {
  const formUuidsKey = formUuids.join(',');
  const url = visitUuid && formUuidsKey ? `${restBaseUrl}/visit/${visitUuid}?v=${VISIT_ENCOUNTERS_REP}` : null;
  const { data, error, isLoading, mutate } = useSWR<{ data: VisitEncountersResponse }>(url, openmrsFetch);

  const encounters = useMemo(() => {
    const allowedFormUuids = new Set(formUuidsKey.split(','));
    return (data?.data?.encounters ?? [])
      .filter((encounter) => allowedFormUuids.has(encounter.form?.uuid))
      .sort((a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime());
  }, [data, formUuidsKey]);

  return { encounters, error, isLoading, mutate };
};
