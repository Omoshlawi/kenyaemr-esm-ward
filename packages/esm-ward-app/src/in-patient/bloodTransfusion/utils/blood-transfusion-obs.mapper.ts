import {
  BLOOD_TRANSFUSION_CONCEPTS,
  TRANSFUSION_BLOOD_TYPE_ANSWERS,
  TRANSFUSION_REACTION_ANSWERS,
  type TransfusionObservationRowDef,
} from '../config/blood-transfusion.defaults';
import {
  type BackendTransfusion,
  type BloodTransfusion,
  type BloodTransfusionStore,
  type TransfusionObservation,
} from '../types/blood-transfusion.types';
import {
  addMinutesToLocal,
  nextTransfusionNumber,
  observationDueAt,
  outOfRangeVitals,
} from './blood-transfusion.utils';
import { type OpenMrsObsPayloadItem } from './openmrs-concept-metadata';
import { buildFacilityDateTime, toFacilityDate, toFacilityParts } from './timezone.utils';

export const TRANSFUSION_ROW_COMMENT_PREFIX = 'bt-row:';

const MEMBER_FIELDS: Array<[keyof TransfusionObservation, keyof typeof BLOOD_TRANSFUSION_CONCEPTS]> = [
  ['temperature', 'temperature'],
  ['pulse', 'pulse'],
  ['respiratoryRate', 'respiratoryRate'],
  ['systolic', 'systolic'],
  ['diastolic', 'diastolic'],
  ['remarks', 'remarks'],
];

export type TransfusionObsPayload = {
  concept: string;
  value?: unknown;
  obsDatetime: string;
  comment?: string;
  groupMembers?: Array<{ concept: string; value: unknown; obsDatetime: string }>;
};

export type RestTransfusionObs = {
  uuid: string;
  obsDatetime?: string;
  comment?: string | null;
  concept?: { uuid?: string };
  value?: unknown;
  groupMembers?: RestTransfusionObs[] | null;
};

export type RestTransfusionEncounter = {
  uuid: string;
  encounterDatetime?: string;
  voided?: boolean;
  obs?: RestTransfusionObs[];
};

const pad = (n: number) => String(n).padStart(2, '0');

const memberValue = (reading: TransfusionObservation | undefined, field: keyof TransfusionObservation) => {
  const value = reading?.[field];
  return typeof value === 'string' ? value.trim() : value;
};

/** Stable fingerprint of a row, used to tell whether it changed since it was last saved. Empty rows give ''. */
export function rowSignature(reading: TransfusionObservation | undefined): string {
  const values = MEMBER_FIELDS.map(([field]) => memberValue(reading, field) ?? '');
  return values.every((value) => value === '') ? '' : JSON.stringify([reading?.time ?? '', ...values]);
}

const localToMs = (local: string) => Date.parse(`${local}:00Z`);

/** Facility wall-clock `YYYY-MM-DDTHH:MM` the reading was taken at; a time just across midnight from the due time moves to that day. */
export function rowTakenAtLocal(
  row: TransfusionObservationRowDef,
  transfusion: BloodTransfusion,
  nowLocal: string,
): string {
  const reading = transfusion.observations[row.id];
  const dueAt = observationDueAt(row, transfusion);
  const date = dueAt?.slice(0, 10) ?? transfusion.transfusionDate ?? nowLocal.slice(0, 10);
  const time = reading?.time ?? dueAt?.slice(11) ?? nowLocal.slice(11, 16);
  const candidate = `${date}T${time}`;
  if (!dueAt || !reading?.time) {
    return candidate;
  }
  const minutesFromDue = (localToMs(candidate) - localToMs(dueAt)) / 60_000;
  if (minutesFromDue > 720) {
    return addMinutesToLocal(date, time, -1440) ?? candidate;
  }
  if (minutesFromDue < -720) {
    return addMinutesToLocal(date, time, 1440) ?? candidate;
  }
  return candidate;
}

/** Facility wall-clock `YYYY-MM-DDTHH:MM` → ISO instant. */
export function facilityLocalToIso(local: string, timeZone?: string): string {
  const [date, time = '00:00'] = local.split('T');
  const [hour, minute] = time.split(':').map(Number);
  return new Date(buildFacilityDateTime(date, hour, timeZone).getTime() + (minute || 0) * 60_000).toISOString();
}

/** One obs group per observation row; `null` when the row has nothing to save. */
export function buildRowGroup(
  rowId: string,
  reading: TransfusionObservation | undefined,
  obsDatetime: string,
): TransfusionObsPayload | null {
  const outOfRange = new Set<string>(outOfRangeVitals(reading));
  const groupMembers = MEMBER_FIELDS.flatMap(([field, conceptKey]) => {
    const value = memberValue(reading, field);
    return value === undefined || value === '' || outOfRange.has(field)
      ? []
      : [{ concept: BLOOD_TRANSFUSION_CONCEPTS[conceptKey], value, obsDatetime }];
  });
  if (!groupMembers.length) {
    return null;
  }
  return {
    concept: BLOOD_TRANSFUSION_CONCEPTS.observationGroup,
    obsDatetime,
    comment: `${TRANSFUSION_ROW_COMMENT_PREFIX}${rowId}`,
    groupMembers,
  };
}

const trimmed = (value: string | undefined) => value?.trim() || undefined;

/** Transfusion-level fields saved as top-level obs on the transfusion encounter. */
const HEADER_FIELDS: Array<{
  concept: string;
  label: string;
  value: (transfusion: BloodTransfusion) => string | number | undefined;
}> = [
  {
    concept: BLOOD_TRANSFUSION_CONCEPTS.transfusionDate,
    label: 'Date of blood transfusion',
    value: (transfusion) => transfusion.transfusionDate,
  },
  {
    concept: BLOOD_TRANSFUSION_CONCEPTS.bloodType,
    label: 'Type of blood transfused',
    value: (transfusion) => TRANSFUSION_BLOOD_TYPE_ANSWERS[transfusion.bloodTypes[0] ?? ''],
  },
  {
    concept: BLOOD_TRANSFUSION_CONCEPTS.bloodUnitNumber,
    label: 'Blood unit number',
    value: (transfusion) => trimmed(transfusion.donorNumber),
  },
  {
    concept: BLOOD_TRANSFUSION_CONCEPTS.counterCheckedBy,
    label: 'Counter-checked by',
    value: (transfusion) => trimmed(transfusion.counterCheckedBy),
  },
  { concept: BLOOD_TRANSFUSION_CONCEPTS.rate, label: 'Rate of transfusion', value: (transfusion) => transfusion.rate },
  {
    concept: BLOOD_TRANSFUSION_CONCEPTS.timeEnded,
    label: 'Time transfusion ended',
    value: (transfusion) => transfusion.endedTime,
  },
  {
    concept: BLOOD_TRANSFUSION_CONCEPTS.amountMl,
    label: 'Amount of blood transfused',
    value: (transfusion) => transfusion.amountMl,
  },
  {
    concept: BLOOD_TRANSFUSION_CONCEPTS.submittedBy,
    label: 'Name of the nurse/doctor/anaesthetist',
    value: (transfusion) => (transfusion.status === 'submitted' ? trimmed(transfusion.submittedBy) : undefined),
  },
];

export const HEADER_CONCEPTS = [
  ...HEADER_FIELDS.map((field) => field.concept),
  BLOOD_TRANSFUSION_CONCEPTS.timeStarted,
  BLOOD_TRANSFUSION_CONCEPTS.diagnosis,
  BLOOD_TRANSFUSION_CONCEPTS.reaction,
];

export const HEADER_LABELS = new Map([
  ...HEADER_FIELDS.map((field): [string, string] => [field.concept, field.label]),
  [BLOOD_TRANSFUSION_CONCEPTS.timeStarted, 'Time transfusion started'],
  [BLOOD_TRANSFUSION_CONCEPTS.diagnosis, 'Diagnosis'],
  [BLOOD_TRANSFUSION_CONCEPTS.reaction, 'Transfusion reaction'],
]);

/** Header obs; the reaction concept gets one obs per ticked reaction. */
export function buildHeaderObs(
  transfusion: BloodTransfusion,
  obsDatetime: string,
  timeZone?: string,
): OpenMrsObsPayloadItem[] {
  const obs: OpenMrsObsPayloadItem[] = HEADER_FIELDS.flatMap((field) => {
    const value = field.value(transfusion);
    return value === undefined || value === '' ? [] : [{ concept: field.concept, value, obsDatetime }];
  });
  if (transfusion.transfusionDate && transfusion.timeStarted) {
    obs.push({
      concept: BLOOD_TRANSFUSION_CONCEPTS.timeStarted,
      value: facilityLocalToIso(`${transfusion.transfusionDate}T${transfusion.timeStarted}`, timeZone),
      obsDatetime,
    });
  }
  const diagnosis = trimmed(transfusion.diagnosis);
  if (diagnosis) {
    obs.push({ concept: BLOOD_TRANSFUSION_CONCEPTS.diagnosis, value: diagnosis, obsDatetime });
  }
  for (const id of new Set(transfusion.reactions)) {
    const answer = TRANSFUSION_REACTION_ANSWERS[id];
    if (answer) {
      obs.push({ concept: BLOOD_TRANSFUSION_CONCEPTS.reaction, value: answer, obsDatetime });
    }
  }
  return obs;
}

/** OpenMRS returns Time obs as `1970-01-01THH:MM:SS…` in server time, keeping the wall-clock time that was sent. */
const TIME_OBS_VALUE = /^1970-01-01T(\d{2}:\d{2})/;

export function obsValueKey(value: unknown): string {
  if (value && typeof value === 'object' && 'uuid' in value) {
    return String((value as { uuid?: string }).uuid ?? '');
  }
  if (typeof value === 'string') {
    return TIME_OBS_VALUE.exec(value)?.[1] ?? value;
  }
  return typeof value === 'number' ? String(value) : String(value ?? '');
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T/;

/** Whether a saved obs value already equals the value about to be sent (dates come back with a time and offset). */
export function obsValuesMatch(saved: unknown, wanted: unknown): boolean {
  const current = obsValueKey(saved);
  const next = obsValueKey(wanted);
  if (current === next) {
    return true;
  }
  if (DATE_ONLY.test(next)) {
    return current.slice(0, 10) === next;
  }
  return DATE_TIME.test(current) && DATE_TIME.test(next) && Date.parse(current) === Date.parse(next);
}

function facilityTime(iso: string | undefined, timeZone?: string): string | undefined {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const { hour, minute } = toFacilityParts(date, timeZone);
  return `${pad(hour)}:${pad(minute)}`;
}

const toNumber = (value: unknown) => {
  const number = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(number) ? undefined : number;
};

export function mapEncounterToBackendTransfusion(
  encounter: RestTransfusionEncounter,
  timeZone?: string,
): BackendTransfusion {
  const result: BackendTransfusion = {
    encounterUuid: encounter.uuid,
    encounterDatetime: encounter.encounterDatetime ?? '',
    bloodTypes: [],
    reactions: [],
    observations: {},
  };
  const answerToType = Object.fromEntries(
    Object.entries(TRANSFUSION_BLOOD_TYPE_ANSWERS).map(([id, uuid]) => [uuid, id]),
  );
  const answerToReaction = Object.fromEntries(
    Object.entries(TRANSFUSION_REACTION_ANSWERS).map(([id, uuid]) => [uuid, id]),
  );

  for (const obs of encounter.obs ?? []) {
    const concept = obs.concept?.uuid;
    if (obs.comment?.startsWith(TRANSFUSION_ROW_COMMENT_PREFIX)) {
      const rowId = obs.comment.slice(TRANSFUSION_ROW_COMMENT_PREFIX.length);
      const reading: TransfusionObservation = { time: facilityTime(obs.obsDatetime, timeZone) };
      for (const member of obs.groupMembers ?? []) {
        const field = MEMBER_FIELDS.find(([, key]) => BLOOD_TRANSFUSION_CONCEPTS[key] === member.concept?.uuid)?.[0];
        if (field === 'remarks') {
          reading.remarks = String(member.value ?? '');
        } else if (field && field !== 'time') {
          reading[field] = toNumber(member.value);
        }
      }
      result.observations[rowId] = reading;
    } else if (concept === BLOOD_TRANSFUSION_CONCEPTS.transfusionDate) {
      result.transfusionDate = obsValueKey(obs.value).slice(0, 10) || undefined;
    } else if (concept === BLOOD_TRANSFUSION_CONCEPTS.bloodType) {
      const type = answerToType[obsValueKey(obs.value)];
      result.bloodTypes = type ? [type] : [];
    } else if (concept === BLOOD_TRANSFUSION_CONCEPTS.bloodUnitNumber) {
      result.donorNumber = obsValueKey(obs.value) || undefined;
    } else if (concept === BLOOD_TRANSFUSION_CONCEPTS.counterCheckedBy) {
      result.counterCheckedBy = obsValueKey(obs.value) || undefined;
    } else if (concept === BLOOD_TRANSFUSION_CONCEPTS.rate) {
      result.rate = toNumber(obs.value);
    } else if (concept === BLOOD_TRANSFUSION_CONCEPTS.timeEnded) {
      result.endedTime = TIME_OBS_VALUE.exec(String(obs.value ?? ''))?.[1];
    } else if (concept === BLOOD_TRANSFUSION_CONCEPTS.amountMl) {
      result.amountMl = toNumber(obs.value);
    } else if (concept === BLOOD_TRANSFUSION_CONCEPTS.timeStarted) {
      result.timeStarted = facilityTime(obsValueKey(obs.value), timeZone);
    } else if (concept === BLOOD_TRANSFUSION_CONCEPTS.diagnosis) {
      result.diagnosis = obsValueKey(obs.value) || undefined;
    } else if (concept === BLOOD_TRANSFUSION_CONCEPTS.reaction) {
      const reaction = answerToReaction[obsValueKey(obs.value)];
      if (reaction && !result.reactions.includes(reaction)) {
        result.reactions.push(reaction);
      }
    }
  }
  return result;
}

/** Maps one OpenMRS transfusion encounter into the chart model. */
export function backendTransfusionToRecord(
  remote: BackendTransfusion,
  existing: BloodTransfusion[],
  timeZone?: string,
): BloodTransfusion {
  const started = new Date(remote.encounterDatetime);
  const valid = !Number.isNaN(started.getTime());
  const date = valid ? toFacilityDate(started, timeZone) : undefined;
  const submitted = Boolean(remote.endedTime && remote.amountMl != null && remote.bloodTypes.length);
  return {
    id: `transfusion-${remote.encounterUuid}`,
    number: nextTransfusionNumber({ transfusions: existing }, remote.transfusionDate ?? date ?? ''),
    status: submitted ? 'submitted' : 'draft',
    transfusionDate: remote.transfusionDate ?? date,
    transfusionTime: valid ? facilityTime(remote.encounterDatetime, timeZone) : undefined,
    timeStarted: remote.timeStarted,
    diagnosis: remote.diagnosis,
    bloodTypes: remote.bloodTypes,
    donorNumber: remote.donorNumber,
    counterCheckedBy: remote.counterCheckedBy,
    rate: remote.rate,
    rateUnit: 'mlPerMin',
    endedTime: remote.endedTime,
    amountMl: remote.amountMl,
    observations: remote.observations,
    reactions: remote.reactions,
    createdAt: valid ? started.toISOString() : new Date().toISOString(),
    updatedAt: valid ? started.toISOString() : new Date().toISOString(),
    encounterUuid: remote.encounterUuid,
    syncedRows: Object.fromEntries(
      Object.entries(remote.observations).map(([rowId, reading]) => [rowId, rowSignature(reading)]),
    ),
  };
}

/**
 * Builds the chart store from OpenMRS only, keeping unsaved in-memory drafts
 * (records that do not yet have an encounterUuid).
 */
export function storeFromBackendTransfusions(
  backend: BackendTransfusion[],
  localDrafts: BloodTransfusion[] = [],
  timeZone?: string,
): BloodTransfusionStore {
  const fromBackend: BloodTransfusion[] = [];
  for (const remote of backend) {
    fromBackend.push(backendTransfusionToRecord(remote, fromBackend, timeZone));
  }
  const unsaved = localDrafts.filter((item) => !item.encounterUuid);
  return { transfusions: [...fromBackend, ...unsaved] };
}

/**
 * Folds OpenMRS transfusions into the in-memory store without dropping unsaved drafts.
 * Prefer `storeFromBackendTransfusions` when OpenMRS is the source of truth.
 */
export function mergeBackendTransfusions(
  store: BloodTransfusionStore,
  backend: BackendTransfusion[],
  timeZone?: string,
): BloodTransfusionStore | null {
  const next = storeFromBackendTransfusions(
    backend,
    store.transfusions.filter((item) => !item.encounterUuid),
    timeZone,
  );
  const same =
    next.transfusions.length === store.transfusions.length &&
    next.transfusions.every((item, index) => {
      const current = store.transfusions[index];
      return (
        current &&
        current.id === item.id &&
        current.encounterUuid === item.encounterUuid &&
        JSON.stringify(current.syncedRows ?? {}) === JSON.stringify(item.syncedRows ?? {}) &&
        JSON.stringify(current.observations) === JSON.stringify(item.observations)
      );
    });
  return same ? null : next;
}
