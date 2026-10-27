import { formatDate, parseDate } from '@openmrs/esm-framework';

export const FOLLOW_UP_DAY_COUNT = 21;
export const FOLLOW_UP_PAGE_SIZE = 10;
export const FOLLOW_UP_PAYLOAD_PREFIX = '__EBOLA_FOLLOWUP__:';
export const FOLLOW_UP_MARK_YES = '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const FOLLOW_UP_MARK_NO = '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERSON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FollowUpMark = '' | '0' | 'X';
export type FollowUpSex = '' | 'M' | 'F';
export type FollowUpSaveStatus = 'draft' | 'submitted';
export type FollowUpProgressStatus = '' | 'pending' | 'active';

export type FollowUpContact = {
  id: string;
  cn: string;
  mobile: string;
  familyName: string;
  firstName: string;
  age: string;
  sex: FollowUpSex;
  dateOfLastContact: string;
  followUpStatus: FollowUpProgressStatus;
  followUpDays: FollowUpMark[];
  isIndex?: boolean;
};

export type FollowUpFormPayload = {
  version: 1;
  status: FollowUpSaveStatus;
  isolationStartDate?: string;
  contacts: FollowUpContact[];
};

export const markToCodedValue = (
  mark: FollowUpMark,
  yesConcept = FOLLOW_UP_MARK_YES,
  noConcept = FOLLOW_UP_MARK_NO,
) => {
  if (mark === '0') {
    return yesConcept;
  }
  if (mark === 'X') {
    return noConcept;
  }
  return '';
};

export const codedValueToMark = (
  value?: string | null,
  yesConcept = FOLLOW_UP_MARK_YES,
  noConcept = FOLLOW_UP_MARK_NO,
): FollowUpMark => {
  if (value === '0' || value === yesConcept) {
    return '0';
  }
  if (value === 'X' || value === noConcept) {
    return 'X';
  }
  return '';
};

export const isFollowUpPersonUuid = (value?: string) => Boolean(value && PERSON_UUID.test(value));

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `contact-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createEmptyFollowUpDays = (length = FOLLOW_UP_DAY_COUNT): FollowUpMark[] =>
  Array.from({ length }, () => '');

export const normalizeFollowUpStatus = (status?: string | null): FollowUpProgressStatus => {
  if (status === 'pending' || status === 'active') {
    return status;
  }
  return '';
};

export const createEmptyFollowUpContact = (): FollowUpContact => ({
  id: createId(),
  cn: '',
  mobile: '',
  familyName: '',
  firstName: '',
  age: '',
  sex: '',
  dateOfLastContact: '',
  followUpStatus: '',
  followUpDays: createEmptyFollowUpDays(),
  isIndex: false,
});

export const isFollowUpContactFilled = (contact: FollowUpContact) =>
  Boolean(
    contact.cn.trim() ||
    contact.mobile.trim() ||
    contact.familyName.trim() ||
    contact.firstName.trim() ||
    contact.age ||
    contact.sex ||
    contact.dateOfLastContact ||
    contact.followUpDays.some(Boolean),
  );

export const countFilledFollowUpContacts = (contacts: FollowUpContact[]) =>
  contacts.filter((contact) => !contact.isIndex && isFollowUpContactFilled(contact)).length;

export type ListedFollowUpSource = {
  uuid: string;
  surname?: string;
  otherNames?: string;
  sex?: string;
  age?: number;
  dateofLastContact?: string;
  phoneNumber?: string;
};

export const getPatientFollowUpBio = (patient?: {
  name?: Array<{ family?: string; given?: string[] }>;
  gender?: string;
  birthDate?: string;
  birthdate?: string;
  age?: number;
  person?: {
    preferredName?: { familyName?: string; givenName?: string; middleName?: string };
    gender?: string;
    age?: number;
    birthdate?: string;
  };
  preferredName?: { familyName?: string; givenName?: string; middleName?: string };
}) => {
  const fhirName = patient?.name?.[0];
  const preferred = patient?.person?.preferredName ?? patient?.preferredName;
  const familyName = fhirName?.family ?? preferred?.familyName ?? '';
  const firstName =
    fhirName?.given?.filter(Boolean).join(' ') ||
    [preferred?.givenName, preferred?.middleName].filter(Boolean).join(' ');
  const birthDate = patient?.birthDate ?? patient?.birthdate ?? patient?.person?.birthdate;
  const age = patient?.age ?? patient?.person?.age;
  return {
    familyName,
    firstName,
    sex: patient?.gender ?? patient?.person?.gender ?? '',
    age: age != null ? String(age) : ageFromBirthDate(birthDate),
  };
};

const ageFromBirthDate = (birthDate?: string) => {
  if (!birthDate) {
    return '';
  }
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return String(Math.max(age, 0));
};

export const normalizeFollowUpDays = (
  days?: Array<string | FollowUpMark> | null,
  length = FOLLOW_UP_DAY_COUNT,
): FollowUpMark[] => {
  const source = days ?? [];
  const next = createEmptyFollowUpDays(Math.max(length, source.length));
  source.forEach((mark, index) => {
    next[index] = codedValueToMark(mark);
  });
  return next;
};

export const padFollowUpDays = (days: FollowUpMark[] | undefined, length: number): FollowUpMark[] =>
  normalizeFollowUpDays(days, length);

export const cloneFollowUpContacts = (contacts: FollowUpContact[]): FollowUpContact[] =>
  contacts.map((contact) => ({
    ...contact,
    followUpDays: [...contact.followUpDays],
  }));

export const parseFollowUpPayload = (value: unknown): FollowUpFormPayload | null => {
  const raw = typeof value === 'string' ? value : '';
  if (!raw.startsWith(FOLLOW_UP_PAYLOAD_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw.slice(FOLLOW_UP_PAYLOAD_PREFIX.length)) as FollowUpFormPayload;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.contacts)) {
      return null;
    }

    return {
      version: 1,
      status: parsed.status === 'submitted' ? 'submitted' : 'draft',
      isolationStartDate: ISO_DATE.test(parsed.isolationStartDate ?? '') ? parsed.isolationStartDate : '',
      contacts: parsed.contacts.map((contact) => ({
        ...createEmptyFollowUpContact(),
        ...contact,
        id: contact.id || createId(),
        followUpStatus: normalizeFollowUpStatus(contact.followUpStatus),
        followUpDays: normalizeFollowUpDays(contact.followUpDays),
      })),
    };
  } catch {
    return null;
  }
};

export const serializeFollowUpPayload = (payload: FollowUpFormPayload) =>
  `${FOLLOW_UP_PAYLOAD_PREFIX}${JSON.stringify(payload)}`;

export type FollowUpMarkObs = {
  person: string;
  concept: string;
  value: string;
  obsDatetime: string;
  comment?: string;
  uuid?: string;
  voided?: boolean;
};

export type FollowUpStoredMark = {
  contactId: string;
  day: number;
  mark: FollowUpMark;
  obsDate?: string;
  obsUuid?: string;
};

export const storedFollowUpMarkKey = (contactId: string, obsDate?: string, day?: number) =>
  `${contactId}:${obsDate || day || ''}`;

export const parseFollowUpMarkComment = (comment?: string | null) => {
  const match = comment?.match(/^(?:index|contact):([^:]+):day:(\d+)$/);
  if (!match) {
    return null;
  }
  return { contactId: match[1], day: Number(match[2]) };
};

export const earliestIsoDate = (values: Array<string | undefined | null>) => {
  const dates = values.filter((value): value is string => Boolean(value && ISO_DATE.test(value))).sort();
  return dates[0] ?? '';
};

export const remapFollowUpDaysByDate = (
  days: Array<FollowUpMark | string> | undefined,
  sourceIsolationStart: string,
  targetIsolationStart: string,
): FollowUpMark[] => {
  const source = normalizeFollowUpDays(days);
  if (
    !ISO_DATE.test(sourceIsolationStart) ||
    !ISO_DATE.test(targetIsolationStart) ||
    sourceIsolationStart === targetIsolationStart
  ) {
    return source;
  }

  const next = createEmptyFollowUpDays();
  source.forEach((mark, index) => {
    if (!mark) {
      return;
    }
    const date = getTimelineDayDate(sourceIsolationStart, index + 1);
    const targetDay = date ? getTimelineDayNumber(targetIsolationStart, date) : null;
    if (!targetDay || targetDay < 1) {
      return;
    }
    while (next.length < targetDay) {
      next.push('');
    }
    next[targetDay - 1] = mark;
  });
  return next;
};

export const historyFromRelatedPayload = (payload: FollowUpFormPayload, patientUuid: string) => {
  const contact = payload.contacts.find((row) => row.id === patientUuid);
  if (!contact) {
    return null;
  }
  const isolationStartDate = contact.dateOfLastContact || payload.isolationStartDate || '';
  return {
    isolationStartDate,
    contact: {
      ...contact,
      isIndex: true,
      dateOfLastContact: isolationStartDate,
      followUpDays: remapFollowUpDaysByDate(
        contact.followUpDays,
        payload.isolationStartDate || isolationStartDate,
        isolationStartDate,
      ),
    },
  };
};

export const relatedIndexContactFromPayload = (payload: FollowUpFormPayload, currentPatientUuid: string) => {
  const index = payload.contacts.find((row) => row.isIndex && row.id !== currentPatientUuid);
  if (!index) {
    return null;
  }
  const isolationStartDate = payload.isolationStartDate || index.dateOfLastContact || '';
  return {
    ...index,
    isIndex: false,
    dateOfLastContact: isolationStartDate,
    followUpDays: remapFollowUpDaysByDate(
      index.followUpDays,
      payload.isolationStartDate || isolationStartDate,
      isolationStartDate,
    ),
  };
};

export const applyRelatedIsolationHistory = (
  contacts: FollowUpContact[],
  relatedIndexes: FollowUpContact[],
  targetIsolationStart: string,
) => {
  const relatedById = new Map(relatedIndexes.map((contact) => [contact.id, contact]));
  const next = contacts.map((contact) => {
    const related = relatedById.get(contact.id);
    if (!related || contact.isIndex) {
      return contact;
    }
    const ownStart = related.dateOfLastContact || contact.dateOfLastContact;
    return {
      ...contact,
      dateOfLastContact: ownStart,
      followUpDays: remapFollowUpDaysByDate(
        related.followUpDays.some(Boolean) ? related.followUpDays : contact.followUpDays,
        ownStart,
        targetIsolationStart || ownStart,
      ),
    };
  });
  const existingIds = new Set(next.map((contact) => contact.id));
  relatedIndexes.forEach((related) => {
    if (existingIds.has(related.id)) {
      return;
    }
    existingIds.add(related.id);
    next.push({
      ...related,
      isIndex: false,
      followUpDays: remapFollowUpDaysByDate(
        related.followUpDays,
        related.dateOfLastContact,
        targetIsolationStart || related.dateOfLastContact,
      ),
    });
  });
  return next;
};

export const applyCodedMarksToContacts = (
  contacts: FollowUpContact[],
  storedMarks: FollowUpStoredMark[],
  isolationStartDate?: string,
): FollowUpContact[] => {
  if (!storedMarks.length) {
    return contacts;
  }

  const next = cloneFollowUpContacts(contacts);
  const byId = new Map(next.map((contact) => [contact.id, contact]));
  storedMarks.forEach(({ contactId, day, mark, obsDate }) => {
    const contact = byId.get(contactId);
    if (!contact || !mark) {
      return;
    }
    const mappedDay =
      obsDate && isolationStartDate && ISO_DATE.test(isolationStartDate)
        ? getTimelineDayNumber(isolationStartDate, obsDate)
        : day;
    if (!mappedDay || mappedDay < 1) {
      return;
    }
    const followUpDays = padFollowUpDays(contact.followUpDays, Math.max(contact.followUpDays.length, mappedDay));
    followUpDays[mappedDay - 1] = mark;
    contact.followUpDays = followUpDays;
  });
  return next;
};

export const buildFollowUpMarkObs = (
  contacts: FollowUpContact[],
  timeline: FollowUpTimelineDay[],
  markConcept: string,
  yesConcept = FOLLOW_UP_MARK_YES,
  noConcept = FOLLOW_UP_MARK_NO,
  options?: {
    isolationStartDate?: string;
    today?: string;
    existingMarks?: FollowUpStoredMark[];
    onlyOpenDays?: boolean;
  },
): FollowUpMarkObs[] => {
  if (!markConcept) {
    return [];
  }

  const existingByKey = new Map<string, FollowUpStoredMark>();
  (options?.existingMarks ?? []).forEach((mark) => {
    existingByKey.set(storedFollowUpMarkKey(mark.contactId, mark.obsDate, mark.day), mark);
    if (mark.obsDate) {
      existingByKey.set(storedFollowUpMarkKey(mark.contactId, mark.obsDate), mark);
    }
  });

  return contacts.flatMap((contact) => {
    if (!isFollowUpPersonUuid(contact.id)) {
      return [];
    }

    return timeline.flatMap((column, index) => {
      if (!column.date) {
        return [];
      }
      const state = getContactFollowUpDayState(
        options?.isolationStartDate || column.date,
        contact.dateOfLastContact,
        column.day,
        options?.today,
      );
      if (options?.onlyOpenDays && !canEditFollowUpDay(state)) {
        return [];
      }

      const mark = contact.followUpDays[index] ?? '';
      const value = markToCodedValue(mark, yesConcept, noConcept);
      const existing =
        existingByKey.get(storedFollowUpMarkKey(contact.id, column.date)) ??
        existingByKey.get(storedFollowUpMarkKey(contact.id, undefined, column.day));
      if (!value) {
        if (!existing?.obsUuid) {
          return [];
        }
        return [
          {
            person: contact.id,
            concept: markConcept,
            value: '',
            obsDatetime: `${column.date}T12:00:00.000`,
            comment: `${contact.isIndex ? 'index' : 'contact'}:${contact.id}:day:${column.day}`,
            uuid: existing.obsUuid,
            voided: true,
          },
        ];
      }
      return [
        {
          person: contact.id,
          concept: markConcept,
          value,
          obsDatetime: `${column.date}T12:00:00.000`,
          comment: `${contact.isIndex ? 'index' : 'contact'}:${contact.id}:day:${column.day}`,
          ...(existing?.obsUuid ? { uuid: existing.obsUuid } : {}),
        },
      ];
    });
  });
};

export const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toLocalIsoDateFromDatetime = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return toLocalIsoDate(date);
};

export const toDisplayDate = (isoDate?: string) =>
  isoDate ? formatDate(parseDate(isoDate), { time: false, noToday: true }) : '';

export const addDaysToIsoDate = (isoDate: string, days: number) => {
  if (!ISO_DATE.test(isoDate)) {
    return null;
  }
  const [year, month, day] = isoDate.split('-').map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  return toLocalIsoDate(next);
};

export const diffIsoDays = (from: string, to: string) => {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return null;
  }
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const start = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const end = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((end - start) / 86_400_000);
};

export const getTimelineDayDate = (isolationStartDate: string, day: number) =>
  addDaysToIsoDate(isolationStartDate, day - 1);

export const getTimelineDayNumber = (isolationStartDate: string, isoDate: string) => {
  const diff = diffIsoDays(isolationStartDate, isoDate);
  if (diff === null) {
    return null;
  }
  return diff + 1;
};

export type FollowUpTimelineDay = {
  day: number;
  date: string;
};

export const getTimelineLength = (
  isolationStartDate: string,
  contacts: Array<{ dateOfLastContact?: string }>,
  today = toLocalIsoDate(new Date()),
) => {
  if (!ISO_DATE.test(isolationStartDate)) {
    return FOLLOW_UP_DAY_COUNT;
  }

  const todayDay = getTimelineDayNumber(isolationStartDate, today) ?? 0;
  if (todayDay <= FOLLOW_UP_DAY_COUNT) {
    return FOLLOW_UP_DAY_COUNT;
  }

  const stayEnds = contacts
    .map((contact) =>
      contact.dateOfLastContact
        ? getTimelineDayNumber(
            isolationStartDate,
            addDaysToIsoDate(contact.dateOfLastContact, FOLLOW_UP_DAY_COUNT - 1) ?? '',
          )
        : null,
    )
    .filter((day): day is number => typeof day === 'number');
  const lastStayEnd = stayEnds.length ? Math.max(FOLLOW_UP_DAY_COUNT, ...stayEnds) : FOLLOW_UP_DAY_COUNT;
  return Math.max(FOLLOW_UP_DAY_COUNT, Math.min(todayDay, lastStayEnd));
};

export const buildFollowUpTimeline = (
  isolationStartDate: string,
  contacts: Array<{ dateOfLastContact?: string }>,
  today = toLocalIsoDate(new Date()),
): FollowUpTimelineDay[] => {
  const length = getTimelineLength(isolationStartDate, contacts, today);
  return Array.from({ length }, (_, index) => {
    const day = index + 1;
    return {
      day,
      date: getTimelineDayDate(isolationStartDate, day) ?? '',
    };
  });
};

export type IsolationStay = {
  elapsed: number;
  remaining: number;
  complete: boolean;
};

export const getIsolationStay = (contactStartDate: string, today = toLocalIsoDate(new Date())): IsolationStay => {
  if (!ISO_DATE.test(contactStartDate)) {
    return { elapsed: 0, remaining: FOLLOW_UP_DAY_COUNT, complete: false };
  }
  if (today < contactStartDate) {
    return { elapsed: 0, remaining: FOLLOW_UP_DAY_COUNT, complete: false };
  }
  const elapsed = Math.min(FOLLOW_UP_DAY_COUNT, (diffIsoDays(contactStartDate, today) ?? 0) + 1);
  return {
    elapsed,
    remaining: FOLLOW_UP_DAY_COUNT - elapsed,
    complete: elapsed >= FOLLOW_UP_DAY_COUNT,
  };
};

export type FollowUpDayState = 'unavailable' | 'notStarted' | 'upcoming' | 'today' | 'past' | 'locked';

export const getContactFollowUpDayState = (
  isolationStartDate: string,
  contactStartDate: string,
  timelineDay: number,
  today = toLocalIsoDate(new Date()),
): FollowUpDayState => {
  const dayDate = getTimelineDayDate(isolationStartDate, timelineDay);
  if (!dayDate || !ISO_DATE.test(contactStartDate)) {
    return 'unavailable';
  }
  if (dayDate < contactStartDate) {
    return 'notStarted';
  }
  const isolationDay = (diffIsoDays(contactStartDate, dayDate) ?? 0) + 1;
  if (isolationDay > FOLLOW_UP_DAY_COUNT) {
    return 'locked';
  }
  if (dayDate > today) {
    return 'upcoming';
  }
  if (dayDate < today) {
    return 'past';
  }
  return 'today';
};

export const canEditFollowUpDay = (state: FollowUpDayState) => state === 'today';

export const parseDisplayDateToIso = (value?: string) => {
  if (!value) {
    return '';
  }
  if (ISO_DATE.test(value)) {
    return value;
  }
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) {
    return toLocalIsoDateFromDatetime(value);
  }
  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export const normalizeFollowUpSex = (value?: string): FollowUpSex => {
  const sex = (value ?? '').trim().toLowerCase();
  if (sex.startsWith('m')) {
    return 'M';
  }
  if (sex.startsWith('f')) {
    return 'F';
  }
  return '';
};

export const createIndexFollowUpContact = ({
  patientUuid,
  familyName,
  firstName,
  age,
  sex,
  isolationStartDate,
}: {
  patientUuid: string;
  familyName?: string;
  firstName?: string;
  age?: string;
  sex?: string;
  isolationStartDate: string;
}): FollowUpContact => ({
  id: patientUuid,
  cn: 'Index',
  mobile: '',
  familyName: familyName ?? '',
  firstName: firstName ?? '',
  age: age ?? '',
  sex: normalizeFollowUpSex(sex),
  dateOfLastContact: isolationStartDate,
  followUpStatus: 'active',
  followUpDays: createEmptyFollowUpDays(),
  isIndex: true,
});

export const mergeFollowUpRows = (
  index: FollowUpContact | null,
  listed: FollowUpContact[],
  saved: FollowUpContact[],
): FollowUpContact[] => {
  const savedById = new Map(saved.map((contact) => [contact.id, contact]));
  const applySaved = (row: FollowUpContact): FollowUpContact => {
    const previous = savedById.get(row.id);
    if (!previous) {
      return row;
    }
    return {
      ...row,
      dateOfLastContact: row.isIndex ? row.dateOfLastContact : previous.dateOfLastContact || row.dateOfLastContact,
      followUpDays: padFollowUpDays(
        previous.followUpDays,
        Math.max(row.followUpDays.length, previous.followUpDays.length),
      ),
      followUpStatus: previous.followUpStatus || row.followUpStatus,
    };
  };

  const listedIds = new Set(listed.map((contact) => contact.id));
  const extras = saved.filter((contact) => !contact.isIndex && contact.id !== index?.id && !listedIds.has(contact.id));

  return [...(index ? [applySaved(index)] : []), ...listed.map(applySaved), ...extras];
};

export const mapListedContactToFollowUp = (contact: ListedFollowUpSource): FollowUpContact => ({
  id: contact.uuid,
  cn: '',
  mobile: contact.phoneNumber ?? '',
  familyName: contact.surname ?? '',
  firstName: contact.otherNames ?? '',
  age: contact.age != null ? String(contact.age) : '',
  sex: normalizeFollowUpSex(contact.sex),
  dateOfLastContact: parseDisplayDateToIso(contact.dateofLastContact),
  followUpStatus: contact.dateofLastContact ? 'active' : 'pending',
  followUpDays: createEmptyFollowUpDays(),
  isIndex: false,
});
