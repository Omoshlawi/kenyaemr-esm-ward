import {
  applyCodedMarksToContacts,
  canEditFollowUpDay,
  countFilledFollowUpContacts,
  createEmptyFollowUpContact,
  createIndexFollowUpContact,
  buildFollowUpMarkObs,
  codedValueToMark,
  FOLLOW_UP_DAY_COUNT,
  FOLLOW_UP_MARK_NO,
  FOLLOW_UP_MARK_YES,
  FOLLOW_UP_PAYLOAD_PREFIX,
  markToCodedValue,
  getContactFollowUpDayState,
  getIsolationStay,
  getPatientFollowUpBio,
  getTimelineDayDate,
  getTimelineDayNumber,
  getTimelineLength,
  isFollowUpContactFilled,
  applyRelatedIsolationHistory,
  historyFromRelatedPayload,
  mapListedContactToFollowUp,
  mergeFollowUpRows,
  relatedIndexContactFromPayload,
  normalizeFollowUpDays,
  parseDisplayDateToIso,
  parseFollowUpPayload,
  remapFollowUpDaysByDate,
  serializeFollowUpPayload,
  buildFollowUpTimeline,
  earliestIsoDate,
} from './case-followup.utils';

describe('follow-up mark concepts', () => {
  it('maps 0 to Yes and X to No so charts can store coded obs', () => {
    expect(markToCodedValue('0')).toBe(FOLLOW_UP_MARK_YES);
    expect(markToCodedValue('X')).toBe(FOLLOW_UP_MARK_NO);
    expect(markToCodedValue('')).toBe('');
    expect(codedValueToMark(FOLLOW_UP_MARK_YES)).toBe('0');
    expect(codedValueToMark(FOLLOW_UP_MARK_NO)).toBe('X');
    expect(normalizeFollowUpDays([FOLLOW_UP_MARK_YES, FOLLOW_UP_MARK_NO]).slice(0, 2)).toEqual(['0', 'X']);
  });

  it('builds one coded obs per marked day for each person UUID', () => {
    const obs = buildFollowUpMarkObs(
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
          followUpDays: ['0', '', 'X'],
          isIndex: true,
        },
      ],
      [
        { day: 1, date: '2026-10-22' },
        { day: 2, date: '2026-10-23' },
        { day: 3, date: '2026-10-24' },
      ],
      '140238AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );

    expect(obs).toEqual([
      expect.objectContaining({
        person: '52fff42e-138e-468e-b127-9a15567c2c97',
        concept: '140238AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        value: FOLLOW_UP_MARK_YES,
        obsDatetime: '2026-10-22T12:00:00.000',
      }),
      expect.objectContaining({
        value: FOLLOW_UP_MARK_NO,
        obsDatetime: '2026-10-24T12:00:00.000',
      }),
    ]);
  });

  it('rewrites only the open day so a submitted past mark stays frozen', () => {
    const contactId = '52fff42e-138e-468e-b127-9a15567c2c97';
    const obs = buildFollowUpMarkObs(
      [
        {
          id: contactId,
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
      '140238AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      FOLLOW_UP_MARK_YES,
      FOLLOW_UP_MARK_NO,
      {
        isolationStartDate: '2026-10-22',
        today: '2026-10-24',
        onlyOpenDays: true,
        existingMarks: [
          { contactId, day: 1, mark: '0', obsDate: '2026-10-22', obsUuid: 'obs-day-1' },
          { contactId, day: 2, mark: '0', obsDate: '2026-10-23', obsUuid: 'obs-day-2' },
          { contactId, day: 3, mark: '0', obsDate: '2026-10-24', obsUuid: 'obs-day-3' },
        ],
      },
    );

    expect(obs).toEqual([
      expect.objectContaining({
        uuid: 'obs-day-3',
        value: FOLLOW_UP_MARK_NO,
        obsDatetime: '2026-10-24T12:00:00.000',
      }),
    ]);
  });
});

describe('follow-up contacts', () => {
  it('counts a contact as filled once identifying details or a day mark is present', () => {
    const empty = createEmptyFollowUpContact();
    const named = { ...createEmptyFollowUpContact(), familyName: 'Otieno' };
    const marked = createEmptyFollowUpContact();
    marked.followUpDays[0] = '0';

    expect(isFollowUpContactFilled(empty)).toBe(false);
    expect(isFollowUpContactFilled(named)).toBe(true);
    expect(isFollowUpContactFilled(marked)).toBe(true);
    expect(countFilledFollowUpContacts([empty, named, marked])).toBe(2);
  });
});

describe('follow-up payload', () => {
  it('serializes and parses a payload, keeping only 0 and X day marks', () => {
    const contact = createEmptyFollowUpContact();
    contact.familyName = 'Wanjiku';
    contact.followUpDays[0] = '0';
    contact.followUpDays[1] = 'X';
    contact.followUpDays[2] = 'Y' as never;

    const serialized = serializeFollowUpPayload({
      version: 1,
      status: 'draft',
      isolationStartDate: '2026-10-22',
      contacts: [contact],
    });
    expect(serialized.startsWith(FOLLOW_UP_PAYLOAD_PREFIX)).toBe(true);

    const parsed = parseFollowUpPayload(serialized);
    expect(parsed?.status).toBe('draft');
    expect(parsed?.isolationStartDate).toBe('2026-10-22');
    expect(parsed?.contacts[0].familyName).toBe('Wanjiku');
    expect(parsed?.contacts[0].followUpDays.slice(0, 3)).toEqual(['0', 'X', '']);
    expect(parsed?.contacts[0].followUpDays).toHaveLength(FOLLOW_UP_DAY_COUNT);
  });

  it('normalizes short day arrays to 21 entries', () => {
    expect(normalizeFollowUpDays(['0', 'X'])).toEqual([
      '0',
      'X',
      ...Array.from({ length: FOLLOW_UP_DAY_COUNT - 2 }, () => ''),
    ]);
  });

  it('returns null for unrelated obs values', () => {
    expect(parseFollowUpPayload('notes')).toBeNull();
    expect(parseFollowUpPayload(`${FOLLOW_UP_PAYLOAD_PREFIX}{`)).toBeNull();
  });
});

describe('shared isolation calendar', () => {
  it('aligns day 1 with the index isolation date and later dates with later days', () => {
    expect(getTimelineDayDate('2026-10-22', 1)).toBe('2026-10-22');
    expect(getTimelineDayNumber('2026-10-22', '2026-10-22')).toBe(1);
    expect(getTimelineDayDate('2026-10-22', 7)).toBe('2026-10-28');
    expect(getTimelineDayNumber('2026-10-22', '2026-10-28')).toBe(7);
  });

  it('keeps the first 21 days visible and only reveals extra days after they have passed', () => {
    expect(getTimelineLength('2026-10-22', [{ dateOfLastContact: '2026-10-28' }], '2026-10-22')).toBe(21);
    expect(getTimelineLength('2026-10-22', [{ dateOfLastContact: '2026-10-28' }], '2026-11-11')).toBe(21);
    expect(getTimelineLength('2026-10-22', [{ dateOfLastContact: '2026-10-28' }], '2026-11-12')).toBe(22);
    expect(getTimelineLength('2026-10-22', [{ dateOfLastContact: '2026-10-28' }], '2026-11-17')).toBe(27);
    expect(getTimelineLength('2026-10-22', [{ dateOfLastContact: '2026-10-28' }], '2026-11-20')).toBe(27);

    const laterLength = getTimelineLength(
      '2026-10-22',
      [{ dateOfLastContact: '2026-10-28' }, { dateOfLastContact: '2026-10-30' }],
      '2026-11-19',
    );
    expect(laterLength).toBe(29);

    const timeline = buildFollowUpTimeline('2026-10-22', [{ dateOfLastContact: '2026-10-28' }], '2026-10-22');
    expect(timeline).toHaveLength(21);
    expect(timeline[0]).toMatchObject({ day: 1, date: '2026-10-22' });
    expect(timeline[6]).toMatchObject({ day: 7, date: '2026-10-28' });
  });

  it('keeps days before a contact arrives empty, today editable, and locks after 21 days', () => {
    expect(getContactFollowUpDayState('2026-10-22', '2026-10-28', 6, '2026-10-28')).toBe('notStarted');
    expect(getContactFollowUpDayState('2026-10-22', '2026-10-28', 7, '2026-10-28')).toBe('today');
    expect(getContactFollowUpDayState('2026-10-22', '2026-10-28', 8, '2026-10-28')).toBe('upcoming');
    expect(getContactFollowUpDayState('2026-10-22', '2026-10-28', 27, '2026-11-17')).toBe('today');
    expect(getContactFollowUpDayState('2026-10-22', '2026-10-28', 28, '2026-11-18')).toBe('locked');
    expect(canEditFollowUpDay('today')).toBe(true);
    expect(canEditFollowUpDay('locked')).toBe(false);
    expect(canEditFollowUpDay('notStarted')).toBe(false);
    expect(canEditFollowUpDay('past')).toBe(false);
  });

  it('keeps 27 Oct open after earlier isolation days have already been recorded', () => {
    expect(getContactFollowUpDayState('2026-10-22', '2026-10-22', 5, '2026-10-27')).toBe('past');
    expect(getContactFollowUpDayState('2026-10-22', '2026-10-22', 6, '2026-10-27')).toBe('today');
    expect(getContactFollowUpDayState('2026-10-22', '2026-10-22', 7, '2026-10-27')).toBe('upcoming');
    expect(canEditFollowUpDay(getContactFollowUpDayState('2026-10-22', '2026-10-22', 6, '2026-10-27'))).toBe(true);
    expect(canEditFollowUpDay(getContactFollowUpDayState('2026-10-22', '2026-10-22', 5, '2026-10-27'))).toBe(false);
  });

  it('puts the index patient first and merges saved marks onto listed person UUIDs', () => {
    expect(parseDisplayDateToIso('28-10-2026')).toBe('2026-10-28');
    expect(
      getPatientFollowUpBio({ name: [{ given: ['Amina'], family: 'Otieno' }], gender: 'female', age: 36 }),
    ).toEqual({
      familyName: 'Otieno',
      firstName: 'Amina',
      sex: 'female',
      age: '36',
    });

    const index = createIndexFollowUpContact({
      patientUuid: 'patient-1',
      familyName: 'Otieno',
      firstName: 'Amina',
      age: '36',
      sex: 'female',
      isolationStartDate: '2026-10-22',
    });
    const listed = mapListedContactToFollowUp({
      uuid: 'contact-person-uuid',
      surname: 'Njoroge',
      otherNames: 'Peter',
      sex: 'M',
      age: 41,
      dateofLastContact: '28-10-2026',
      phoneNumber: '0712345678',
    });
    const savedIndex = { ...index, followUpDays: normalizeFollowUpDays(['0']) };
    const savedListed = { ...listed, followUpDays: normalizeFollowUpDays(['', '', '', '', '', '', 'X']) };

    const rows = mergeFollowUpRows(index, [listed], [savedIndex, savedListed]);
    expect(rows[0].id).toBe('patient-1');
    expect(rows[0].isIndex).toBe(true);
    expect(rows[0].followUpDays[0]).toBe('0');
    expect(rows[1].id).toBe('contact-person-uuid');
    expect(rows[1].dateOfLastContact).toBe('2026-10-28');
    expect(rows[1].followUpDays[6]).toBe('X');
    expect(countFilledFollowUpContacts(rows)).toBe(1);

    const overwritten = mergeFollowUpRows(index, [listed], [savedIndex, savedListed, index, listed]);
    expect(overwritten[0].followUpDays[0]).toBe('');
    expect(
      applyCodedMarksToContacts(overwritten, [
        { contactId: 'patient-1', day: 1, mark: '0' },
        { contactId: 'contact-person-uuid', day: 7, mark: 'X' },
      ])[0].followUpDays[0],
    ).toBe('0');
  });

  it("realigns a contact's isolation days onto their own calendar when they become the index", () => {
    expect(earliestIsoDate(['2026-11-01', '2026-10-28', ''])).toBe('2026-10-28');
    const remapped = remapFollowUpDaysByDate(['', '', '', '', '', '', '0', 'X'], '2026-10-22', '2026-10-28');
    expect(remapped[0]).toBe('0');
    expect(remapped[1]).toBe('X');

    const indexC = createIndexFollowUpContact({
      patientUuid: 'contact-person-uuid',
      familyName: 'Njoroge',
      firstName: 'Peter',
      isolationStartDate: '2026-10-28',
    });
    const marked = applyCodedMarksToContacts(
      [indexC],
      [{ contactId: 'contact-person-uuid', day: 7, mark: 'X', obsDate: '2026-10-28' }],
      '2026-10-28',
    );
    expect(marked[0].followUpDays[0]).toBe('X');

    const related = historyFromRelatedPayload(
      {
        version: 1,
        status: 'submitted',
        isolationStartDate: '2026-10-22',
        contacts: [
          { ...indexC, isIndex: true, id: 'patient-1', dateOfLastContact: '2026-10-22' },
          {
            ...createEmptyFollowUpContact(),
            id: 'contact-person-uuid',
            familyName: 'Njoroge',
            firstName: 'Peter',
            dateOfLastContact: '2026-10-28',
            followUpDays: normalizeFollowUpDays(['', '', '', '', '', '', '0']),
          },
        ],
      },
      'contact-person-uuid',
    );
    expect(related?.isolationStartDate).toBe('2026-10-28');
    expect(related?.contact.followUpDays[0]).toBe('0');

    const relatedIndex = relatedIndexContactFromPayload(
      {
        version: 1,
        status: 'submitted',
        isolationStartDate: '2026-10-26',
        contacts: [
          {
            ...createIndexFollowUpContact({
              patientUuid: 'patient-a',
              familyName: 'Otieno',
              firstName: 'Amina',
              isolationStartDate: '2026-10-26',
            }),
            followUpDays: normalizeFollowUpDays(['0', '0']),
          },
          {
            ...createEmptyFollowUpContact(),
            id: 'patient-c',
            dateOfLastContact: '2026-10-23',
            followUpDays: normalizeFollowUpDays(['0', '0', '0', '0', '0']),
          },
        ],
      },
      'patient-c',
    );
    expect(relatedIndex?.id).toBe('patient-a');
    expect(relatedIndex?.isIndex).toBe(false);
    expect(relatedIndex?.dateOfLastContact).toBe('2026-10-26');
    expect(relatedIndex?.followUpDays.slice(0, 2)).toEqual(['0', '0']);

    const overlay = applyRelatedIsolationHistory(
      [
        createIndexFollowUpContact({
          patientUuid: 'patient-c',
          isolationStartDate: '2026-10-23',
        }),
        {
          ...createEmptyFollowUpContact(),
          id: 'patient-a',
          dateOfLastContact: '2026-10-23',
        },
      ],
      [relatedIndex!],
      '2026-10-23',
    );
    expect(overlay[1].dateOfLastContact).toBe('2026-10-26');
    expect(overlay[1].followUpDays[3]).toBe('0');
    expect(overlay[1].followUpDays[4]).toBe('0');
  });

  it("keeps a former index's own isolation start when they appear as a listed contact", () => {
    const indexC = createIndexFollowUpContact({
      patientUuid: 'patient-c',
      isolationStartDate: '2026-10-23',
    });
    const listedA = mapListedContactToFollowUp({
      uuid: 'patient-a',
      surname: 'Otieno',
      otherNames: 'Amina',
      dateofLastContact: '23-10-2026',
    });
    const savedA = {
      ...listedA,
      dateOfLastContact: '2026-10-26',
      followUpDays: normalizeFollowUpDays(['', '', '', '0', '0']),
    };

    const rows = mergeFollowUpRows(indexC, [listedA], [indexC, savedA]);
    expect(rows[0].dateOfLastContact).toBe('2026-10-23');
    expect(rows[1].dateOfLastContact).toBe('2026-10-26');
    expect(getIsolationStay('2026-10-23', '2026-10-27').elapsed).toBe(5);
    expect(getIsolationStay('2026-10-26', '2026-10-27').elapsed).toBe(2);
  });

  it('tracks a 21-day isolation stay from the day the contact arrived', () => {
    expect(getIsolationStay('2026-10-28', '2026-10-22')).toEqual({
      elapsed: 0,
      remaining: 21,
      complete: false,
    });
    expect(getIsolationStay('2026-10-28', '2026-10-28')).toEqual({
      elapsed: 1,
      remaining: 20,
      complete: false,
    });
    expect(getIsolationStay('2026-10-28', '2026-11-17')).toEqual({
      elapsed: 21,
      remaining: 0,
      complete: true,
    });
  });
});
