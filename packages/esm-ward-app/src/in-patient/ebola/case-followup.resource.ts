import { useMemo } from 'react';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type WardConfigObject } from '../../config-schema';
import {
  buildFollowUpMarkObs,
  codedValueToMark,
  earliestIsoDate,
  FOLLOW_UP_MARK_NO,
  FOLLOW_UP_MARK_YES,
  applyRelatedIsolationHistory,
  historyFromRelatedPayload,
  parseFollowUpMarkComment,
  parseFollowUpPayload,
  relatedIndexContactFromPayload,
  remapFollowUpDaysByDate,
  serializeFollowUpPayload,
  toLocalIsoDateFromDatetime,
  type FollowUpContact,
  type FollowUpFormPayload,
  type FollowUpSaveStatus,
  type FollowUpStoredMark,
  type FollowUpTimelineDay,
} from './case-followup.utils';

export type EbolaContactFollowupConfig = {
  encounterRoleUuid: string;
  encounterType: string;
  payloadConcept: string;
  dailyMarkConcept: string;
  markYesConcept: string;
  markNoConcept: string;
};

export const defaultEbolaContactFollowupConfig: EbolaContactFollowupConfig = {
  encounterRoleUuid: 'a0b03050-c99b-11e0-9572-0800200c9a66',
  encounterType: '465a92f2-baf8-42e9-9612-53064be868e8',
  payloadConcept: '164231AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  dailyMarkConcept: '140238AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  markYesConcept: FOLLOW_UP_MARK_YES,
  markNoConcept: FOLLOW_UP_MARK_NO,
};

export const useEbolaContactFollowupConfig = (): EbolaContactFollowupConfig => {
  const { ebolaContactFollowup } = useConfig<WardConfigObject>();
  return {
    ...defaultEbolaContactFollowupConfig,
    ...ebolaContactFollowup,
  };
};

const ENCOUNTER_REP =
  'custom:(uuid,encounterDatetime,patient:(uuid),obs:(uuid,comment,obsDatetime,concept:(uuid),value),encounterProviders:(provider:(uuid),encounterRole:(uuid)))';

type RawObs = {
  uuid?: string;
  comment?: string;
  obsDatetime?: string;
  concept?: { uuid?: string };
  value?: unknown;
};

type RawEncounter = {
  uuid: string;
  encounterDatetime?: string;
  patient?: { uuid?: string };
  obs?: RawObs[];
};

type EncountersResponse = { results: RawEncounter[] };

export type FollowUpEncounterState = {
  encounterUuid?: string;
  payload: FollowUpFormPayload | null;
  storedMarks: FollowUpStoredMark[];
};

const toStr = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'display' in value) {
    return String((value as { display?: string }).display ?? '');
  }
  return '';
};

const toValueUuid = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'uuid' in value) {
    return String((value as { uuid?: string }).uuid ?? '');
  }
  return toStr(value);
};

const readStoredMarks = (
  obs: RawObs[] | undefined,
  markConcept: string,
  yesConcept: string,
  noConcept: string,
): FollowUpStoredMark[] =>
  (obs ?? []).flatMap((item) => {
    if (markConcept && item.concept?.uuid !== markConcept) {
      return [];
    }
    const parsed = parseFollowUpMarkComment(typeof item.comment === 'string' ? item.comment : '');
    const mark = codedValueToMark(toValueUuid(item.value), yesConcept, noConcept);
    if (!parsed || !mark) {
      return [];
    }
    return [
      {
        contactId: parsed.contactId,
        day: parsed.day,
        mark,
        obsDate: toLocalIsoDateFromDatetime(item.obsDatetime),
        obsUuid: item.uuid,
      },
    ];
  });

const encounterSearchUrl = (personUuid: string, encounterType?: string) => {
  const encounterTypeQuery = encounterType ? `&encounterType=${encounterType}` : '';
  return `${restBaseUrl}/encounter?patient=${personUuid}${encounterTypeQuery}&v=${encodeURIComponent(
    ENCOUNTER_REP,
  )}&limit=50&order=desc`;
};

const encounterPatientUuid = (encounter: RawEncounter) => encounter.patient?.uuid ?? '';

const readPayloadFromEncounter = (encounter: RawEncounter, payloadConcept?: string) => {
  const payloadObs = [...(encounter.obs ?? [])].reverse().find((obs) => {
    if (payloadConcept && obs.concept?.uuid !== payloadConcept) {
      return false;
    }
    return Boolean(parseFollowUpPayload(toStr(obs.value)));
  });
  return parseFollowUpPayload(toStr(payloadObs?.value));
};

const sortEncountersOldestFirst = (encounters: RawEncounter[]) =>
  [...encounters].sort((left, right) => {
    const leftTime = left.encounterDatetime ? new Date(left.encounterDatetime).getTime() : 0;
    const rightTime = right.encounterDatetime ? new Date(right.encounterDatetime).getTime() : 0;
    return leftTime - rightTime;
  });

export const mergeFollowUpEncounters = (
  encounters: RawEncounter[],
  currentPatientUuid: string,
  config: Pick<EbolaContactFollowupConfig, 'payloadConcept' | 'dailyMarkConcept' | 'markYesConcept' | 'markNoConcept'>,
  relatedPersonUuids: string[] = [],
): FollowUpEncounterState => {
  const marksByDay = new Map<string, FollowUpStoredMark>();
  let ownPayload: FollowUpFormPayload | null = null;
  let encounterUuid: string | undefined;
  const relatedHistories: Array<{ isolationStartDate: string; contact: FollowUpContact }> = [];
  const relatedIndexesById = new Map<string, FollowUpContact>();

  for (const encounter of sortEncountersOldestFirst(encounters)) {
    const ownerUuid = encounterPatientUuid(encounter);
    const parsed = readPayloadFromEncounter(encounter, config.payloadConcept);
    if (parsed) {
      const isOwnPayload =
        ownerUuid === currentPatientUuid || parsed.contacts.some((row) => row.isIndex && row.id === currentPatientUuid);
      if (isOwnPayload) {
        ownPayload = parsed;
        encounterUuid = encounter.uuid;
      }
      if (ownerUuid !== currentPatientUuid) {
        const history = historyFromRelatedPayload(parsed, currentPatientUuid);
        if (history) {
          relatedHistories.push(history);
        }
        const relatedIndex = relatedIndexContactFromPayload(parsed, currentPatientUuid);
        if (relatedIndex) {
          relatedIndexesById.set(relatedIndex.id, relatedIndex);
        }
      }
    }

    readStoredMarks(encounter.obs, config.dailyMarkConcept, config.markYesConcept, config.markNoConcept).forEach(
      (mark) => {
        marksByDay.set(`${mark.contactId}:${mark.obsDate || mark.day}`, mark);
      },
    );
  }

  const allowedIds = new Set([currentPatientUuid, ...relatedPersonUuids]);
  const relatedIndexes = [...relatedIndexesById.values()].filter((contact) => allowedIds.has(contact.id));

  if (ownPayload) {
    return {
      encounterUuid,
      payload: {
        ...ownPayload,
        contacts: applyRelatedIsolationHistory(ownPayload.contacts, relatedIndexes, ownPayload.isolationStartDate ?? ''),
      },
      storedMarks: [...marksByDay.values()],
    };
  }

  const latestHistory = relatedHistories[relatedHistories.length - 1];
  if (!latestHistory) {
    return {
      encounterUuid,
      payload: relatedIndexes.length
        ? {
            version: 1,
            status: 'draft',
            isolationStartDate: '',
            contacts: relatedIndexes,
          }
        : null,
      storedMarks: [...marksByDay.values()],
    };
  }

  const isolationStartDate = earliestIsoDate(relatedHistories.map((history) => history.isolationStartDate));
  const contactsById = new Map<string, FollowUpContact>();
  relatedHistories
    .filter((history) => allowedIds.has(history.contact.id))
    .forEach((history) => {
      contactsById.set(history.contact.id, {
        ...history.contact,
        isIndex: history.contact.id === currentPatientUuid,
        dateOfLastContact: history.isolationStartDate || history.contact.dateOfLastContact,
        followUpDays: remapFollowUpDaysByDate(
          history.contact.followUpDays,
          history.isolationStartDate,
          isolationStartDate || history.isolationStartDate,
        ),
      });
    });

  return {
    encounterUuid,
    payload: {
      version: 1,
      status: 'draft',
      isolationStartDate,
      contacts: applyRelatedIsolationHistory([...contactsById.values()], relatedIndexes, isolationStartDate),
    },
    storedMarks: [...marksByDay.values()],
  };
};

export function useContactFollowUp(patientUuid?: string, relatedPersonUuids: string[] = []) {
  const ebolaContactFollowup = useEbolaContactFollowupConfig();
  const personIds = useMemo(
    () => [...new Set([patientUuid, ...relatedPersonUuids].filter((value): value is string => Boolean(value)))],
    [patientUuid, relatedPersonUuids],
  );
  const swrKey = personIds.length ? ['ebola-contact-followup', ebolaContactFollowup.encounterType, ...personIds] : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, async () => {
    const responses = await Promise.all(
      personIds.map((personUuid) =>
        openmrsFetch<EncountersResponse>(encounterSearchUrl(personUuid, ebolaContactFollowup.encounterType)),
      ),
    );
    return responses.flatMap((response, index) =>
      (response.data?.results ?? []).map((encounter) => ({
        ...encounter,
        patient: encounter.patient ?? { uuid: personIds[index] },
      })),
    );
  });

  const latest = useMemo<FollowUpEncounterState>(
    () => mergeFollowUpEncounters(data ?? [], patientUuid ?? '', ebolaContactFollowup, relatedPersonUuids),
    [data, ebolaContactFollowup, patientUuid, relatedPersonUuids],
  );

  return {
    ...latest,
    error,
    isLoading,
    mutate,
  };
}

export function buildContactFollowUpEncounterPayload({
  patientUuid,
  visitUuid,
  locationUuid,
  providerUuid,
  encounterRoleUuid,
  encounterType,
  payloadConcept,
  contacts,
  status,
  isolationStartDate,
  encounterUuid,
}: {
  patientUuid: string;
  visitUuid: string;
  locationUuid: string;
  providerUuid: string;
  encounterRoleUuid: string;
  encounterType: string;
  payloadConcept: string;
  contacts: FollowUpFormPayload['contacts'];
  status: FollowUpSaveStatus;
  isolationStartDate?: string;
  encounterUuid?: string;
}) {
  return {
    ...(encounterUuid ? { uuid: encounterUuid } : {}),
    patient: patientUuid,
    visit: visitUuid,
    location: locationUuid,
    encounterType,
    encounterProviders: [
      {
        provider: providerUuid,
        encounterRole: encounterRoleUuid,
      },
    ],
    obs: [
      {
        concept: payloadConcept,
        value: serializeFollowUpPayload({
          version: 1,
          status,
          isolationStartDate,
          contacts,
        }),
      },
    ],
  };
}

type FollowUpSaveObs = {
  concept: string;
  value: string;
  obsDatetime: string;
  comment?: string;
  uuid?: string;
  voided?: boolean;
};

const jsonHeaders = { 'Content-Type': 'application/json' };

const savePersonMarkEncounter = async ({
  personUuid,
  visitUuid,
  locationUuid,
  providerUuid,
  encounterRoleUuid,
  encounterType,
  obs,
}: {
  personUuid: string;
  visitUuid?: string;
  locationUuid: string;
  providerUuid: string;
  encounterRoleUuid: string;
  encounterType: string;
  obs: FollowUpSaveObs[];
}) => {
  if (!obs.length) {
    return;
  }

  return openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: jsonHeaders,
    body: {
      patient: personUuid,
      ...(visitUuid ? { visit: visitUuid } : {}),
      location: locationUuid,
      encounterType,
      encounterProviders: [
        {
          provider: providerUuid,
          encounterRole: encounterRoleUuid,
        },
      ],
      obs,
    },
  });
};

const saveOrUpdatePersonMarks = async ({
  personUuid,
  locationUuid,
  providerUuid,
  encounterRoleUuid,
  encounterType,
  obs,
}: {
  personUuid: string;
  locationUuid: string;
  providerUuid: string;
  encounterRoleUuid: string;
  encounterType: string;
  obs: FollowUpSaveObs[];
}) => {
  const existing = obs.filter((item) => item.uuid);
  const created = obs.filter((item) => !item.uuid && !item.voided && item.value);

  await Promise.all(
    existing.map((item) =>
      openmrsFetch(`${restBaseUrl}/obs/${item.uuid}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: item.voided ? { voided: true } : { value: item.value },
      }),
    ),
  );

  return savePersonMarkEncounter({
    personUuid,
    locationUuid,
    providerUuid,
    encounterRoleUuid,
    encounterType,
    obs: created,
  });
};

export async function saveContactFollowUpEncounter(
  payload: Record<string, unknown> & {
    uuid?: string;
    patient: string;
    visit?: string;
    location: string;
    encounterType: string;
    encounterProviders: Array<{ provider: string; encounterRole: string }>;
  },
  contactMarkGroups: Array<{
    personUuid: string;
    obs: FollowUpSaveObs[];
  }> = [],
) {
  const indexMarks = contactMarkGroups.find((group) => group.personUuid === payload.patient)?.obs ?? [];
  const existingObs = Array.isArray(payload.obs) ? payload.obs : [];
  const encounterUrl = payload.uuid ? `${restBaseUrl}/encounter/${payload.uuid}` : `${restBaseUrl}/encounter`;
  const saved = await openmrsFetch<{ uuid?: string }>(encounterUrl, {
    method: 'POST',
    headers: jsonHeaders,
    body: {
      ...payload,
      obs: [...existingObs, ...indexMarks],
    },
  });

  await Promise.all(
    contactMarkGroups
      .filter((group) => group.personUuid !== payload.patient)
      .map((group) =>
        saveOrUpdatePersonMarks({
          personUuid: group.personUuid,
          locationUuid: payload.location,
          providerUuid: payload.encounterProviders[0]?.provider,
          encounterRoleUuid: payload.encounterProviders[0]?.encounterRole,
          encounterType: payload.encounterType,
          obs: group.obs,
        }),
      ),
  );

  return saved;
}

export function groupFollowUpMarksByPerson(
  contacts: FollowUpFormPayload['contacts'],
  timeline: FollowUpTimelineDay[],
  config: Pick<EbolaContactFollowupConfig, 'dailyMarkConcept' | 'markYesConcept' | 'markNoConcept'>,
  options?: {
    isolationStartDate?: string;
    storedMarks?: FollowUpStoredMark[];
    today?: string;
  },
) {
  const obs = buildFollowUpMarkObs(
    contacts,
    timeline,
    config.dailyMarkConcept,
    config.markYesConcept,
    config.markNoConcept,
    {
      isolationStartDate: options?.isolationStartDate,
      existingMarks: options?.storedMarks,
      today: options?.today,
      onlyOpenDays: true,
    },
  );
  const groups = new Map<string, typeof obs>();
  obs.forEach((item) => {
    const current = groups.get(item.person) ?? [];
    current.push(item);
    groups.set(item.person, current);
  });
  return Array.from(groups.entries()).map(([personUuid, personObs]) => ({
    personUuid,
    obs: personObs.map(({ concept, value, obsDatetime, comment, uuid, voided }) => ({
      concept,
      value,
      obsDatetime,
      comment,
      ...(uuid ? { uuid } : {}),
      ...(voided ? { voided } : {}),
    })),
  }));
}
