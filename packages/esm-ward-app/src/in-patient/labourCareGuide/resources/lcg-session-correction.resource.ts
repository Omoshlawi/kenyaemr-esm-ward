import { getPatientName, openmrsFetch, restBaseUrl, toOmrsIsoString, useSession } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useMemo } from 'react';
import type { TFunction } from 'react-i18next';
import {
  ENCOUNTER_ROLE,
  LCG_CORRECTION_ENCOUNTER_TYPE_UUID,
  LCG_CORRECTION_SOURCE_PATIENT_DISPLAY_CONCEPT,
  LCG_CORRECTION_SOURCE_PATIENT_UUID_CONCEPT,
  LCG_CORRECTION_SOURCE_TERMINATE_ENCOUNTER_UUID_CONCEPT,
  LCG_CORRECTION_TERMINATED_AT_CONCEPT,
  LCG_CORRECTION_TERMINATION_REASON_CONCEPT,
  LCG_CORRECTION_TRANSFER_NOTES_CONCEPT,
  LCG_CORRECTION_TYPE_CONCEPT_UUID,
  LCG_CORRECTION_TYPE_WRONG_PATIENT_TRANSFER_CONCEPT_UUID,
  LCG_TERMINATION_REASON_TYPE_CONCEPT_UUID,
  LCG_TERMINATION_REASON_WRONG_PATIENT_CONCEPT_UUID,
  MCH_PARTOGRAPHY_ENCOUNTER_UUID,
  PARTOGRAPHY_GRAPH_TYPES,
  TIMER_SLOT_CONCEPT_UUID,
} from '../types';
import type { SharedDecisionMakingEntry } from './shared-decision-making.resource';
import { isTerminateOngoingProgressAction, normalizeLcgConceptKey, readObsValue } from '../labour-care-guide.utils';
import {
  clearLcgLocalStorageForPatient,
  copyLcgLocalStorageBetweenPatients,
  getLcgCorrectionAuditForPatient,
  hasLocalLcgSessionData,
  markLcgSessionTransferredAway,
  saveLcgCorrectionAuditForPatient,
  type StoredLcgCorrectionAuditRecord,
} from '../storage/lcg-local-storage';

const parseOpenmrsDateTimeMs = (value?: string): number | null => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/(\+\d{2})(\d{2})$/, '$1:$2');
  const parsed = new Date(normalized);
  const timeMs = parsed.getTime();
  return Number.isFinite(timeMs) ? timeMs : null;
};

const toOpenmrsDateTimeString = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

const formatOpenmrsObsDateTimeValue = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  const timeMs = parseOpenmrsDateTimeMs(value);
  if (timeMs === null) {
    return null;
  }

  return toOpenmrsDateTimeString(new Date(timeMs));
};

const normalizeCloneObsValue = (value: unknown): unknown => {
  if (value && typeof value === 'object' && 'uuid' in (value as object)) {
    return (value as { uuid?: string }).uuid ?? value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value) || /[+-]\d{2}:?\d{2}$/.test(value)) {
    return formatOpenmrsObsDateTimeValue(value) ?? value;
  }

  return value;
};

export type LcgSessionTerminationState = {
  encounterUuid: string;
  time?: string;
  encounterDatetime: string;
  terminationReasonType?: string;
  terminationReasonTypeUuid?: string;
  terminationReasonText?: string;
  isWrongPatientReason: boolean;
};

export type LcgCorrectionAuditRecord = {
  encounterUuid: string;
  encounterDatetime: string;
  sourcePatientUuid: string;
  sourcePatientDisplay: string;
  sourceTerminateEncounterUuid: string;
  terminationReason: string;
  terminatedAt?: string;
  transferNotes?: string;
};

export type LcgEligibleCorrectionPatient = {
  uuid: string;
  displayName: string;
  identifier: string;
  age?: string | number;
  gender?: string;
};

const VOID_REASON = 'Entered in error: wrong patient selection';
const LCG_SHARED_DECISION_ENCOUNTER_TYPE_UUID = '022d62af-e2a5-4282-953b-52dd5cba3296';

const encounterListRepresentation =
  'custom:(uuid,encounterDatetime,voided,encounterType:(uuid),obs:(uuid,voided,concept:(uuid,display),value:(uuid,display),obsDatetime))';

const normalizeConceptUuidKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '');

const readObsCodedUuid = (obs: any): string => {
  const value = obs?.value;
  if (value && typeof value === 'object' && typeof value.uuid === 'string') {
    return value.uuid;
  }
  return readObsValue(obs);
};

const findObsByConcept = (observations: any[], conceptUuid: string) => {
  const targetKey = normalizeConceptUuidKey(conceptUuid);
  return observations.find((item) => normalizeConceptUuidKey(item?.concept?.uuid) === targetKey);
};

const isWrongPatientTransferCorrectionType = (rawValue: string, codedUuid?: string) => {
  const targetKey = normalizeConceptUuidKey(LCG_CORRECTION_TYPE_WRONG_PATIENT_TRANSFER_CONCEPT_UUID);
  const candidates = [rawValue, codedUuid].filter(Boolean).map((value) => normalizeConceptUuidKey(value));

  if (candidates.some((candidate) => candidate === targetKey)) {
    return true;
  }

  const text = normalizeLcgConceptKey(rawValue);
  return (
    text.includes('wrong patient') ||
    text.includes('wrong chart') ||
    text.includes('patient transfer') ||
    text.includes('transfer')
  );
};

export function parseCorrectionAuditEncounter(encounter: any): LcgCorrectionAuditRecord | null {
  if (!encounter || encounter.voided) {
    return null;
  }

  const obs = getActiveObs(encounter);
  const readObs = (conceptUuid: string) => {
    const match = findObsByConcept(obs, conceptUuid);
    return match ? readObsValue(match) : '';
  };
  const readObsUuid = (conceptUuid: string) => {
    const match = findObsByConcept(obs, conceptUuid);
    return match ? readObsCodedUuid(match) : '';
  };

  const correctionTypeObs = findObsByConcept(obs, LCG_CORRECTION_TYPE_CONCEPT_UUID);
  const correctionType = correctionTypeObs ? readObsValue(correctionTypeObs) : '';
  const correctionTypeUuid = correctionTypeObs ? readObsCodedUuid(correctionTypeObs) : '';
  const encounterTypeUuid = encounter?.encounterType?.uuid ?? '';
  const isCorrectionEncounterType =
    normalizeConceptUuidKey(encounterTypeUuid) === normalizeConceptUuidKey(LCG_CORRECTION_ENCOUNTER_TYPE_UUID);
  const isWrongPatientTransfer =
    isWrongPatientTransferCorrectionType(correctionType, correctionTypeUuid) || isCorrectionEncounterType;

  const record: LcgCorrectionAuditRecord = {
    encounterUuid: encounter.uuid,
    encounterDatetime: encounter.encounterDatetime,
    sourcePatientUuid: readObs(LCG_CORRECTION_SOURCE_PATIENT_UUID_CONCEPT),
    sourcePatientDisplay: readObs(LCG_CORRECTION_SOURCE_PATIENT_DISPLAY_CONCEPT),
    sourceTerminateEncounterUuid: readObs(LCG_CORRECTION_SOURCE_TERMINATE_ENCOUNTER_UUID_CONCEPT),
    terminationReason: readObs(LCG_CORRECTION_TERMINATION_REASON_CONCEPT),
    terminatedAt: readObs(LCG_CORRECTION_TERMINATED_AT_CONCEPT) || undefined,
    transferNotes: readObs(LCG_CORRECTION_TRANSFER_NOTES_CONCEPT) || undefined,
  };

  if (!isWrongPatientTransfer && !isValidCorrectionAuditRecord(record)) {
    return null;
  }

  return isValidCorrectionAuditRecord(record) ? record : null;
}

const buildStoredCorrectionAuditRecord = (payload: {
  sourcePatientUuid: string;
  sourcePatientDisplay: string;
  sourceTerminateEncounterUuid: string;
  terminationReason: string;
  terminatedAt?: string;
  transferNotes?: string;
  encounterUuid?: string;
  encounterDatetime?: string;
}): StoredLcgCorrectionAuditRecord => ({
  encounterUuid: payload.encounterUuid ?? '',
  encounterDatetime: payload.encounterDatetime ?? payload.terminatedAt ?? new Date().toISOString(),
  sourcePatientUuid: payload.sourcePatientUuid,
  sourcePatientDisplay: payload.sourcePatientDisplay,
  sourceTerminateEncounterUuid: payload.sourceTerminateEncounterUuid,
  terminationReason: payload.terminationReason,
  terminatedAt: payload.terminatedAt,
  transferNotes: payload.transferNotes,
});

const getActiveObs = (encounter: any) =>
  (Array.isArray(encounter?.obs) ? encounter.obs : []).filter((obs: any) => !obs?.voided);

const isLabourTimeSetEncounter = (encounter: any) => {
  if (encounter?.encounterType?.uuid !== MCH_PARTOGRAPHY_ENCOUNTER_UUID) {
    return false;
  }

  const obs = getActiveObs(encounter);
  if (obs.length !== 1 || obs[0]?.concept?.uuid !== TIMER_SLOT_CONCEPT_UUID) {
    return false;
  }

  const value = String(obs[0]?.value ?? '').trim();
  return /^Time:\s*\d{1,2}:\d{2}$/i.test(value);
};

const isLcgCorrectionAuditEncounter = (encounter: any) =>
  encounter?.encounterType?.uuid === LCG_CORRECTION_ENCOUNTER_TYPE_UUID;

const isLcgManagedEncounter = (encounter: any) => {
  if (isLcgCorrectionAuditEncounter(encounter)) {
    return false;
  }

  return (
    encounter?.encounterType?.uuid === MCH_PARTOGRAPHY_ENCOUNTER_UUID ||
    encounter?.encounterType?.uuid === LCG_SHARED_DECISION_ENCOUNTER_TYPE_UUID
  );
};

const ADMISSION_PREP_MS = 60 * 60 * 1000;

async function fetchPatientAdmissionStartMs(patientUuid: string): Promise<number | null> {
  try {
    const emrapiResponse = await openmrsFetch(
      `${restBaseUrl}/emrapi/inpatient/admission?patients=${patientUuid}&v=custom:(firstAdmissionOrTransferEncounter:(encounterDatetime))`,
    );
    if (emrapiResponse.ok) {
      const payload = await emrapiResponse.json();
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const admissionDatetime = results[0]?.firstAdmissionOrTransferEncounter?.encounterDatetime;
      const admissionMs = parseOpenmrsDateTimeMs(admissionDatetime);
      if (admissionMs !== null) {
        return admissionMs;
      }
    }

    const visitResponse = await openmrsFetch(
      `${restBaseUrl}/visit?patient=${patientUuid}&includeInactive=false&v=custom:(uuid,startDatetime,stopDatetime)&limit=1&order=desc`,
    );
    if (visitResponse.ok) {
      const visitPayload = await visitResponse.json();
      const visits = Array.isArray(visitPayload?.results) ? visitPayload.results : [];
      const activeVisit = visits.find((visit: any) => !visit?.stopDatetime) ?? visits[0];
      return parseOpenmrsDateTimeMs(activeVisit?.startDatetime);
    }
  } catch {
    // handled by caller
  }

  return null;
}

function isEncounterOnCurrentAdmission(encounter: any, admissionStartMs: number | null) {
  if (admissionStartMs === null) {
    return true;
  }

  const encounterMs = parseOpenmrsDateTimeMs(encounter.encounterDatetime);
  if (encounterMs === null) {
    return false;
  }

  return encounterMs >= admissionStartMs - ADMISSION_PREP_MS;
}

async function prepareTargetPatientChartForTransfer(
  targetPatientUuid: string,
  t: TFunction,
): Promise<{ success: boolean; message?: string }> {
  const admissionStartMs = await fetchPatientAdmissionStartMs(targetPatientUuid);
  const encounters = await fetchPatientLcgEncounters(targetPatientUuid);
  const encountersToVoid = encounters.filter((encounter) => {
    if (!isLcgManagedEncounter(encounter)) {
      return false;
    }

    if (isLabourTimeSetEncounter(encounter)) {
      return true;
    }

    return isEncounterOnCurrentAdmission(encounter, admissionStartMs);
  });

  for (const encounter of encountersToVoid) {
    const voided = await voidEncounter(encounter.uuid, 'Clearing chart before LCG session transfer');
    if (!voided) {
      return {
        success: false,
        message: t(
          'lcgCorrectionTargetCleanupFailed',
          'Failed to clear existing LCG data on the selected patient chart',
        ),
      };
    }
  }

  await clearLcgLocalStorageForPatient(targetPatientUuid, PARTOGRAPHY_GRAPH_TYPES);
  return { success: true };
}

export function buildSessionTerminationState(entries: SharedDecisionMakingEntry[]): LcgSessionTerminationState | null {
  const sortedEntries = [...entries].sort(
    (left, right) => new Date(left.encounterDatetime).getTime() - new Date(right.encounterDatetime).getTime(),
  );

  for (let index = sortedEntries.length - 1; index >= 0; index -= 1) {
    const entry = sortedEntries[index];
    if (!isTerminateOngoingProgressAction(entry.action)) {
      continue;
    }

    const reasonTypeUuid = entry.terminationReasonTypeUuid || entry.terminationReasonType || '';
    const isWrongPatientReason =
      normalizeLcgConceptKey(reasonTypeUuid) ===
      normalizeLcgConceptKey(LCG_TERMINATION_REASON_WRONG_PATIENT_CONCEPT_UUID);

    return {
      encounterUuid: entry.encounterUuid,
      time: entry.time,
      encounterDatetime: entry.encounterDatetime,
      terminationReasonType: entry.terminationReasonType,
      terminationReasonTypeUuid: reasonTypeUuid,
      terminationReasonText: entry.terminationReasonText,
      isWrongPatientReason,
    };
  }

  return null;
}

export function useLcgCorrectionAudit(patientUuid: string) {
  const url = patientUuid
    ? `${restBaseUrl}/encounter?patient=${patientUuid}&v=${encounterListRepresentation}&limit=100&order=desc`
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    url,
    (resourceUrl: string) => openmrsFetch(resourceUrl).then((response) => response.json()),
    { revalidateOnFocus: true, revalidateOnMount: true },
  );

  const auditRecord = useMemo<LcgCorrectionAuditRecord | null>(() => {
    const encounters = Array.isArray(data?.results) ? data.results : [];

    for (const encounter of encounters) {
      const parsed = parseCorrectionAuditEncounter(encounter);
      if (parsed) {
        return parsed;
      }
    }

    const stored = getLcgCorrectionAuditForPatient(patientUuid);
    if (stored && isValidCorrectionAuditRecord(stored)) {
      return stored;
    }

    return null;
  }, [data, patientUuid]);

  return { auditRecord, error, isLoading, mutate };
}

export function useLcgEligibleCorrectionPatients(
  excludePatientUuid: string,
  admissionLocationUuid?: string,
  enabled = true,
) {
  const session = useSession();
  const sessionLocationUuid = (session as any)?.sessionLocation?.uuid as string | undefined;
  const locationUuid = admissionLocationUuid || sessionLocationUuid;

  const customRepresentation =
    'custom:(patient:(uuid,identifiers:(uuid,identifier,identifierType),person:(display,gender,age)),currentInpatientLocation:(uuid))';

  const url =
    enabled && locationUuid
      ? `${restBaseUrl}/emrapi/inpatient/admission?currentInpatientLocation=${locationUuid}&v=${customRepresentation}`
      : null;

  const { data, error, isLoading, mutate } = useSWR(url, (resourceUrl: string) =>
    openmrsFetch(resourceUrl).then((response) => response.json()),
  );

  const patients = useMemo<LcgEligibleCorrectionPatient[]>(() => {
    const admissions = Array.isArray(data?.results) ? data.results : [];
    const mapped = admissions
      .map((admission: any) => {
        const patient = admission?.patient;
        if (!patient?.uuid || patient.uuid === excludePatientUuid) {
          return null;
        }

        const gender = String(patient?.person?.gender ?? '').toLowerCase();
        if (gender && gender !== 'f' && gender !== 'female' && !gender.startsWith('female')) {
          return null;
        }

        const age = patient?.person?.age;
        if (typeof age === 'number' && age <= 9) {
          return null;
        }

        const identifier =
          patient?.identifiers?.find((item: any) => item?.identifier)?.identifier ||
          patient?.identifiers?.[0]?.identifier ||
          '';

        return {
          uuid: patient.uuid,
          displayName: patient?.person?.display || getPatientName(patient) || patient.uuid,
          identifier,
          age: patient?.person?.age,
          gender: patient?.person?.gender,
        } satisfies LcgEligibleCorrectionPatient;
      })
      .filter(Boolean) as LcgEligibleCorrectionPatient[];

    return mapped.sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [data, excludePatientUuid]);

  return { patients, error, isLoading, mutate };
}

async function getCurrentSession() {
  try {
    const response = await openmrsFetch(`${restBaseUrl}/session`);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // handled by callers
  }
  return null;
}

async function voidEncounter(encounterUuid: string, reason: string): Promise<boolean> {
  if (!encounterUuid) {
    return true;
  }

  const response = await openmrsFetch(
    `${restBaseUrl}/encounter/${encounterUuid}?reason=${encodeURIComponent(reason)}`,
    { method: 'DELETE' },
  );

  if (response.ok) {
    return true;
  }

  // Treat missing or already-voided encounters as success during cleanup.
  return response.status === 404 || response.status === 400;
}

async function fetchEncounterForClone(encounterUuid: string) {
  const response = await openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}?v=full`);
  if (!response.ok) {
    throw new Error(`Failed to load encounter ${encounterUuid}`);
  }
  return response.json();
}

async function cloneEncounterToPatient(
  sourceEncounter: any,
  targetPatientUuid: string,
  providerUuid: string,
  locationUuid: string,
) {
  const observations = Array.isArray(sourceEncounter?.obs) ? sourceEncounter.obs : [];
  const encounterDatetimeMs = parseOpenmrsDateTimeMs(sourceEncounter.encounterDatetime);
  const encounterDatetime =
    encounterDatetimeMs !== null ? toOmrsIsoString(new Date(encounterDatetimeMs)) : sourceEncounter.encounterDatetime;

  const obsPayload = observations
    .filter((obs: any) => !obs.voided)
    .map((obs: any) => {
      const obsDatetimeRaw = obs.obsDatetime || sourceEncounter.encounterDatetime;
      const obsDatetimeMs = parseOpenmrsDateTimeMs(obsDatetimeRaw);
      return {
        concept: obs.concept?.uuid,
        value: normalizeCloneObsValue(obs.value?.uuid ?? obs.value),
        obsDatetime: obsDatetimeMs !== null ? toOmrsIsoString(new Date(obsDatetimeMs)) : obsDatetimeRaw,
      };
    })
    .filter((obs: any) => obs.concept);

  const payload = {
    patient: targetPatientUuid,
    encounterType: sourceEncounter.encounterType?.uuid,
    location: locationUuid,
    encounterDatetime,
    obs: obsPayload,
    encounterProviders: [
      {
        provider: providerUuid,
        encounterRole: ENCOUNTER_ROLE,
      },
    ],
  };

  const response = await openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to clone encounter ${sourceEncounter.uuid}`);
  }

  return response.json();
}

async function fetchPatientEncountersByType(patientUuid: string, encounterTypeUuid: string) {
  const response = await openmrsFetch(
    `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=${encounterListRepresentation}&limit=100&order=asc`,
  );
  if (!response.ok) {
    throw new Error('Failed to load LCG encounters');
  }
  const payload = await response.json();
  return Array.isArray(payload?.results) ? payload.results.filter((encounter: any) => !encounter.voided) : [];
}

async function fetchPatientLcgEncounters(patientUuid: string) {
  const [partographyEncounters, sharedDecisionEncounters] = await Promise.all([
    fetchPatientEncountersByType(patientUuid, MCH_PARTOGRAPHY_ENCOUNTER_UUID),
    fetchPatientEncountersByType(patientUuid, LCG_SHARED_DECISION_ENCOUNTER_TYPE_UUID),
  ]);

  return [...partographyEncounters, ...sharedDecisionEncounters];
}

function collectTransferEncounterUuids(encounters: any[], termination: LcgSessionTerminationState): string[] {
  const terminateTimeMs = parseOpenmrsDateTimeMs(termination.encounterDatetime) ?? Date.now();
  const nonTerminateEncounters = encounters.filter((encounter) => encounter.uuid !== termination.encounterUuid);
  const timerEncounters = nonTerminateEncounters.filter((encounter) => isLabourTimeSetEncounter(encounter));

  const earliestEncounterTimeMs = (items: any[]) =>
    items.reduce<number | null>((earliest, encounter) => {
      const encounterTime = parseOpenmrsDateTimeMs(encounter.encounterDatetime);
      if (encounterTime === null) {
        return earliest;
      }
      return earliest === null || encounterTime < earliest ? encounterTime : earliest;
    }, null);

  const timerStartMs = earliestEncounterTimeMs(timerEncounters);
  const sessionStartMs = timerStartMs ?? earliestEncounterTimeMs(nonTerminateEncounters) ?? terminateTimeMs;

  const inSessionWindow = nonTerminateEncounters.filter((encounter) => {
    if (isLabourTimeSetEncounter(encounter)) {
      return true;
    }

    const encounterTime = parseOpenmrsDateTimeMs(encounter.encounterDatetime);
    if (encounterTime === null) {
      return true;
    }

    return encounterTime >= sessionStartMs && encounterTime <= terminateTimeMs + 5 * 60 * 1000;
  });

  if (inSessionWindow.length > 0) {
    return inSessionWindow.map((encounter) => encounter.uuid as string);
  }

  if (timerEncounters.length > 0) {
    return timerEncounters.map((encounter) => encounter.uuid as string);
  }

  return nonTerminateEncounters.map((encounter) => encounter.uuid as string);
}

export async function saveLcgCorrectionAuditEncounter(
  targetPatientUuid: string,
  payload: {
    sourcePatientUuid: string;
    sourcePatientDisplay: string;
    sourceTerminateEncounterUuid: string;
    terminationReason: string;
    terminatedAt?: string;
    transferNotes?: string;
  },
  t: TFunction,
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getCurrentSession();
    const providerUuid = session?.currentProvider?.uuid;
    const locationUuid = session?.sessionLocation?.uuid;

    if (!providerUuid || !locationUuid) {
      return { success: false, message: t('lcgCorrectionMissingSession', 'Provider and location are required') };
    }

    const obsDatetime = toOmrsIsoString(new Date(Date.now() - 2 * 60 * 1000));
    const terminatedAtValue = formatOpenmrsObsDateTimeValue(payload.terminatedAt);
    const observations: Array<{ concept: string; value: string; obsDatetime: string }> = [
      {
        concept: LCG_CORRECTION_TYPE_CONCEPT_UUID,
        value: LCG_CORRECTION_TYPE_WRONG_PATIENT_TRANSFER_CONCEPT_UUID,
        obsDatetime,
      },
      {
        concept: LCG_CORRECTION_SOURCE_PATIENT_UUID_CONCEPT,
        value: payload.sourcePatientUuid,
        obsDatetime,
      },
      {
        concept: LCG_CORRECTION_SOURCE_PATIENT_DISPLAY_CONCEPT,
        value: payload.sourcePatientDisplay,
        obsDatetime,
      },
      {
        concept: LCG_CORRECTION_SOURCE_TERMINATE_ENCOUNTER_UUID_CONCEPT,
        value: payload.sourceTerminateEncounterUuid,
        obsDatetime,
      },
      {
        concept: LCG_CORRECTION_TERMINATION_REASON_CONCEPT,
        value: payload.terminationReason,
        obsDatetime,
      },
    ];

    if (terminatedAtValue) {
      observations.push({
        concept: LCG_CORRECTION_TERMINATED_AT_CONCEPT,
        value: terminatedAtValue,
        obsDatetime,
      });
    }

    if (payload.transferNotes?.trim()) {
      observations.push({
        concept: LCG_CORRECTION_TRANSFER_NOTES_CONCEPT,
        value: payload.transferNotes.trim(),
        obsDatetime,
      });
    }

    const response = await openmrsFetch(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient: targetPatientUuid,
        encounterType: LCG_CORRECTION_ENCOUNTER_TYPE_UUID,
        location: locationUuid,
        encounterDatetime: obsDatetime,
        obs: observations,
        encounterProviders: [{ provider: providerUuid, encounterRole: ENCOUNTER_ROLE }],
      }),
    });

    if (!response.ok) {
      return { success: false, message: t('lcgCorrectionAuditSaveFailed', 'Failed to save correction audit record') };
    }

    let savedEncounterUuid = '';
    try {
      const savedEncounter = await response.json();
      savedEncounterUuid = savedEncounter?.uuid ?? '';
    } catch {
      // Ignore response parse failures; local audit fallback still applies.
    }

    saveLcgCorrectionAuditForPatient(
      targetPatientUuid,
      buildStoredCorrectionAuditRecord({
        ...payload,
        encounterUuid: savedEncounterUuid,
        encounterDatetime: obsDatetime,
      }),
    );

    return { success: true, message: t('lcgCorrectionAuditSaved', 'Correction audit saved') };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : t('unknownError', 'Unknown error'),
    };
  }
}

async function finalizeSourcePatientAfterTransfer(
  sourcePatientUuid: string,
  targetPatientUuid: string,
  termination: LcgSessionTerminationState,
  t: TFunction,
): Promise<{ success: boolean; message?: string }> {
  if (termination.encounterUuid) {
    const terminateVoided = await voidEncounter(termination.encounterUuid, VOID_REASON);
    if (!terminateVoided) {
      return {
        success: false,
        message: t('lcgCorrectionVoidFailed', 'Failed to void an encounter on the wrong patient chart'),
      };
    }
  }

  const admissionStartMs = await fetchPatientAdmissionStartMs(sourcePatientUuid);
  const remainingEncounters = await fetchPatientLcgEncounters(sourcePatientUuid);

  for (const encounter of remainingEncounters) {
    if (encounter?.voided) {
      continue;
    }

    if (!isLcgManagedEncounter(encounter)) {
      continue;
    }

    if (!isLabourTimeSetEncounter(encounter) && !isEncounterOnCurrentAdmission(encounter, admissionStartMs)) {
      continue;
    }

    const voided = await voidEncounter(encounter.uuid, VOID_REASON);
    if (!voided) {
      return {
        success: false,
        message: t('lcgCorrectionVoidFailed', 'Failed to void an encounter on the wrong patient chart'),
      };
    }
  }

  await clearLcgLocalStorageForPatient(sourcePatientUuid, PARTOGRAPHY_GRAPH_TYPES);
  markLcgSessionTransferredAway(sourcePatientUuid, targetPatientUuid);

  return { success: true };
}

export async function executeWrongPatientSessionTransfer(
  sourcePatientUuid: string,
  targetPatientUuid: string,
  termination: LcgSessionTerminationState,
  sourcePatientDisplay: string,
  t: TFunction,
  transferNotes?: string,
): Promise<{ success: boolean; message: string; transferredCount?: number }> {
  try {
    const encounters = await fetchPatientLcgEncounters(sourcePatientUuid);
    const transferEncounterUuids = collectTransferEncounterUuids(encounters, termination);
    const hasLocalSessionData = hasLocalLcgSessionData(sourcePatientUuid, PARTOGRAPHY_GRAPH_TYPES);

    if (transferEncounterUuids.length === 0 && !hasLocalSessionData) {
      return {
        success: false,
        message: t('lcgCorrectionNoEncounters', 'No LCG encounters were found to transfer for this session'),
      };
    }

    const session = await getCurrentSession();
    const providerUuid = session?.currentProvider?.uuid;
    const locationUuid = session?.sessionLocation?.uuid;
    if (!providerUuid || !locationUuid) {
      return { success: false, message: t('lcgCorrectionMissingSession', 'Provider and location are required') };
    }

    const targetPrep = await prepareTargetPatientChartForTransfer(targetPatientUuid, t);
    if (!targetPrep.success) {
      return { success: false, message: targetPrep.message ?? t('unknownError', 'Unknown error') };
    }

    const clonedEncounterUuids: string[] = [];
    for (const encounterUuid of transferEncounterUuids) {
      const sourceEncounter = await fetchEncounterForClone(encounterUuid);
      const cloned = await cloneEncounterToPatient(sourceEncounter, targetPatientUuid, providerUuid, locationUuid);
      clonedEncounterUuids.push(cloned.uuid);
    }

    for (const encounterUuid of transferEncounterUuids) {
      const voided = await voidEncounter(encounterUuid, VOID_REASON);
      if (!voided) {
        return {
          success: false,
          message: t('lcgCorrectionVoidFailed', 'Failed to void an encounter on the wrong patient chart'),
        };
      }
    }

    const terminationReason =
      termination.terminationReasonText?.trim() ||
      (termination.isWrongPatientReason ? t('lcgWrongPatientSelected', 'Wrong patient selected') : '') ||
      termination.terminationReasonType ||
      t('lcgSessionCorrectedFromWizard', 'Session corrected from terminated chart');

    const auditPayload = {
      sourcePatientUuid,
      sourcePatientDisplay,
      sourceTerminateEncounterUuid: termination.encounterUuid,
      terminationReason,
      terminatedAt: termination.encounterDatetime,
      transferNotes,
    };

    saveLcgCorrectionAuditForPatient(targetPatientUuid, buildStoredCorrectionAuditRecord(auditPayload));

    const auditResult = await saveLcgCorrectionAuditEncounter(targetPatientUuid, auditPayload, t);

    if (!auditResult.success) {
      return auditResult;
    }

    if (hasLocalSessionData) {
      await copyLcgLocalStorageBetweenPatients(sourcePatientUuid, targetPatientUuid, PARTOGRAPHY_GRAPH_TYPES);
    }

    await clearLcgLocalStorageForPatient(sourcePatientUuid, PARTOGRAPHY_GRAPH_TYPES);
    markLcgSessionTransferredAway(sourcePatientUuid, targetPatientUuid);

    const finalizeResult = await finalizeSourcePatientAfterTransfer(
      sourcePatientUuid,
      targetPatientUuid,
      termination,
      t,
    );
    if (!finalizeResult.success) {
      return {
        success: false,
        message: finalizeResult.message ?? t('unknownError', 'Unknown error'),
      };
    }

    return {
      success: true,
      message: t('lcgCorrectionTransferSuccess', 'Session data transferred successfully'),
      transferredCount: clonedEncounterUuids.length,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : t('unknownError', 'Unknown error'),
    };
  }
}

export function useCanCorrectLcgSession(requiredPrivilege: string) {
  const session = useSession();
  const privileges = (session as any)?.user?.privileges;
  return useMemo(() => {
    if (!requiredPrivilege) {
      return true;
    }
    if (!Array.isArray(privileges)) {
      return true;
    }
    return privileges.some(
      (privilege: { display?: string; name?: string }) =>
        privilege?.display === requiredPrivilege || privilege?.name === requiredPrivilege,
    );
  }, [privileges, requiredPrivilege]);
}

export function formatTerminationReasonLabel(
  termination: LcgSessionTerminationState | null | undefined,
  t: TFunction,
): string {
  if (!termination) {
    return '';
  }

  if (termination.isWrongPatientReason) {
    return t('lcgTerminationWrongPatient', 'Wrong patient selected');
  }

  if (termination.terminationReasonText?.trim()) {
    return termination.terminationReasonText.trim();
  }

  return termination.terminationReasonType || t('lcgSessionTerminated', 'Session terminated');
}

export function isValidCorrectionAuditRecord(record: LcgCorrectionAuditRecord | null | undefined): boolean {
  if (!record) {
    return false;
  }

  return Boolean(
    record.sourceTerminateEncounterUuid?.trim() ||
    record.sourcePatientUuid?.trim() ||
    record.sourcePatientDisplay?.trim(),
  );
}

export function formatCorrectionAuditTime(value?: string): string {
  if (!value) {
    return '';
  }

  const timeMs = parseOpenmrsDateTimeMs(value);
  if (timeMs === null) {
    return value;
  }

  return new Date(timeMs).toLocaleString();
}

export function resolveCorrectionAuditSlotTime(terminatedAt?: string): string | null {
  if (!terminatedAt?.trim()) {
    return null;
  }

  const trimmed = terminatedAt.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const timeMs = parseOpenmrsDateTimeMs(trimmed);
  if (timeMs === null) {
    return null;
  }

  const date = new Date(timeMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatCorrectionAuditSubtitle(record: LcgCorrectionAuditRecord): string {
  const parts: string[] = [];

  if (record.sourcePatientDisplay?.trim()) {
    parts.push(`Originally entered on: ${record.sourcePatientDisplay.trim()}`);
  }

  if (record.terminationReason?.trim()) {
    parts.push(`Termination reason: ${record.terminationReason.trim()}`);
  }

  const terminatedAt = formatCorrectionAuditTime(record.terminatedAt || record.encounterDatetime);
  if (terminatedAt) {
    parts.push(`Terminated at: ${terminatedAt}`);
  }

  if (record.transferNotes?.trim()) {
    parts.push(`Notes: ${record.transferNotes.trim()}`);
  }

  return parts.join(' • ');
}

export function buildCorrectionAuditDisplayFromTermination(
  termination: LcgSessionTerminationState,
  sourcePatientDisplay: string,
  t: TFunction,
): LcgCorrectionAuditRecord {
  return {
    encounterUuid: termination.encounterUuid,
    encounterDatetime: termination.encounterDatetime,
    sourcePatientUuid: '',
    sourcePatientDisplay: sourcePatientDisplay.trim(),
    sourceTerminateEncounterUuid: termination.encounterUuid,
    terminationReason: formatTerminationReasonLabel(termination, t),
    terminatedAt: termination.encounterDatetime,
    transferNotes: termination.terminationReasonText?.trim() || undefined,
  };
}

export function resolveLcgCorrectionAuditDisplay(
  auditRecord: LcgCorrectionAuditRecord | null,
  termination: LcgSessionTerminationState | null,
  patientDisplay: string,
  t: TFunction,
  options?: { allowTerminationFallback?: boolean },
): LcgCorrectionAuditRecord | null {
  if (isValidCorrectionAuditRecord(auditRecord)) {
    return auditRecord;
  }

  if (options?.allowTerminationFallback === false) {
    return null;
  }

  if (termination) {
    return buildCorrectionAuditDisplayFromTermination(termination, patientDisplay, t);
  }

  return null;
}

export function buildCorrectionAuditTableRow(record: LcgCorrectionAuditRecord, t: TFunction) {
  const recordedAt = formatCorrectionAuditTime(record.terminatedAt || record.encounterDatetime);

  return {
    time: recordedAt,
    assessment: record.sourcePatientDisplay?.trim()
      ? `Originally entered on: ${record.sourcePatientDisplay.trim()}`
      : '',
    plan: [
      record.terminationReason?.trim() ? `Termination reason: ${record.terminationReason.trim()}` : '',
      record.transferNotes?.trim() ? `Notes: ${record.transferNotes.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' • '),
    action: t('lcgAuditSdmTitle', 'Shared Decision Making — transferred session audit'),
    recordedAt,
  };
}

export { LCG_TERMINATION_REASON_TYPE_CONCEPT_UUID, LCG_TERMINATION_REASON_WRONG_PATIENT_CONCEPT_UUID };
