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
import { createPartographyEncounter, usePartographyData } from '../partography.resource';
import type { WomanLocalEntry } from '../graphs/woman.component';
import type { LabourProgressEntry } from '../graphs/labour-progress.component';
import type { LabourProgressFormData } from '../forms/labour-progress-form.component';
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
  parseCervicalDilationValue,
  parseDescentOfHeadValue,
  parseUrgeToPushValue,
  resolveBirthActionLabel,
  resolveStopActionLabel,
  secondStageHours,
} from '../labour-care-guide.utils';
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

type SharedDecisionPromptItem = { section: string; code: string; guidance: string };

type CdsPendingAlertPayload = {
  triggerTimeMs: number;
  activatesAtMs: number;
  expiresAtMs: number;
  summary: string;
  items: SharedDecisionPromptItem[];
};

type SharedDecisionPromptCandidate = {
  triggerTimeMs: number;
  activatesAtMs: number;
  expiresAtMs: number;
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

const resolveEntryTimeMs = (entry: { encounterDatetime?: string; time?: string }) => {
  const encounterDate = new Date(entry.encounterDatetime ?? Date.now());
  const resolvedTime = entry.time?.trim();

  if (!resolvedTime) {
    const fallbackTime = encounterDate.getTime();
    return Number.isFinite(fallbackTime) ? fallbackTime : null;
  }

  const [hours, minutes] = resolvedTime.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  const entryDate = new Date(encounterDate);
  entryDate.setHours(hours, minutes, 0, 0);
  const entryTimeMs = entryDate.getTime();

  return Number.isFinite(entryTimeMs) ? entryTimeMs : null;
};

const getEntryPeriodStartMs = (entry: { encounterDatetime?: string; time?: string }) => {
  const entryTimeMs = resolveEntryTimeMs(entry);
  if (entryTimeMs === null) {
    return null;
  }

  const periodMs = LCG_SHARED_DECISION_PROMPT_HOUR_MINUTES * 60_000;
  return Math.floor(entryTimeMs / periodMs) * periodMs;
};

export function useLcgData(patientUuid: string) {
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
  const [isAdmissionDetailsFormOpen, setIsAdmissionDetailsFormOpen] = React.useState(false);
  const [labourProgressRefreshToken, setLabourProgressRefreshToken] = React.useState(0);
  const [localSupportiveCareEntries, setLocalSupportiveCareEntries] = React.useState<SupportiveCareEntry[]>([]);
  const [localMedicationEntries, setLocalMedicationEntries] = React.useState<MedicationEntry[]>([]);
  const [localBabyEntries, setLocalBabyEntries] = React.useState<BabyEntry[]>([]);
  const [localLabourProgressEntries, setLocalLabourProgressEntries] = React.useState<LabourProgressEntry[]>([]);
  const [localWomanEntries, setLocalWomanEntries] = React.useState<WomanLocalEntry[]>([]);
  const [localSharedDecisionMakingEntries, setLocalSharedDecisionMakingEntries] = React.useState<
    SharedDecisionMakingEntry[]
  >([]);
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
  const { labourTimeSetData, mutate: mutateLabourTimeSetData } = useLabourTimeSetData(patientUuid, true);
  const { babyEntries, mutate: mutateBabyData } = useBabyData(patientUuid, true);
  const { medicationEntries, mutate: mutateMedicationData } = useMedicationData(patientUuid);
  const { supportiveCareEntries, mutate: mutateSupportiveCareData } = useSupportiveCareData(patientUuid, true);
  const { entries: sharedDecisionMakingEntries, mutate: mutateSharedDecisionMakingData } = useSharedDecisionMakingData(
    patientUuid,
    true,
  );
  const { data: womanPulseBpEncounters = [] } = usePartographyData(patientUuid, 'pulse-bp-combined');
  const { data: womanTemperatureEncounters = [] } = usePartographyData(patientUuid, 'temperature');
  const { data: womanUrineEncounters = [] } = usePartographyData(patientUuid, 'urine-analysis');
  const { data: labourContractionEncounters = [] } = usePartographyData(patientUuid, 'uterine-contractions');
  const { data: cervicalEncounters = [] } = usePartographyData(patientUuid, 'cervical-dilation');
  const { data: labourDescentEncounters = [] } = usePartographyData(patientUuid, 'descent-of-head');

  const mergedMedicationEntries = React.useMemo(() => {
    const merged = new Map<string, MedicationEntry>();
    for (const entry of [...medicationEntries, ...localMedicationEntries]) {
      merged.set(entry.id, entry);
    }
    return Array.from(merged.values()).sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );
  }, [medicationEntries, localMedicationEntries]);

  const mergedSupportiveCareEntries = React.useMemo(() => {
    const merged = new Map<string, SupportiveCareEntry>();
    for (const entry of [...supportiveCareEntries, ...localSupportiveCareEntries]) {
      merged.set(entry.id, entry);
    }
    return Array.from(merged.values()).sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );
  }, [supportiveCareEntries, localSupportiveCareEntries]);

  const mergedBabyEntries = React.useMemo(() => {
    const merged = new Map<string, BabyEntry>();
    const orderedEntries = [...babyEntries, ...localBabyEntries].sort(
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
  }, [babyEntries, localBabyEntries]);

  const mergedSharedDecisionMakingEntries = React.useMemo(() => {
    const normalizedApiEntries = sharedDecisionMakingEntries.map((entry) => ({
      ...entry,
      action: normalizeSharedDecisionMakingAction(entry.action),
    }));
    const normalizedLocalEntries = localSharedDecisionMakingEntries.map((entry) => ({
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
  }, [sharedDecisionMakingEntries, localSharedDecisionMakingEntries]);

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
        const contractionsPer10Mins = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['contraction-count']);
        const durationOfContractions = getEncounterObsValue(
          encounter,
          PARTOGRAPHY_CONCEPTS['uterine-contraction-duration'],
        );
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

    const orderedEntries = [...apiEntries, ...localLabourProgressEntries].sort(
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
  }, [cervicalEncounters, labourContractionEncounters, labourDescentEncounters, localLabourProgressEntries]);

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

    for (const entry of localWomanEntries) {
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
  }, [womanPulseBpEncounters, womanTemperatureEncounters, womanUrineEncounters, localWomanEntries]);

  const womanFormExistingTimeEntries = React.useMemo(() => {
    const apiEntries = [...womanPulseBpEncounters, ...womanTemperatureEncounters, ...womanUrineEncounters]
      .map((encounter: any) => ({
        time: getEncounterRecordedTime(encounter),
        encounterDatetime: encounter?.encounterDatetime ?? '',
      }))
      .filter((entry) => Boolean(entry.time));

    const localTimeEntries = localWomanEntries.map((entry) => ({
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
  }, [localWomanEntries, womanPulseBpEncounters, womanTemperatureEncounters, womanUrineEncounters]);

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
    },
    [patientUuid],
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
      setLocalLabourProgressEntries((prev) => [
        ...prev,
        {
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
        },
      ]);

      setLabourProgressRefreshToken((value) => value + 1);
    },
    [patientUuid, t],
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

  const pendingSharedDecisionPrompt = React.useMemo(() => {
    const nowMs = Date.now();
    const promptPeriodMs = LCG_SHARED_DECISION_PROMPT_HOUR_MINUTES * 60_000;
    const promptsByPeriod = new Map<number, SharedDecisionPromptCandidate>();

    // entryTimeMs: the actual wall-clock time the entry was recorded.
    // activatesAtMs is anchored on the EARLIEST entry in each period so the
    // 30-minute (scaled) countdown starts from when data was actually entered,
    // not from the period boundary. This prevents the alert from firing
    // immediately when data is submitted late within a period.
    const addPromptItem = (
      entryTimeMs: number,
      periodStartMs: number,
      section: string,
      token: string,
      guidance: string,
    ) => {
      if (!promptsByPeriod.has(periodStartMs)) {
        promptsByPeriod.set(periodStartMs, {
          triggerTimeMs: entryTimeMs,
          activatesAtMs: entryTimeMs + LCG_SHARED_DECISION_ALERT_TIMER_MINUTES * 60_000,
          expiresAtMs: periodStartMs + promptPeriodMs,
          summaryParts: [],
          items: [],
        });
      } else {
        const existing = promptsByPeriod.get(periodStartMs)!;
        if (entryTimeMs < existing.triggerTimeMs) {
          existing.triggerTimeMs = entryTimeMs;
          existing.activatesAtMs = entryTimeMs + LCG_SHARED_DECISION_ALERT_TIMER_MINUTES * 60_000;
        }
      }

      const prompt = promptsByPeriod.get(periodStartMs)!;
      const isDuplicate = prompt.items.some((item) => item.section === section && item.code === token);
      if (!isDuplicate) {
        prompt.items.push({ section, code: token, guidance });
      }
    };

    for (const entry of mergedSupportiveCareEntries) {
      const alerts = getSupportiveAlertTokens(entry);
      if (alerts.length === 0) {
        continue;
      }

      const entryTimeMs = resolveEntryTimeMs(entry);
      const periodStartMs = getEntryPeriodStartMs(entry);
      if (entryTimeMs === null || periodStartMs === null) {
        continue;
      }

      for (const token of alerts) {
        addPromptItem(entryTimeMs, periodStartMs, 'Supportive Care', token, getSupportiveAlertTokenGuidance(t, token));
      }
    }

    for (const entry of mergedBabyEntries) {
      const alerts = getBabyAlertTokens(entry);
      if (alerts.length === 0) {
        continue;
      }

      const entryTimeMs = resolveEntryTimeMs(entry);
      const periodStartMs = getEntryPeriodStartMs(entry);
      if (entryTimeMs === null || periodStartMs === null) {
        continue;
      }

      for (const token of alerts) {
        addPromptItem(entryTimeMs, periodStartMs, 'Baby', token, getBabyAlertTokenGuidance(t, token));
      }
    }

    // Woman vital-sign alerts
    for (const entry of mergedWomanAlertEntries) {
      const alerts = getWomanAlertTokens(entry);
      if (alerts.length === 0) {
        continue;
      }

      const entryTimeMs = resolveEntryTimeMs(entry);
      const periodStartMs = getEntryPeriodStartMs(entry);
      if (entryTimeMs === null || periodStartMs === null) {
        continue;
      }

      for (const token of alerts) {
        addPromptItem(entryTimeMs, periodStartMs, 'Woman', token, getWomanAlertTokenGuidance(t, token));
      }
    }

    // Contraction alerts (contractions/10min and duration)
    for (const entry of mergedLabourProgressEntries) {
      const alerts = getContractionAlertTokens(entry);
      if (alerts.length === 0) {
        continue;
      }

      const entryTimeMs = resolveEntryTimeMs(entry);
      const periodStartMs = getEntryPeriodStartMs(entry);
      if (entryTimeMs === null || periodStartMs === null) {
        continue;
      }

      for (const token of alerts) {
        addPromptItem(entryTimeMs, periodStartMs, 'Contraction', token, getContractionAlertTokenGuidance(t, token));
      }
    }

    // Cervical dilation stall alerts:
    // For each dilation level, find the first time it was recorded and compare
    // with each subsequent entry still at the same level. If the elapsed time
    // since the first reading >= the WHO stall threshold, raise an alert.
    {
      const dilationEntries = mergedLabourProgressEntries
        .filter((e): e is typeof e & { cervicalDilation: number } => e.cervicalDilation != null)
        .map((e) => ({ entry: e, timeMs: resolveEntryTimeMs(e) }))
        .filter((e): e is { entry: typeof e.entry; timeMs: number } => e.timeMs !== null)
        .sort((a, b) => a.timeMs - b.timeMs);

      // Track the earliest time each dilation level was first reached
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
          continue; // Skip the first occurrence — there is nothing to compare yet
        }

        const elapsedMs = timeMs - firstTimeMs;
        const thresholdMs = scaleLcgGuidelineMinutes(stallThresholdHours * 60) * 60_000;
        if (elapsedMs < thresholdMs) {
          continue;
        }

        const periodStartMs = getEntryPeriodStartMs(entry);
        if (periodStartMs === null) {
          continue;
        }

        const token = `${dilation}cm (No progress ≥${stallThresholdHours}h)`;
        addPromptItem(timeMs, periodStartMs, 'Labour Progress', token, getCervixStallTokenGuidance(t, token));
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
        if (nowMs >= prompt.expiresAtMs) {
          return false;
        }

        return !mergedSharedDecisionMakingEntries.some((entry) => {
          if (!hasSharedDecisionContent(entry)) {
            return false;
          }

          const entryTimeMs = resolveEntryTimeMs(entry);
          return entryTimeMs !== null && entryTimeMs >= prompt.triggerTimeMs && entryTimeMs < prompt.expiresAtMs;
        });
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
      summary: prompt.summaryParts.join('   '),
      items: prompt.items,
    };
  }, [
    mergedSupportiveCareEntries,
    mergedBabyEntries,
    mergedWomanAlertEntries,
    mergedLabourProgressEntries,
    mergedSharedDecisionMakingEntries,
    t,
  ]);

  React.useEffect(() => {
    if (admissionData) {
      const otherRiskFactorText = admissionData.riskFactorOtherText?.trim() ?? '';
      const riskFactorsDisplay = Array.isArray(admissionData.riskFactors)
        ? admissionData.riskFactors
            .map((risk) => {
              switch (risk) {
                case 'chronic_hypertension':
                  return t('chronicHypertension', 'Chronic hypertension');
                case 'pre_eclampsia':
                  return t('preEclampsia', 'Pre-eclampsia');
                case 'advanced_age':
                  return t('advancedAge', "Woman's advanced age");
                case 'adolescent_pregnancy':
                  return t('adolescentPregnancy', 'Adolescent pregnancy');
                case 'preterm_labour':
                  return t('pretermLabour', 'Preterm labour');
                case 'multiple_gestation':
                  return t('multipleGestation', 'Multiple gestation');
                case 'colonization':
                  return t('colonization', 'Colonization');
                case 'other':
                  return otherRiskFactorText ? `${t('other', 'Other')}: ${otherRiskFactorText}` : t('other', 'Other');
                case 'none':
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
      summary: pendingSharedDecisionPrompt.summary,
      items: pendingSharedDecisionPrompt.items,
    };
  }, [pendingSharedDecisionPrompt]);

  const activeSharedDecisionAlerts = React.useMemo<SharedDecisionPromptItem[]>(() => {
    if (isWorkflowStopped) {
      return [];
    }

    const nowMs = nowMinutes * 60_000;
    const alertLifetimeMs = LCG_SHARED_DECISION_PROMPT_HOUR_MINUTES * 60_000;

    const dedupedAlerts = new Map<string, SharedDecisionPromptItem & { observedAtMs: number }>();
    const addAlert = (section: string, code: string, guidance: string, observedAtMs: number | null) => {
      const normalizedCode = String(code ?? '').trim();
      if (!section || !normalizedCode || observedAtMs === null) {
        return;
      }

      if (nowMs >= observedAtMs + alertLifetimeMs) {
        return;
      }

      const key = `${section}|${normalizedCode}`;
      const existing = dedupedAlerts.get(key);
      if (!existing || observedAtMs > existing.observedAtMs) {
        dedupedAlerts.set(key, { section, code: normalizedCode, guidance, observedAtMs });
      }
    };

    for (const entry of mergedSupportiveCareEntries) {
      const alerts = getSupportiveAlertTokens(entry);
      const observedAtMs = resolveEntryTimeMs(entry);
      for (const token of alerts) {
        addAlert('Supportive Care', token, getSupportiveAlertTokenGuidance(t, token), observedAtMs);
      }
    }

    for (const entry of mergedBabyEntries) {
      const alerts = getBabyAlertTokens(entry);
      const observedAtMs = resolveEntryTimeMs(entry);
      for (const token of alerts) {
        addAlert('Baby', token, getBabyAlertTokenGuidance(t, token), observedAtMs);
      }
    }

    for (const entry of mergedWomanAlertEntries) {
      const alerts = getWomanAlertTokens(entry);
      const observedAtMs = resolveEntryTimeMs(entry);
      for (const token of alerts) {
        addAlert('Woman', token, getWomanAlertTokenGuidance(t, token), observedAtMs);
      }
    }

    for (const entry of mergedLabourProgressEntries) {
      const alerts = getContractionAlertTokens(entry);
      const observedAtMs = resolveEntryTimeMs(entry);
      for (const token of alerts) {
        addAlert('Contraction', token, getContractionAlertTokenGuidance(t, token), observedAtMs);
      }
    }

    const dilationEntries = mergedLabourProgressEntries
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
      addAlert('Labour Progress', token, getCervixStallTokenGuidance(t, token), timeMs);
    }

    return Array.from(dedupedAlerts.values())
      .map(({ observedAtMs: _observedAtMs, ...alert }) => alert)
      .sort((left, right) => left.section.localeCompare(right.section) || left.code.localeCompare(right.code));
  }, [
    isWorkflowStopped,
    mergedSupportiveCareEntries,
    mergedBabyEntries,
    mergedWomanAlertEntries,
    mergedLabourProgressEntries,
    nowMinutes,
    t,
  ]);

  React.useEffect(() => {
    if (!pendingSharedDecisionPrompt || isWorkflowStopped || isSharedDecisionMakingFormOpen) {
      return;
    }

    const nowMs = Date.now();
    const elapsedMs = nowMs - pendingSharedDecisionPrompt.triggerTimeMs;
    const elapsedMinutes = elapsedMs / 60_000;
    const promptKey = `${pendingSharedDecisionPrompt.triggerTimeMs}-${pendingSharedDecisionPrompt.summary}`;

    if (nowMs >= pendingSharedDecisionPrompt.expiresAtMs) {
      return;
    }

    if (
      elapsedMinutes >= LCG_SHARED_DECISION_ALERT_TIMER_MINUTES &&
      elapsedMinutes < LCG_SHARED_DECISION_PROMPT_HOUR_MINUTES &&
      promptKey !== lastAutoPromptKey
    ) {
      setSharedDecisionAutoPromptSummary(pendingSharedDecisionPrompt.summary);
      setSharedDecisionAutoPromptItems(pendingSharedDecisionPrompt.items);
      setIsSharedDecisionMakingFormOpen(true);
      setLastAutoPromptKey(promptKey);
    }
  }, [isSharedDecisionMakingFormOpen, isWorkflowStopped, lastAutoPromptKey, nowMinutes, pendingSharedDecisionPrompt]);

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
    sharedDecisionAutoPromptDebugWindow,
    cdsPendingAlert,
    activeSharedDecisionAlerts,
    cervicalEncounters,
  };
}
