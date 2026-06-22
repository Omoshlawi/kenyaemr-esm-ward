import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAdmissionDetails } from '../resources/admission-details.resource';
import { useBabyData } from '../resources/baby.resource';
import type { BabyEntry } from '../graphs/baby.component';
import { useLabourTimeSetData } from '../resources/labour-time-set-select-setup.resource';
import { saveLabourProgressData } from '../resources/labour-progress.resource';
import { useMedicationData, type MedicationEntry } from '../resources/medication.resource';
import { useSupportiveCareData, type SupportiveCareEntry } from '../resources/supportive-care.resource';
import {
  normalizeSharedDecisionMakingAction,
  useSharedDecisionMakingData,
  type SharedDecisionMakingEntry,
} from '../resources/shared-decision-making.resource';
import { buildSessionTerminationState, useLcgCorrectionAudit } from '../resources/lcg-session-correction.resource';
import { createPartographyEncounter, usePartographyData } from '../partography.resource';
import type { WomanLocalEntry } from '../graphs/woman.component';
import type { LabourProgressEntry } from '../graphs/labour-progress.component';
import type { LabourProgressFormData } from '../forms/labour-progress-form.component';
import { useLcgAllSectionEntries } from '../context/lcg-section-state.context';
import { useLcgDebouncedValue } from './use-lcg-debounced-value';
import {
  acetoneLabelToConceptValue,
  LCG_CERVIX_FIRST_STAGE_LAG_HOURS_BY_DILATION,
  LCG_SHARED_DECISION_ALERT_TIMER_MINUTES,
  LCG_SHARED_DECISION_PROMPT_HOUR_MINUTES,
  MEDICATION_FORM_CONCEPTS,
  PARTOGRAPHY_CONCEPTS,
  proteinLabelToConceptValue,
  scaleLcgGuidelineMinutes,
  URGE_TO_PUSH_UUID,
} from '../types';
import { formatHHMM, getPointSlotIndexForTime, SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS } from '../time-slot-utils';
import {
  activeFirstStageHours,
  getEncounterObsValue,
  getEncounterRecordedTime,
  getLabourContractionObsFromEncounter,
  isEncounterAfterSessionReset,
  parseCervicalDilationValue,
  parseDescentOfHeadValue,
  parseUrgeToPushValue,
  resolveBirthActionLabel,
  resolveAlertCreatedTimeMs,
  resolveEntryTimeMs,
  resolveStopActionLabel,
  secondStageHours,
} from '../labour-care-guide.utils';
import { LCG_ADMISSION_RISK_FACTOR_CODE, LCG_LABOUR_ONSET_CODE } from '../constants/admission-form.constants';
import {
  buildLcgAlertId,
  computeLcgAlertActivationMs,
  getLastAcknowledgedMsForPeriod,
  getLcgHourlyCellBoundsForEntry,
  isLcgAlertObservationActive,
  isLcgAlertWithinHourlyCell,
  isLcgMicroSessionPromptRetired,
  shouldFireLcgAlertAlarm,
} from '../lcg-alert-lifecycle';
import {
  getBabyAlertTokenGuidance,
  getBabyAlertTokens,
  getContractionAlertTokenGuidance,
  getContractionAlertTokens,
  getCervixStallTokenGuidance,
  getSupportiveAlertTokenGuidance,
  getSupportiveAlertTokens,
  getWomanAlertTokenGuidance,
  getWomanAlertTokens,
  type SharedDecisionAlertItem,
  type WomanAlertEntryLike,
} from '../alert-rules';

// Mirrors the logic in woman.component.tsx formatProteinToken / formatAcetoneToken,
// simplified to return only the alert-relevant display label.
const formatProteinForAlert = (raw?: string): string => {
  const v = (raw ?? '').trim().toUpperCase();
  if (!v) return '';
  if (v.includes('1364') || v.includes('THREE PLUS') || v.includes('+++')) return 'P+++';
  if (v.includes('1363') || v.includes('TWO PLUS') || v.includes('++')) return 'P++';
  if (v.includes('1362') || v.includes('ONE PLUS') || v.includes('+')) return 'P+';
  return '';
};

const formatAcetoneForAlert = (raw?: string): string => {
  const v = (raw ?? '').trim().toUpperCase();
  if (!v) return '';
  if (v.includes('1364') || v.includes('THREE PLUS') || v.includes('+++')) return 'A+++';
  if (v.includes('1363') || v.includes('TWO PLUS') || v.includes('++')) return 'A++';
  if (v.includes('1362') || v.includes('ONE PLUS') || v.includes('+')) return 'A+';
  return '';
};

type SharedDecisionPromptItem = SharedDecisionAlertItem;

type CdsPendingAlertPayload = {
  triggerTimeMs: number;
  activatesAtMs: number | null;
  expiresAtMs: number;
  periodStartMs: number;
  summary: string;
  items: SharedDecisionPromptItem[];
};

type SharedDecisionPromptCandidate = {
  triggerTimeMs: number;
  activatesAtMs: number | null;
  expiresAtMs: number;
  periodStartMs: number;
  summaryParts: string[];
  items: SharedDecisionPromptItem[];
};

type AdmissionDetailsState = {
  labourOnset: string;
  activeLabourDiagnosisDate: string;
  rupturedMembranes: string;
  rupturedMembranesDate: string;
  rupturedMembranesTime: string;
  riskFactors: string;
  riskFactorOtherText: string;
  ipNumber: string;
};

const hasSharedDecisionContent = (entry: SharedDecisionMakingEntry) =>
  Boolean(entry.assessment?.trim() || entry.plan?.trim() || entry.action?.trim());

const buildSharedDecisionMergeKey = (entry: SharedDecisionMakingEntry) =>
  `${entry.time ?? ''}|${entry.assessment?.trim() ?? ''}|${
    entry.plan?.trim() ?? ''
  }|${normalizeSharedDecisionMakingAction(entry.action)}`;

const getSharedDecisionEntryTimesMs = (entries: SharedDecisionMakingEntry[]) =>
  entries
    .filter(hasSharedDecisionContent)
    .map((entry) => resolveAlertCreatedTimeMs(entry))
    .filter((entryTimeMs): entryTimeMs is number => entryTimeMs !== null);

type UseLcgDataOptions = {
  sessionResetAfterMs?: number | null;
};

export function useLcgData(patientUuid: string, options: UseLcgDataOptions = {}) {
  const sessionResetAfterMs = options.sessionResetAfterMs ?? null;
  const { t } = useTranslation();

  const [isTimeFormOpen, setIsTimeFormOpen] = React.useState(false);
  const [isSupportiveCareFormOpen, setIsSupportiveCareFormOpen] = React.useState(false);
  const [isBabyFormOpen, setIsBabyFormOpen] = React.useState(false);
  const [isWomanFormOpen, setIsWomanFormOpen] = React.useState(false);
  const [isContractionsFormOpen, setIsContractionsFormOpen] = React.useState(false);
  const [isLabourProgressFormOpen, setIsLabourProgressFormOpen] = React.useState(false);
  const [isMedicationFormOpen, setIsMedicationFormOpen] = React.useState(false);
  const [isSharedDecisionMakingFormOpen, setIsSharedDecisionMakingFormOpen] = React.useState(false);
  const [sharedDecisionAutoPromptSummary, setSharedDecisionAutoPromptSummary] = React.useState<string | null>(null);
  const [sharedDecisionAutoPromptItems, setSharedDecisionAutoPromptItems] = React.useState<SharedDecisionPromptItem[]>(
    [],
  );
  const [lastAutoPromptKey, setLastAutoPromptKey] = React.useState<string | null>(null);
  const alertSessionAcknowledgedAtMsRef = React.useRef<Map<number, number>>(new Map());
  const [alertSessionVersion, setAlertSessionVersion] = React.useState(0);
  const [isAdmissionDetailsFormOpen, setIsAdmissionDetailsFormOpen] = React.useState(false);
  const [labourProgressRefreshToken, setLabourProgressRefreshToken] = React.useState(0);
  const {
    localSupportiveCareEntries,
    setLocalSupportiveCareEntries,
    localMedicationEntries,
    setLocalMedicationEntries,
    localBabyEntries,
    setLocalBabyEntries,
    localLabourProgressEntries,
    setLocalLabourProgressEntries,
    localWomanEntries,
    setLocalWomanEntries,
    localSharedDecisionMakingEntries,
    setLocalSharedDecisionMakingEntries,
  } = useLcgAllSectionEntries();
  const [admissionDetails, setAdmissionDetails] = React.useState<AdmissionDetailsState>({
    labourOnset: '',
    activeLabourDiagnosisDate: '',
    rupturedMembranes: '',
    rupturedMembranesDate: '',
    rupturedMembranesTime: '',
    riskFactors: '',
    riskFactorOtherText: '',
    ipNumber: '',
  });

  const { admissionData, mutate: mutateAdmissionDetails } = useAdmissionDetails(patientUuid);
  const admissionRiskFactorCodes = React.useMemo(() => admissionData?.riskFactors ?? [], [admissionData]);
  const { labourTimeSetData: rawLabourTimeSetData, mutate: mutateLabourTimeSetData } = useLabourTimeSetData(
    patientUuid,
    true,
  );
  const labourTimeSetData = React.useMemo(
    () =>
      rawLabourTimeSetData.filter((entry) =>
        isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs),
      ),
    [rawLabourTimeSetData, sessionResetAfterMs],
  );
  const { babyEntries: rawBabyEntries, mutate: mutateBabyData } = useBabyData(patientUuid, true);
  const babyEntries = React.useMemo(
    () => rawBabyEntries.filter((entry) => isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs)),
    [rawBabyEntries, sessionResetAfterMs],
  );
  const { medicationEntries: rawMedicationEntries, mutate: mutateMedicationData } = useMedicationData(patientUuid);
  const medicationEntries = React.useMemo(
    () =>
      rawMedicationEntries.filter((entry) =>
        isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs),
      ),
    [rawMedicationEntries, sessionResetAfterMs],
  );
  const { supportiveCareEntries: rawSupportiveCareEntries, mutate: mutateSupportiveCareData } = useSupportiveCareData(
    patientUuid,
    true,
  );
  const supportiveCareEntries = React.useMemo(
    () =>
      rawSupportiveCareEntries.filter((entry) =>
        isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs),
      ),
    [rawSupportiveCareEntries, sessionResetAfterMs],
  );
  const { entries: rawSharedDecisionMakingEntries, mutate: mutateSharedDecisionMakingData } =
    useSharedDecisionMakingData(patientUuid, true);
  const sharedDecisionMakingEntries = React.useMemo(
    () =>
      rawSharedDecisionMakingEntries.filter((entry) =>
        isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs),
      ),
    [rawSharedDecisionMakingEntries, sessionResetAfterMs],
  );
  const { auditRecord: correctionAuditRecord, mutate: mutateCorrectionAudit } = useLcgCorrectionAudit(patientUuid);
  const { data: rawWomanPulseBpEncounters = [], mutate: mutateWomanPartographyData } = usePartographyData(
    patientUuid,
    'pulse-bp-combined',
  );
  const womanPulseBpEncounters = React.useMemo(
    () =>
      rawWomanPulseBpEncounters.filter((encounter: any) =>
        isEncounterAfterSessionReset(encounter?.encounterDatetime, sessionResetAfterMs),
      ),
    [rawWomanPulseBpEncounters, sessionResetAfterMs],
  );
  const { data: rawWomanTemperatureEncounters = [] } = usePartographyData(patientUuid, 'temperature');
  const womanTemperatureEncounters = React.useMemo(
    () =>
      rawWomanTemperatureEncounters.filter((encounter: any) =>
        isEncounterAfterSessionReset(encounter?.encounterDatetime, sessionResetAfterMs),
      ),
    [rawWomanTemperatureEncounters, sessionResetAfterMs],
  );
  const { data: rawWomanUrineEncounters = [] } = usePartographyData(patientUuid, 'urine-analysis');
  const womanUrineEncounters = React.useMemo(
    () =>
      rawWomanUrineEncounters.filter((encounter: any) =>
        isEncounterAfterSessionReset(encounter?.encounterDatetime, sessionResetAfterMs),
      ),
    [rawWomanUrineEncounters, sessionResetAfterMs],
  );
  const { data: rawLabourContractionEncounters = [] } = usePartographyData(patientUuid, 'uterine-contractions');
  const labourContractionEncounters = React.useMemo(
    () =>
      rawLabourContractionEncounters.filter((encounter: any) =>
        isEncounterAfterSessionReset(encounter?.encounterDatetime, sessionResetAfterMs),
      ),
    [rawLabourContractionEncounters, sessionResetAfterMs],
  );
  const { data: rawCervicalEncounters = [] } = usePartographyData(patientUuid, 'cervical-dilation');
  const cervicalEncounters = React.useMemo(
    () =>
      rawCervicalEncounters.filter((encounter: any) =>
        isEncounterAfterSessionReset(encounter?.encounterDatetime, sessionResetAfterMs),
      ),
    [rawCervicalEncounters, sessionResetAfterMs],
  );
  const { data: rawLabourDescentEncounters = [] } = usePartographyData(patientUuid, 'descent-of-head');
  const labourDescentEncounters = React.useMemo(
    () =>
      rawLabourDescentEncounters.filter((encounter: any) =>
        isEncounterAfterSessionReset(encounter?.encounterDatetime, sessionResetAfterMs),
      ),
    [rawLabourDescentEncounters, sessionResetAfterMs],
  );

  const activeLocalMedicationEntries = React.useMemo(
    () =>
      sessionResetAfterMs
        ? localMedicationEntries.filter((entry) =>
            isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs),
          )
        : localMedicationEntries,
    [localMedicationEntries, sessionResetAfterMs],
  );
  const activeLocalSupportiveCareEntries = React.useMemo(
    () =>
      sessionResetAfterMs
        ? localSupportiveCareEntries.filter((entry) =>
            isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs),
          )
        : localSupportiveCareEntries,
    [localSupportiveCareEntries, sessionResetAfterMs],
  );
  const activeLocalBabyEntries = React.useMemo(
    () =>
      sessionResetAfterMs
        ? localBabyEntries.filter((entry) => isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs))
        : localBabyEntries,
    [localBabyEntries, sessionResetAfterMs],
  );
  const activeLocalSharedDecisionMakingEntries = React.useMemo(
    () =>
      sessionResetAfterMs
        ? localSharedDecisionMakingEntries.filter((entry) =>
            isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs),
          )
        : localSharedDecisionMakingEntries,
    [localSharedDecisionMakingEntries, sessionResetAfterMs],
  );
  const activeLocalLabourProgressEntries = React.useMemo(
    () =>
      sessionResetAfterMs
        ? localLabourProgressEntries.filter((entry) =>
            isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs),
          )
        : localLabourProgressEntries,
    [localLabourProgressEntries, sessionResetAfterMs],
  );
  const activeLocalWomanEntries = React.useMemo(
    () =>
      sessionResetAfterMs
        ? localWomanEntries.filter((entry) => isEncounterAfterSessionReset(entry.recordedAt, sessionResetAfterMs))
        : localWomanEntries,
    [localWomanEntries, sessionResetAfterMs],
  );

  const mergedMedicationEntries = React.useMemo(() => {
    const merged = new Map<string, MedicationEntry>();
    for (const entry of [...medicationEntries, ...activeLocalMedicationEntries]) {
      merged.set(entry.id, entry);
    }
    return Array.from(merged.values()).sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );
  }, [medicationEntries, activeLocalMedicationEntries]);

  const mergedSupportiveCareEntries = React.useMemo(() => {
    const merged = new Map<string, SupportiveCareEntry>();
    for (const entry of [...supportiveCareEntries, ...activeLocalSupportiveCareEntries]) {
      merged.set(entry.id, entry);
    }
    return Array.from(merged.values()).sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );
  }, [supportiveCareEntries, activeLocalSupportiveCareEntries]);

  const mergedBabyEntries = React.useMemo(() => {
    const merged = new Map<string, BabyEntry>();
    const orderedEntries = [...babyEntries, ...activeLocalBabyEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );

    for (const entry of orderedEntries) {
      const mergeKey = `${entry.twinIndex ?? 1}|${entry.time || entry.id}`;
      const existingEntry = merged.get(mergeKey);

      if (!existingEntry) {
        merged.set(mergeKey, entry);
        continue;
      }

      merged.set(mergeKey, {
        ...existingEntry,
        id: entry.id,
        encounterDatetime: entry.encounterDatetime,
        baselineFhr: entry.baselineFhr || existingEntry.baselineFhr,
        fhrDeceleration: entry.fhrDeceleration || existingEntry.fhrDeceleration,
        amnioticFluid: entry.amnioticFluid || existingEntry.amnioticFluid,
        fetalPosition: entry.fetalPosition || existingEntry.fetalPosition,
        caput: entry.caput || existingEntry.caput,
        moulding: entry.moulding || existingEntry.moulding,
        twinIndex: entry.twinIndex ?? existingEntry.twinIndex ?? 1,
      });
    }

    return Array.from(merged.values()).sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );
  }, [babyEntries, activeLocalBabyEntries]);

  const mergedSharedDecisionMakingEntries = React.useMemo(() => {
    const normalizedApiEntries = sharedDecisionMakingEntries.map((entry) => ({
      ...entry,
      action: normalizeSharedDecisionMakingAction(entry.action),
    }));
    const normalizedLocalEntries = activeLocalSharedDecisionMakingEntries.map((entry) => ({
      ...entry,
      action: normalizeSharedDecisionMakingAction(entry.action),
    }));

    const apiEncounterIds = new Set(normalizedApiEntries.map((entry) => entry.encounterUuid));
    const apiEntryKeys = new Set(normalizedApiEntries.map((entry) => buildSharedDecisionMergeKey(entry)));
    const unsyncedLocalEntries = normalizedLocalEntries.filter((entry) => {
      if (apiEncounterIds.has(entry.encounterUuid)) {
        return false;
      }

      return !apiEntryKeys.has(buildSharedDecisionMergeKey(entry));
    });

    return [...normalizedApiEntries, ...unsyncedLocalEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );
  }, [sharedDecisionMakingEntries, activeLocalSharedDecisionMakingEntries]);

  const mergedLabourProgressEntries = React.useMemo(() => {
    const apiEntries = [...labourContractionEncounters, ...cervicalEncounters, ...labourDescentEncounters]
      .map((encounter: any) => {
        const hasMedicationMarker = Boolean(
          getEncounterObsValue(encounter, MEDICATION_FORM_CONCEPTS.oxytocinAdministered) ||
          getEncounterObsValue(encounter, MEDICATION_FORM_CONCEPTS.medication) ||
          getEncounterObsValue(encounter, MEDICATION_FORM_CONCEPTS.ivFluids) ||
          getEncounterObsValue(encounter, MEDICATION_FORM_CONCEPTS.oxytocinDose) ||
          getEncounterObsValue(encounter, MEDICATION_FORM_CONCEPTS.oxytocinDropsPerMinute),
        );
        const hasContractionMarker = Boolean(
          getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['contraction-count']) ||
          getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['uterine-contractions']) ||
          getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['uterine-contraction-frequency']),
        );

        if (hasMedicationMarker && !hasContractionMarker) {
          return null;
        }

        const time = getEncounterRecordedTime(encounter);
        const { contractionsPer10Mins, durationOfContractions } = getLabourContractionObsFromEncounter(encounter);
        const cervicalDilation = parseCervicalDilationValue(
          getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['cervical-dilation']),
        );
        const descentOfHead = parseDescentOfHeadValue(
          getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['descent-of-head']),
        );
        const urgeToPush = parseUrgeToPushValue(getEncounterObsValue(encounter, URGE_TO_PUSH_UUID));

        if (
          !time ||
          !(
            contractionsPer10Mins ||
            durationOfContractions ||
            cervicalDilation !== null ||
            descentOfHead !== null ||
            urgeToPush
          )
        ) {
          return null;
        }

        return {
          id: encounter?.uuid,
          encounterDatetime: encounter?.encounterDatetime,
          time,
          contractionsPer10Mins: contractionsPer10Mins || undefined,
          durationOfContractions: durationOfContractions || undefined,
          ...(cervicalDilation !== null ? { cervicalDilation } : {}),
          ...(descentOfHead !== null ? { descentOfHead } : {}),
          ...(urgeToPush ? { urgeToPush } : {}),
        } satisfies LabourProgressEntry;
      })
      .filter(Boolean) as LabourProgressEntry[];

    const orderedEntries = [...apiEntries, ...activeLocalLabourProgressEntries].sort(
      (left, right) =>
        new Date(left.encounterDatetime ?? 0).getTime() - new Date(right.encounterDatetime ?? 0).getTime(),
    );

    const merged = new Map<string, LabourProgressEntry>();
    for (const entry of orderedEntries) {
      const mergeKey = entry.time || entry.id || entry.encounterDatetime || String(merged.size);
      const existingEntry = merged.get(mergeKey);

      if (!existingEntry) {
        merged.set(mergeKey, entry);
        continue;
      }

      merged.set(mergeKey, {
        ...existingEntry,
        ...entry,
        contractionsPer10Mins: entry.contractionsPer10Mins || existingEntry.contractionsPer10Mins,
        durationOfContractions: entry.durationOfContractions || existingEntry.durationOfContractions,
        cervicalDilation: entry.cervicalDilation ?? existingEntry.cervicalDilation,
        descentOfHead: entry.descentOfHead ?? existingEntry.descentOfHead,
        urgeToPush: entry.urgeToPush || existingEntry.urgeToPush,
      });
    }

    return Array.from(merged.values()).sort(
      (left, right) =>
        new Date(left.encounterDatetime ?? 0).getTime() - new Date(right.encounterDatetime ?? 0).getTime(),
    );
  }, [cervicalEncounters, labourContractionEncounters, labourDescentEncounters, activeLocalLabourProgressEntries]);

  // Flat list of woman observations for alert-rule evaluation.
  // Each element represents one encounter or local entry; the addPromptItem
  // deduplication handles the same token appearing across multiple entries
  // at the same period.
  const mergedWomanAlertEntries = React.useMemo(() => {
    type WomanAlertEntry = WomanAlertEntryLike & { encounterDatetime: string; time?: string };
    const entries: WomanAlertEntry[] = [];

    for (const encounter of womanPulseBpEncounters as any[]) {
      const time = getEncounterRecordedTime(encounter) || undefined;
      const pulse = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['maternal-pulse']) || undefined;
      const systolicBp = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['systolic-bp']) || undefined;
      const diastolicBp = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['diastolic-bp']) || undefined;
      if (time && (pulse || systolicBp || diastolicBp)) {
        entries.push({ encounterDatetime: encounter.encounterDatetime ?? '', time, pulse, systolicBp, diastolicBp });
      }
    }

    for (const encounter of womanTemperatureEncounters as any[]) {
      const time = getEncounterRecordedTime(encounter) || undefined;
      const temperature = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS.temperature) || undefined;
      if (time && temperature) {
        entries.push({ encounterDatetime: encounter.encounterDatetime ?? '', time, temperature });
      }
    }

    for (const encounter of womanUrineEncounters as any[]) {
      const time = getEncounterRecordedTime(encounter) || undefined;
      const protein = formatProteinForAlert(getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['protein-level']));
      const acetone = formatAcetoneForAlert(getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['ketone-level']));
      const urine = [protein, acetone].filter(Boolean).join('/') || undefined;
      if (time && urine) {
        entries.push({ encounterDatetime: encounter.encounterDatetime ?? '', time, urine });
      }
    }

    for (const entry of activeLocalWomanEntries) {
      const protein = formatProteinForAlert(entry.protein);
      const acetone = formatAcetoneForAlert(entry.acetone);
      const urine = [protein, acetone].filter(Boolean).join('/') || undefined;
      entries.push({
        encounterDatetime: entry.recordedAt,
        time: entry.time,
        pulse: entry.pulse || undefined,
        systolicBp: entry.systolicBp || undefined,
        diastolicBp: entry.diastolicBp || undefined,
        temperature: entry.temperature || undefined,
        urine,
      });
    }

    return entries;
  }, [womanPulseBpEncounters, womanTemperatureEncounters, womanUrineEncounters, activeLocalWomanEntries]);

  const debouncedMergedSupportiveCareEntries = useLcgDebouncedValue(mergedSupportiveCareEntries, 300);
  const debouncedMergedBabyEntries = useLcgDebouncedValue(mergedBabyEntries, 300);
  const debouncedMergedLabourProgressEntries = useLcgDebouncedValue(mergedLabourProgressEntries, 300);
  const debouncedMergedSharedDecisionMakingEntries = useLcgDebouncedValue(mergedSharedDecisionMakingEntries, 300);
  const debouncedMergedWomanAlertEntries = useLcgDebouncedValue(mergedWomanAlertEntries, 300);

  const womanFormExistingTimeEntries = React.useMemo(() => {
    const apiEntries = [...womanPulseBpEncounters, ...womanTemperatureEncounters, ...womanUrineEncounters]
      .map((encounter: any) => ({
        time: getEncounterRecordedTime(encounter),
        encounterDatetime: encounter?.encounterDatetime ?? '',
      }))
      .filter((entry) => Boolean(entry.time));

    const localTimeEntries = activeLocalWomanEntries.map((entry) => ({
      time: entry.time,
      encounterDatetime: entry.recordedAt,
    }));

    const allEntries = [...apiEntries, ...localTimeEntries].sort(
      (left, right) => new Date(left.encounterDatetime).getTime() - new Date(right.encounterDatetime).getTime(),
    );

    const uniqueByTime = new Map<string, { time: string; encounterDatetime: string }>();
    for (const entry of allEntries) {
      if (!uniqueByTime.has(entry.time)) {
        uniqueByTime.set(entry.time, entry);
      }
    }

    return Array.from(uniqueByTime.values())
      .sort((left, right) => new Date(left.encounterDatetime).getTime() - new Date(right.encounterDatetime).getTime())
      .map((entry, index) => ({
        hour: index + 1,
        time: entry.time,
      }));
  }, [activeLocalWomanEntries, womanPulseBpEncounters, womanTemperatureEncounters, womanUrineEncounters]);

  const handleWomanFormSubmit = React.useCallback(
    async (
      formData: {
        time: string;
        pulse: string;
        systolicBp: string;
        diastolicBp: string;
        temperature: string;
        protein: string;
        acetone: string;
      },
      options?: { emergencyReason?: string },
    ) => {
      const saves: Array<Promise<{ success: boolean; message: string; payload?: any }>> = [];

      if (formData.pulse || formData.systolicBp || formData.diastolicBp) {
        saves.push(
          createPartographyEncounter(
            patientUuid,
            'pulse-bp-combined',
            {
              pulse: formData.pulse,
              systolic: formData.systolicBp,
              diastolic: formData.diastolicBp,
              time: formData.time,
            },
            undefined,
            undefined,
            undefined,
            undefined,
            options,
          ),
        );
      }

      if (formData.temperature) {
        saves.push(
          createPartographyEncounter(
            patientUuid,
            'temperature',
            {
              value: formData.temperature,
              time: formData.time,
            },
            undefined,
            undefined,
            undefined,
            undefined,
            options,
          ),
        );
      }

      if (formData.protein || formData.acetone) {
        saves.push(
          createPartographyEncounter(
            patientUuid,
            'urine-analysis',
            {
              proteinLevel: formData.protein ? proteinLabelToConceptValue(formData.protein) : '',
              ketoneLevel: formData.acetone ? acetoneLabelToConceptValue(formData.acetone) : '',
              timeSlot: formData.time,
            },
            undefined,
            undefined,
            undefined,
            undefined,
            options,
          ),
        );
      }

      if (saves.length === 0) {
        throw new Error('No valid woman observations to save');
      }

      const results = await Promise.all(saves);
      const failedResult = results.find((result) => !result.success);
      if (failedResult) {
        throw new Error(failedResult.message);
      }

      await mutateWomanPartographyData();
    },
    [mutateWomanPartographyData, patientUuid],
  );

  const handleLabourProgressFormSubmit = React.useCallback(
    async (formData: LabourProgressFormData, options?: { emergencyReason?: string }) => {
      const hasAnyObservation = Boolean(
        formData.contractionsPer10Mins ||
        formData.durationOfContractions ||
        formData.cervicalDilation !== '' ||
        formData.descentOfHead !== '' ||
        formData.urgeToPush,
      );

      if (!hasAnyObservation) {
        throw new Error('No valid labour progress observations to save');
      }

      const result = await saveLabourProgressData(patientUuid, formData, t, undefined, undefined, options);
      if (!result.success) {
        throw new Error(result.message);
      }

      const timestamp = new Date().toISOString();
      const nextEntry: LabourProgressEntry = {
        id: `labour-progress-local-${timestamp}`,
        encounterDatetime: timestamp,
        time: formData.time,
        contractionsPer10Mins: formData.contractionsPer10Mins || undefined,
        durationOfContractions: formData.durationOfContractions || undefined,
        ...(formData.cervicalDilation !== '' && formData.cervicalDilation !== undefined
          ? { cervicalDilation: Number(formData.cervicalDilation) }
          : {}),
        ...(formData.descentOfHead !== '' && formData.descentOfHead !== undefined
          ? { descentOfHead: Number(formData.descentOfHead) }
          : {}),
        ...(formData.urgeToPush ? { urgeToPush: formData.urgeToPush } : {}),
        isEmergency: Boolean(options?.emergencyReason?.trim()),
        emergencyReason: options?.emergencyReason?.trim() || undefined,
      };

      setLocalLabourProgressEntries((prev) => {
        const existingIndex = prev.findIndex((entry) => entry.time === formData.time);
        if (existingIndex === -1) {
          return [...prev, nextEntry];
        }

        const existingEntry = prev[existingIndex];
        const updatedEntries = [...prev];
        updatedEntries[existingIndex] = {
          ...existingEntry,
          ...nextEntry,
          id: existingEntry.id ?? nextEntry.id,
          contractionsPer10Mins: nextEntry.contractionsPer10Mins || existingEntry.contractionsPer10Mins,
          durationOfContractions: nextEntry.durationOfContractions || existingEntry.durationOfContractions,
          cervicalDilation: nextEntry.cervicalDilation ?? existingEntry.cervicalDilation,
          descentOfHead: nextEntry.descentOfHead ?? existingEntry.descentOfHead,
          urgeToPush: nextEntry.urgeToPush || existingEntry.urgeToPush,
        };
        return updatedEntries;
      });

      setLabourProgressRefreshToken((value) => value + 1);
    },
    [patientUuid, setLocalLabourProgressEntries, t],
  );

  const [nowMinutes, setNowMinutes] = React.useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  React.useEffect(() => {
    const msUntilNext = 60_000 - (Date.now() % 60_000);
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
      intervalId = window.setInterval(() => {
        const d2 = new Date();
        setNowMinutes(d2.getHours() * 60 + d2.getMinutes());
      }, 60_000);
    }, msUntilNext);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const baseTime = React.useMemo(() => {
    if (!labourTimeSetData || labourTimeSetData.length === 0) {
      return null;
    }

    const earliest = labourTimeSetData.reduce((acc, cur) => {
      return new Date(cur.encounterDatetime).getTime() < new Date(acc.encounterDatetime).getTime() ? cur : acc;
    }, labourTimeSetData[0]);

    return earliest.time;
  }, [labourTimeSetData]);

  const getSessionLastAcknowledgedMs = React.useCallback(
    (periodStartMs: number, periodEndMs: number) => {
      void alertSessionVersion;

      return getLastAcknowledgedMsForPeriod(
        periodStartMs,
        periodEndMs,
        getSharedDecisionEntryTimesMs(mergedSharedDecisionMakingEntries),
        alertSessionAcknowledgedAtMsRef.current.get(periodStartMs) ?? 0,
      );
    },
    [alertSessionVersion, mergedSharedDecisionMakingEntries],
  );

  const acknowledgeSharedDecisionAlertSession = React.useCallback(
    (entry: SharedDecisionMakingEntry) => {
      const entryTimeMs = resolveAlertCreatedTimeMs(entry);
      const cellBounds = getLcgHourlyCellBoundsForEntry(baseTime, entry);
      if (entryTimeMs === null || cellBounds === null) {
        return;
      }

      const { periodStartMs } = cellBounds;
      const previousAck = alertSessionAcknowledgedAtMsRef.current.get(periodStartMs) ?? 0;
      alertSessionAcknowledgedAtMsRef.current.set(periodStartMs, Math.max(previousAck, entryTimeMs));
      setLastAutoPromptKey(null);
      setSharedDecisionAutoPromptSummary(null);
      setSharedDecisionAutoPromptItems([]);
      setAlertSessionVersion((value) => value + 1);
    },
    [baseTime],
  );

  const workflowStopState = React.useMemo(() => {
    if (!baseTime) {
      return null;
    }

    const sortedEntries = [...mergedSharedDecisionMakingEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );

    for (const entry of sortedEntries) {
      const stopLabel = resolveStopActionLabel(entry.action);
      if (!stopLabel) {
        continue;
      }

      const entryTime = entry.time ?? formatHHMM(new Date(entry.encounterDatetime));

      return {
        action: entry.action,
        label: stopLabel,
        time: entryTime,
        slotIndex: 0,
      };
    }

    return null;
  }, [baseTime, mergedSharedDecisionMakingEntries]);

  const birthEvents = React.useMemo(() => {
    if (!baseTime) {
      return [] as Array<{ action: string; label: 'BIRTH'; time: string; slotIndex: number }>;
    }

    const totalSlots = activeFirstStageHours.length + secondStageHours.length;
    const sortedEntries = [...mergedSharedDecisionMakingEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );

    const events: Array<{ action: string; label: 'BIRTH'; time: string; slotIndex: number }> = [];
    for (const entry of sortedEntries) {
      const birthLabel = resolveBirthActionLabel(entry.action);
      if (birthLabel !== 'BIRTH') {
        continue;
      }

      const entryTime = entry.time ?? formatHHMM(new Date(entry.encounterDatetime));
      const slotIndex = getPointSlotIndexForTime(
        baseTime,
        entryTime,
        totalSlots,
        SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
      );

      if (slotIndex === null) {
        continue;
      }

      events.push({
        action: entry.action,
        label: 'BIRTH',
        time: entryTime,
        slotIndex,
      });
    }

    return events;
  }, [baseTime, mergedSharedDecisionMakingEntries]);

  const isWorkflowStopped = Boolean(workflowStopState);

  const sessionTerminationState = React.useMemo(
    () => buildSessionTerminationState(mergedSharedDecisionMakingEntries),
    [mergedSharedDecisionMakingEntries],
  );

  const isSessionTerminated = Boolean(sessionTerminationState);
  const isClinicalWorkflowStopped = isWorkflowStopped && !isSessionTerminated;

  const pendingSharedDecisionPrompt = React.useMemo(() => {
    if (!baseTime) {
      return null;
    }

    const nowMs = Date.now();
    const promptsByPeriod = new Map<number, SharedDecisionPromptCandidate>();

    const addPromptItem = (
      entryTimeMs: number,
      periodStartMs: number,
      periodEndMs: number,
      section: string,
      token: string,
      guidance: string,
    ) => {
      const lastAcknowledgedMs = getSessionLastAcknowledgedMs(periodStartMs, periodEndMs);
      if (!isLcgAlertObservationActive(entryTimeMs, periodStartMs, periodEndMs, lastAcknowledgedMs, nowMs)) {
        return;
      }

      const activatesAtMs = computeLcgAlertActivationMs(
        entryTimeMs,
        periodEndMs,
        LCG_SHARED_DECISION_ALERT_TIMER_MINUTES,
      );

      if (!promptsByPeriod.has(periodStartMs)) {
        promptsByPeriod.set(periodStartMs, {
          triggerTimeMs: entryTimeMs,
          activatesAtMs,
          expiresAtMs: periodEndMs,
          periodStartMs,
          summaryParts: [],
          items: [],
        });
      } else {
        const existing = promptsByPeriod.get(periodStartMs)!;
        if (entryTimeMs > existing.triggerTimeMs) {
          existing.triggerTimeMs = entryTimeMs;
          existing.activatesAtMs = activatesAtMs;
        }
      }

      const prompt = promptsByPeriod.get(periodStartMs)!;
      const alertId = buildLcgAlertId(periodStartMs, section, token, entryTimeMs);
      const isDuplicate = prompt.items.some((item) => item.id === alertId);
      if (!isDuplicate) {
        prompt.items.push({
          id: alertId,
          section,
          code: token,
          guidance,
          timestampCreatedMs: entryTimeMs,
        });
      }
    };

    const addEntryAlerts = (
      entry: { encounterDatetime?: string; time?: string },
      tokens: string[],
      section: string,
      guidanceForToken: (token: string) => string,
    ) => {
      if (tokens.length === 0) {
        return;
      }

      const entryTimeMs = resolveAlertCreatedTimeMs(entry);
      const cellBounds = getLcgHourlyCellBoundsForEntry(baseTime, entry);
      if (entryTimeMs === null || cellBounds === null) {
        return;
      }

      const { periodStartMs, periodEndMs } = cellBounds;
      for (const token of tokens) {
        addPromptItem(entryTimeMs, periodStartMs, periodEndMs, section, token, guidanceForToken(token));
      }
    };

    for (const entry of mergedSupportiveCareEntries) {
      addEntryAlerts(entry, getSupportiveAlertTokens(entry), 'Supportive Care', (token) =>
        getSupportiveAlertTokenGuidance(t, token),
      );
    }

    for (const entry of mergedBabyEntries) {
      addEntryAlerts(entry, getBabyAlertTokens(entry), 'Baby', (token) => getBabyAlertTokenGuidance(t, token));
    }

    for (const entry of debouncedMergedWomanAlertEntries) {
      addEntryAlerts(entry, getWomanAlertTokens(entry), 'Woman', (token) => getWomanAlertTokenGuidance(t, token));
    }

    for (const entry of debouncedMergedLabourProgressEntries) {
      addEntryAlerts(entry, getContractionAlertTokens(entry), 'Labour Progress', (token) =>
        getContractionAlertTokenGuidance(t, token),
      );
    }

    {
      const dilationEntries = debouncedMergedLabourProgressEntries
        .filter((e): e is typeof e & { cervicalDilation: number } => e.cervicalDilation != null)
        .map((e) => ({ entry: e, timeMs: resolveEntryTimeMs(e) }))
        .filter((e): e is { entry: typeof e.entry; timeMs: number } => e.timeMs !== null)
        .sort((a, b) => a.timeMs - b.timeMs);

      const firstEntryTimeByDilation = new Map<number, number>();
      for (const { entry, timeMs } of dilationEntries) {
        if (!firstEntryTimeByDilation.has(entry.cervicalDilation)) {
          firstEntryTimeByDilation.set(entry.cervicalDilation, timeMs);
        }
      }

      for (const { entry, timeMs } of dilationEntries) {
        const dilation = entry.cervicalDilation;
        const stallThresholdHours = LCG_CERVIX_FIRST_STAGE_LAG_HOURS_BY_DILATION[dilation];
        if (!stallThresholdHours) {
          continue;
        }

        const firstTimeMs = firstEntryTimeByDilation.get(dilation)!;
        if (timeMs === firstTimeMs) {
          continue;
        }

        const elapsedMs = timeMs - firstTimeMs;
        const thresholdMs = scaleLcgGuidelineMinutes(stallThresholdHours * 60) * 60_000;
        if (elapsedMs < thresholdMs) {
          continue;
        }

        const token = `${dilation}cm (No progress ≥${stallThresholdHours}h)`;
        addEntryAlerts(entry, [token], 'Labour Progress', () => getCervixStallTokenGuidance(t, token));
      }
    }

    for (const prompt of promptsByPeriod.values()) {
      const sectionSummaries = new Map<string, string[]>();
      for (const item of prompt.items) {
        if (!sectionSummaries.has(item.section)) {
          sectionSummaries.set(item.section, []);
        }
        sectionSummaries.get(item.section)!.push(item.code);
      }

      prompt.summaryParts = Array.from(sectionSummaries.entries()).map(
        ([section, codes]) => `${section}: ${codes.join(', ')}`,
      );
    }

    const unhandledPrompts = Array.from(promptsByPeriod.values())
      .filter((prompt) => {
        const lastAcknowledgedMs = getSessionLastAcknowledgedMs(prompt.periodStartMs, prompt.expiresAtMs);
        return !isLcgMicroSessionPromptRetired(
          prompt.triggerTimeMs,
          prompt.periodStartMs,
          prompt.expiresAtMs,
          lastAcknowledgedMs,
          nowMs,
        );
      })
      .sort((a, b) => b.triggerTimeMs - a.triggerTimeMs);

    const prompt = unhandledPrompts[0];
    if (!prompt || prompt.items.length === 0) {
      return null;
    }

    return {
      triggerTimeMs: prompt.triggerTimeMs,
      activatesAtMs: prompt.activatesAtMs,
      expiresAtMs: prompt.expiresAtMs,
      periodStartMs: prompt.periodStartMs,
      summary: prompt.summaryParts.join('   '),
      items: prompt.items,
    };
  }, [
    baseTime,
    getSessionLastAcknowledgedMs,
    mergedSupportiveCareEntries,
    mergedBabyEntries,
    debouncedMergedWomanAlertEntries,
    debouncedMergedLabourProgressEntries,
    t,
  ]);

  React.useEffect(() => {
    if (admissionData) {
      const otherRiskFactorText = admissionData.riskFactorOtherText?.trim() ?? '';
      const riskFactorsDisplay = Array.isArray(admissionData.riskFactors)
        ? admissionData.riskFactors
            .map((risk) => {
              switch (risk) {
                case LCG_ADMISSION_RISK_FACTOR_CODE.chronicHypertension:
                  return t('chronicHypertension', 'Chronic hypertension');
                case LCG_ADMISSION_RISK_FACTOR_CODE.preEclampsia:
                  return t('preEclampsia', 'Pre-eclampsia');
                case LCG_ADMISSION_RISK_FACTOR_CODE.advancedAge:
                  return t('advancedAge', "Woman's advanced age");
                case LCG_ADMISSION_RISK_FACTOR_CODE.adolescentPregnancy:
                  return t('adolescentPregnancy', 'Adolescent pregnancy');
                case LCG_ADMISSION_RISK_FACTOR_CODE.pretermLabour:
                  return t('pretermLabour', 'Preterm labour');
                case LCG_ADMISSION_RISK_FACTOR_CODE.multipleGestation:
                  return t('multipleGestation', 'Multiple gestation');
                case LCG_ADMISSION_RISK_FACTOR_CODE.colonization:
                  return t('colonization', 'Colonization');
                case LCG_ADMISSION_RISK_FACTOR_CODE.other:
                  return otherRiskFactorText ? `${t('other', 'Other')}: ${otherRiskFactorText}` : t('other', 'Other');
                case LCG_ADMISSION_RISK_FACTOR_CODE.none:
                  return t('none', 'None');
                default:
                  return risk;
              }
            })
            .join(', ')
        : '';

      const normalizedRupturedMembranes = (admissionData.rupturedMembranes ?? '').toLowerCase();
      const shouldUseRuptureDateTime = normalizedRupturedMembranes === 'yes';

      setAdmissionDetails((prev) => ({
        ...prev,
        labourOnset: admissionData.labourOnset || prev.labourOnset,
        activeLabourDiagnosisDate: admissionData.activeLabourDiagnosisDate || prev.activeLabourDiagnosisDate,
        riskFactors: riskFactorsDisplay || prev.riskFactors,
        riskFactorOtherText: otherRiskFactorText,
        rupturedMembranes: admissionData.rupturedMembranes || prev.rupturedMembranes,
        rupturedMembranesDate: shouldUseRuptureDateTime ? admissionData.rupturedMembranesDate || '' : '',
        rupturedMembranesTime: shouldUseRuptureDateTime ? admissionData.rupturedMembranesTime || '' : '',
      }));
    }
  }, [admissionData, t]);

  const admissionDetailsFilled = Boolean(
    admissionDetails.labourOnset ||
    admissionDetails.activeLabourDiagnosisDate ||
    admissionDetails.rupturedMembranes ||
    admissionDetails.riskFactors ||
    admissionDetails.ipNumber,
  );

  const sharedDecisionAutoPromptDebugWindow = React.useMemo(() => {
    if (!pendingSharedDecisionPrompt) {
      return undefined;
    }

    return {
      triggerTimeMs: pendingSharedDecisionPrompt.triggerTimeMs,
      openAtMs: pendingSharedDecisionPrompt.activatesAtMs,
      expiresAtMs: pendingSharedDecisionPrompt.expiresAtMs,
    };
  }, [pendingSharedDecisionPrompt]);

  const cdsPendingAlert = React.useMemo<CdsPendingAlertPayload | null>(() => {
    if (!pendingSharedDecisionPrompt) {
      return null;
    }

    return {
      triggerTimeMs: pendingSharedDecisionPrompt.triggerTimeMs,
      activatesAtMs: pendingSharedDecisionPrompt.activatesAtMs,
      expiresAtMs: pendingSharedDecisionPrompt.expiresAtMs,
      periodStartMs: pendingSharedDecisionPrompt.periodStartMs,
      summary: pendingSharedDecisionPrompt.summary,
      items: pendingSharedDecisionPrompt.items,
    };
  }, [pendingSharedDecisionPrompt]);

  const activeSharedDecisionAlerts = React.useMemo<SharedDecisionPromptItem[]>(() => {
    if (isWorkflowStopped || !baseTime) {
      return [];
    }

    const nowMs = Date.now();

    const dedupedAlerts = new Map<string, SharedDecisionPromptItem & { observedAtMs: number }>();
    const addAlert = (
      section: string,
      code: string,
      guidance: string,
      observedAtMs: number | null,
      entry: { encounterDatetime?: string; time?: string },
    ) => {
      const normalizedCode = String(code ?? '').trim();
      if (!section || !normalizedCode || observedAtMs === null) {
        return;
      }

      const cellBounds = getLcgHourlyCellBoundsForEntry(baseTime, entry);
      if (cellBounds === null) {
        return;
      }

      const lastAcknowledgedMs = getSessionLastAcknowledgedMs(cellBounds.periodStartMs, cellBounds.periodEndMs);
      if (
        !isLcgAlertObservationActive(
          observedAtMs,
          cellBounds.periodStartMs,
          cellBounds.periodEndMs,
          lastAcknowledgedMs,
          nowMs,
        )
      ) {
        return;
      }

      const alertId = buildLcgAlertId(cellBounds.periodStartMs, section, normalizedCode, observedAtMs);
      const existing = dedupedAlerts.get(alertId);
      if (!existing) {
        dedupedAlerts.set(alertId, {
          id: alertId,
          section,
          code: normalizedCode,
          guidance,
          timestampCreatedMs: observedAtMs,
          observedAtMs,
        });
      }
    };

    for (const entry of mergedSupportiveCareEntries) {
      const alerts = getSupportiveAlertTokens(entry);
      const observedAtMs = resolveAlertCreatedTimeMs(entry);
      for (const token of alerts) {
        addAlert('Supportive Care', token, getSupportiveAlertTokenGuidance(t, token), observedAtMs, entry);
      }
    }

    for (const entry of mergedBabyEntries) {
      const alerts = getBabyAlertTokens(entry);
      const observedAtMs = resolveAlertCreatedTimeMs(entry);
      for (const token of alerts) {
        addAlert('Baby', token, getBabyAlertTokenGuidance(t, token), observedAtMs, entry);
      }
    }

    for (const entry of debouncedMergedWomanAlertEntries) {
      const alerts = getWomanAlertTokens(entry);
      const observedAtMs = resolveAlertCreatedTimeMs(entry);
      for (const token of alerts) {
        addAlert('Woman', token, getWomanAlertTokenGuidance(t, token), observedAtMs, entry);
      }
    }

    for (const entry of debouncedMergedLabourProgressEntries) {
      const alerts = getContractionAlertTokens(entry);
      const observedAtMs = resolveAlertCreatedTimeMs(entry);
      for (const token of alerts) {
        addAlert('Labour Progress', token, getContractionAlertTokenGuidance(t, token), observedAtMs, entry);
      }
    }

    const dilationEntries = debouncedMergedLabourProgressEntries
      .filter((e): e is typeof e & { cervicalDilation: number } => e.cervicalDilation != null)
      .map((e) => ({ entry: e, timeMs: resolveEntryTimeMs(e) }))
      .filter((e): e is { entry: typeof e.entry; timeMs: number } => e.timeMs !== null)
      .sort((a, b) => a.timeMs - b.timeMs);

    const firstEntryTimeByDilation = new Map<number, number>();
    for (const { entry, timeMs } of dilationEntries) {
      if (!firstEntryTimeByDilation.has(entry.cervicalDilation)) {
        firstEntryTimeByDilation.set(entry.cervicalDilation, timeMs);
      }
    }

    for (const { entry, timeMs } of dilationEntries) {
      const dilation = entry.cervicalDilation;
      const stallThresholdHours = LCG_CERVIX_FIRST_STAGE_LAG_HOURS_BY_DILATION[dilation];
      if (!stallThresholdHours) {
        continue;
      }

      const firstTimeMs = firstEntryTimeByDilation.get(dilation)!;
      if (timeMs === firstTimeMs) {
        continue;
      }

      const elapsedMs = timeMs - firstTimeMs;
      const thresholdMs = scaleLcgGuidelineMinutes(stallThresholdHours * 60) * 60_000;
      if (elapsedMs < thresholdMs) {
        continue;
      }

      const token = `${dilation}cm (No progress ≥${stallThresholdHours}h)`;
      addAlert('Labour Progress', token, getCervixStallTokenGuidance(t, token), timeMs, entry);
    }

    return Array.from(dedupedAlerts.values())
      .map(({ observedAtMs: _observedAtMs, ...alert }) => alert)
      .sort((left, right) => left.section.localeCompare(right.section) || left.code.localeCompare(right.code));
  }, [
    baseTime,
    getSessionLastAcknowledgedMs,
    isWorkflowStopped,
    mergedSupportiveCareEntries,
    mergedBabyEntries,
    debouncedMergedWomanAlertEntries,
    debouncedMergedLabourProgressEntries,
    t,
  ]);

  React.useEffect(() => {
    if (!pendingSharedDecisionPrompt || isWorkflowStopped || isSharedDecisionMakingFormOpen) {
      return;
    }

    const nowMs = Date.now();
    const promptKey = `${pendingSharedDecisionPrompt.triggerTimeMs}-${pendingSharedDecisionPrompt.summary}`;
    const lastAcknowledgedMs = getSessionLastAcknowledgedMs(
      pendingSharedDecisionPrompt.periodStartMs,
      pendingSharedDecisionPrompt.expiresAtMs,
    );
    const isRetired = isLcgMicroSessionPromptRetired(
      pendingSharedDecisionPrompt.triggerTimeMs,
      pendingSharedDecisionPrompt.periodStartMs,
      pendingSharedDecisionPrompt.expiresAtMs,
      lastAcknowledgedMs,
      nowMs,
    );

    if (
      isRetired ||
      !shouldFireLcgAlertAlarm(
        nowMs,
        pendingSharedDecisionPrompt.activatesAtMs,
        pendingSharedDecisionPrompt.expiresAtMs,
        isRetired,
      )
    ) {
      return;
    }

    if (promptKey !== lastAutoPromptKey) {
      setSharedDecisionAutoPromptSummary(pendingSharedDecisionPrompt.summary);
      setSharedDecisionAutoPromptItems(pendingSharedDecisionPrompt.items);
      setIsSharedDecisionMakingFormOpen(true);
      setLastAutoPromptKey(promptKey);
    }
  }, [
    getSessionLastAcknowledgedMs,
    isSharedDecisionMakingFormOpen,
    isWorkflowStopped,
    lastAutoPromptKey,
    nowMinutes,
    pendingSharedDecisionPrompt,
  ]);

  React.useEffect(() => {
    if (!pendingSharedDecisionPrompt) {
      setLastAutoPromptKey(null);
    }
  }, [pendingSharedDecisionPrompt]);

  React.useEffect(() => {
    if (!pendingSharedDecisionPrompt) {
      return;
    }

    const nowMs = Date.now();

    if (nowMs >= pendingSharedDecisionPrompt.expiresAtMs) {
      if (isSharedDecisionMakingFormOpen && sharedDecisionAutoPromptSummary !== null) {
        setIsSharedDecisionMakingFormOpen(false);
        setSharedDecisionAutoPromptSummary(null);
        setSharedDecisionAutoPromptItems([]);
      }
      setLastAutoPromptKey(null);
    }
  }, [isSharedDecisionMakingFormOpen, nowMinutes, pendingSharedDecisionPrompt, sharedDecisionAutoPromptSummary]);

  return {
    isTimeFormOpen,
    setIsTimeFormOpen,
    isSupportiveCareFormOpen,
    setIsSupportiveCareFormOpen,
    isBabyFormOpen,
    setIsBabyFormOpen,
    isWomanFormOpen,
    setIsWomanFormOpen,
    isContractionsFormOpen,
    setIsContractionsFormOpen,
    isLabourProgressFormOpen,
    setIsLabourProgressFormOpen,
    isMedicationFormOpen,
    setIsMedicationFormOpen,
    isSharedDecisionMakingFormOpen,
    setIsSharedDecisionMakingFormOpen,
    sharedDecisionAutoPromptSummary,
    setSharedDecisionAutoPromptSummary,
    sharedDecisionAutoPromptItems,
    setSharedDecisionAutoPromptItems,
    isAdmissionDetailsFormOpen,
    setIsAdmissionDetailsFormOpen,
    labourProgressRefreshToken,
    localSupportiveCareEntries,
    setLocalSupportiveCareEntries,
    localMedicationEntries,
    setLocalMedicationEntries,
    localBabyEntries,
    setLocalBabyEntries,
    localLabourProgressEntries,
    setLocalLabourProgressEntries,
    localWomanEntries,
    setLocalWomanEntries,
    localSharedDecisionMakingEntries,
    setLocalSharedDecisionMakingEntries,
    admissionDetails,
    setAdmissionDetails,
    admissionDetailsFilled,
    mutateAdmissionDetails,
    mutateLabourTimeSetData,
    mutateBabyData,
    mutateMedicationData,
    mutateSupportiveCareData,
    mutateSharedDecisionMakingData,
    mutateWomanPartographyData,
    mergedMedicationEntries,
    mergedSupportiveCareEntries,
    mergedBabyEntries,
    mergedSharedDecisionMakingEntries,
    mergedLabourProgressEntries,
    womanFormExistingTimeEntries,
    handleWomanFormSubmit,
    handleLabourProgressFormSubmit,
    admissionRiskFactorCodes,
    birthEvents,
    nowMinutes,
    baseTime,
    workflowStopState,
    isWorkflowStopped,
    isSessionTerminated,
    isClinicalWorkflowStopped,
    sessionTerminationState,
    correctionAuditRecord,
    mutateCorrectionAudit,
    sharedDecisionAutoPromptDebugWindow,
    cdsPendingAlert,
    activeSharedDecisionAlerts,
    acknowledgeSharedDecisionAlertSession,
    cervicalEncounters,
  };
}
