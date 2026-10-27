import {
  defaultEbolaContactFollowupConfig,
  groupFollowUpMarksByPerson,
  mergeFollowUpEncounters,
} from './case-followup.resource';
import { FOLLOW_UP_MARK_NO, serializeFollowUpPayload } from './case-followup.utils';

const config = defaultEbolaContactFollowupConfig;

describe('mergeFollowUpEncounters', () => {
  it('hydrates an admitted contact from the index follow-up payload and dated marks', () => {
    const indexPayload = serializeFollowUpPayload({
      version: 1,
      status: 'submitted',
      isolationStartDate: '2026-10-22',
      contacts: [
        {
          id: 'patient-a',
          cn: 'Index',
          mobile: '',
          familyName: 'Otieno',
          firstName: 'Amina',
          age: '36',
          sex: 'F',
          dateOfLastContact: '2026-10-22',
          followUpStatus: 'active',
          followUpDays: ['0'],
          isIndex: true,
        },
        {
          id: 'patient-c',
          cn: '',
          mobile: '0712345678',
          familyName: 'Njoroge',
          firstName: 'Peter',
          age: '41',
          sex: 'M',
          dateOfLastContact: '2026-10-28',
          followUpStatus: 'active',
          followUpDays: ['', '', '', '', '', '', 'X'],
          isIndex: false,
        },
      ],
    });

    const merged = mergeFollowUpEncounters(
      [
        {
          uuid: 'encounter-a',
          encounterDatetime: '2026-10-28T10:00:00.000Z',
          patient: { uuid: 'patient-a' },
          obs: [
            { concept: { uuid: config.payloadConcept }, value: indexPayload },
            {
              uuid: 'obs-c-day-7',
              concept: { uuid: config.dailyMarkConcept },
              value: { uuid: config.markNoConcept },
              comment: 'contact:patient-c:day:7',
              obsDatetime: '2026-10-28T12:00:00.000',
            },
          ],
        },
      ],
      'patient-c',
      config,
      ['patient-a'],
    );

    expect(merged.encounterUuid).toBeUndefined();
    expect(merged.payload?.isolationStartDate).toBe('2026-10-28');
    expect(merged.payload?.contacts[0].id).toBe('patient-c');
    expect(merged.payload?.contacts[0].dateOfLastContact).toBe('2026-10-28');
    expect(merged.payload?.contacts[0].followUpDays[0]).toBe('X');
    const formerIndex = merged.payload?.contacts.find((contact) => contact.id === 'patient-a');
    expect(formerIndex?.isIndex).toBe(false);
    expect(formerIndex?.dateOfLastContact).toBe('2026-10-22');
    expect(merged.storedMarks[0]).toMatchObject({
      contactId: 'patient-c',
      mark: 'X',
      obsDate: '2026-10-28',
      obsUuid: 'obs-c-day-7',
    });
  });

  it("keeps the former index's 2-day stay when a 5-day contact becomes the index", () => {
    const indexPayload = serializeFollowUpPayload({
      version: 1,
      status: 'submitted',
      isolationStartDate: '2026-10-26',
      contacts: [
        {
          id: 'patient-a',
          cn: 'Index',
          mobile: '',
          familyName: 'Otieno',
          firstName: 'Amina',
          age: '36',
          sex: 'F',
          dateOfLastContact: '2026-10-26',
          followUpStatus: 'active',
          followUpDays: ['0', '0'],
          isIndex: true,
        },
        {
          id: 'patient-c',
          cn: '',
          mobile: '0712345678',
          familyName: 'Njoroge',
          firstName: 'Peter',
          age: '41',
          sex: 'M',
          dateOfLastContact: '2026-10-23',
          followUpStatus: 'active',
          followUpDays: ['0', '0', '0', '0', '0'],
          isIndex: false,
        },
      ],
    });

    const merged = mergeFollowUpEncounters(
      [
        {
          uuid: 'encounter-a',
          encounterDatetime: '2026-10-27T10:00:00.000Z',
          patient: { uuid: 'patient-a' },
          obs: [{ concept: { uuid: config.payloadConcept }, value: indexPayload }],
        },
      ],
      'patient-c',
      config,
      ['patient-a'],
    );

    const indexC = merged.payload?.contacts.find((contact) => contact.id === 'patient-c');
    const contactA = merged.payload?.contacts.find((contact) => contact.id === 'patient-a');
    expect(merged.payload?.isolationStartDate).toBe('2026-10-23');
    expect(indexC?.isIndex).toBe(true);
    expect(indexC?.dateOfLastContact).toBe('2026-10-23');
    expect(contactA?.isIndex).toBe(false);
    expect(contactA?.dateOfLastContact).toBe('2026-10-26');
    expect(contactA?.followUpDays[3]).toBe('0');
    expect(contactA?.followUpDays[4]).toBe('0');
  });
});

describe('groupFollowUpMarksByPerson', () => {
  it('only writes the open day and reuses that obs uuid so today can be changed after submit', () => {
    const groups = groupFollowUpMarksByPerson(
      [
        {
          id: '52fff42e-138e-468e-b127-9a15567c2c97',
          cn: 'Index',
          mobile: '',
          familyName: 'Otieno',
          firstName: 'Amina',
          age: '36',
          sex: 'F',
          dateOfLastContact: '2026-10-22',
          followUpStatus: 'active',
          followUpDays: ['0', '0', 'X'],
          isIndex: true,
        },
      ],
      [
        { day: 1, date: '2026-10-22' },
        { day: 2, date: '2026-10-23' },
        { day: 3, date: '2026-10-24' },
      ],
      config,
      {
        isolationStartDate: '2026-10-22',
        today: '2026-10-24',
        storedMarks: [
          {
            contactId: '52fff42e-138e-468e-b127-9a15567c2c97',
            day: 1,
            mark: '0',
            obsDate: '2026-10-22',
            obsUuid: 'obs-day-1',
          },
          {
            contactId: '52fff42e-138e-468e-b127-9a15567c2c97',
            day: 3,
            mark: '0',
            obsDate: '2026-10-24',
            obsUuid: 'obs-day-3',
          },
        ],
      },
    );

    expect(groups).toEqual([
      {
        personUuid: '52fff42e-138e-468e-b127-9a15567c2c97',
        obs: [
          expect.objectContaining({
            uuid: 'obs-day-3',
            value: FOLLOW_UP_MARK_NO,
            obsDatetime: '2026-10-24T12:00:00.000',
          }),
        ],
      },
    ]);
  });
});
