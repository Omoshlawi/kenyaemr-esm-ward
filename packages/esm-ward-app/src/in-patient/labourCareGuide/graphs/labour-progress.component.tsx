import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Pagination,
} from '@carbon/react';
import styles from '../labour-care-guide.scss';
import { usePartographyData } from '../partography.resource';
import {
  LABOUR_PROGRESS_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  LABOUR_PROGRESS_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
  LCG_CERVIX_FIRST_STAGE_LAG_HOURS_BY_DILATION,
  LCG_FIRST_STAGE_CONTRACTION_INTERVAL_MINUTES,
  LCG_FIRST_STAGE_VAGINAL_EXAM_INTERVAL_MINUTES,
  LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES,
  LCG_SECOND_STAGE_DESCENT_INTERVAL_MINUTES,
  LCG_SECOND_STAGE_ALERT_HOURS_MULTIPAROUS,
  LCG_SECOND_STAGE_ALERT_HOURS_NULLIPAROUS,
  DESCENT_OF_HEAD_OPTIONS,
  LCG_TIME_INCREMENT_MINUTES,
  MEDICATION_FORM_CONCEPTS,
  PARTOGRAPHY_CONCEPTS,
  LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
  LCG_EMERGENCY_REASON_CONCEPT_UUID,
  scaleLcgGuidelineMinutes,
  TIMER_SLOT_CONCEPT_UUID,
  URGE_TO_PUSH_UUID,
  URINE_TEST_TIME_SLOT_CONCEPT,
} from '../types';
import {
  getPointSlotState,
  getStageAwarePointSlotIndexForTime,
  getStageAwareSlotIndexForTime,
  getForwardMinutesDelta,
  getSlotIndexForTime,
  parseHHMMToMinutes,
  type LcgSlotState,
} from '../time-slot-utils';
import { buildWomanScheduleState } from '../woman-schedule-utils';
import { getLabourContractionAlertInfo, type LabourContractionMetric } from '../alert-rules';
import { getLabourContractionObsFromEncounter } from '../labour-care-guide.utils';
import { SectionToolbar } from '../components/section-toolbar.component';

interface LabourProgressProps {
  patientUuid: string;
  activeFirstStageHours: number[];
  secondStageHours: number[];
  baseTime?: string;
  refreshToken?: number;
  entries?: LabourProgressEntry[];
  onContractionsAddClick?: () => void;
  onLabourProgressAddClick?: () => void;
  showViewToggle?: boolean;
  firstStageCutoffSlotIndex?: number;
  secondStageStartTime?: string;
  parityValue?: number;
  stopSlotIndex?: number;
}

type LabourProgressEntry = {
  id?: string;
  encounterDatetime?: string;
  time?: string;
  contractionsPer10Mins?: string;
  durationOfContractions?: string;
  cervicalDilation?: number;
  descentOfHead?: number;
  urgeToPush?: 'yes' | 'no' | '';
  isEmergency?: boolean;
  emergencyReason?: string;
};

export type { LabourProgressEntry };

type LabourContractionSlotEntries = {
  primary?: LabourProgressEntry;
  secondary?: LabourProgressEntry;
};

const labourContractionRows = [
  { parameter: 'Contractions per 10 min', labelLines: ['Contractions', 'per 10 min'], alert: '≤2, >5' },
  { parameter: 'Duration of contractions', labelLines: ['Duration of', 'contractions'], alert: '<20, >60' },
];

const cervixRows = [
  { level: 10, alert: '' },
  { level: 9, alert: '≥ 2h' },
  { level: 8, alert: '≥ 2.5h' },
  { level: 7, alert: '≥ 3h' },
  { level: 6, alert: '≥ 5h' },
  { level: 5, alert: '≥ 6h' },
];

const descentRows = [5, 4, 3, 2, 1, 0];
const MINUTES_IN_DAY = 24 * 60;

const CERVIX_FIRST_STAGE_LAG_MINUTES_BY_DILATION = Object.fromEntries(
  Object.entries(LCG_CERVIX_FIRST_STAGE_LAG_HOURS_BY_DILATION).map(([dilation, hours]) => [
    Number(dilation),
    scaleLcgGuidelineMinutes(hours * 60),
  ]),
) as Record<number, number>;
const SECOND_STAGE_CONTRACTION_MAX_WINDOW_MINUTES = LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES * 12;
const SECOND_STAGE_DESCENT_MAX_WINDOW_MINUTES = LCG_SECOND_STAGE_DESCENT_INTERVAL_MINUTES * 6;

// First-stage contraction slot options – must match the form so data saved anywhere in the
// slot window (minutes 0 … interval-1) is both accepted by the form and rendered in the graph.
const BABY_PRIMARY_FHR_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: LABOUR_PROGRESS_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  lateAllowanceMinutes: LCG_FIRST_STAGE_CONTRACTION_INTERVAL_MINUTES - 1,
};

const BABY_HALF_GRID_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
  offsetMinutes: LCG_FIRST_STAGE_CONTRACTION_INTERVAL_MINUTES,
  earlyAllowanceMinutes: LABOUR_PROGRESS_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  lateAllowanceMinutes: LCG_FIRST_STAGE_CONTRACTION_INTERVAL_MINUTES - 1,
};

// Second-stage quarters: one slot every LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES (15 guideline min).
// slotIntervalMinutes must equal the quarter interval so slotIndex maps to the correct real minute.
const SECOND_STAGE_CONTRACTION_QUARTER_OPTIONS = {
  slotIntervalMinutes: LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES - 1,
};

const formatEncounterTime = (encounterDatetime?: string) => {
  if (!encounterDatetime) {
    return '';
  }

  const encounterDate = new Date(encounterDatetime);
  if (Number.isNaN(encounterDate.getTime())) {
    return '';
  }

  return encounterDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getFallbackSlotIndex = (baseTime: string, time: string, totalSlots: number) => {
  if (totalSlots <= 0) {
    return null;
  }

  const baseMinutes = parseHHMMToMinutes(baseTime);
  const targetMinutes = parseHHMMToMinutes(time);

  if (baseMinutes === null || targetMinutes === null) {
    return totalSlots - 1;
  }

  let relativeMinutes = targetMinutes - baseMinutes;
  if (relativeMinutes < -LABOUR_PROGRESS_TIME_SLOT_EARLY_ALLOWANCE_MINUTES) {
    relativeMinutes += MINUTES_IN_DAY;
  }

  if (relativeMinutes <= 0) {
    return 0;
  }

  return Math.min(totalSlots - 1, Math.floor(relativeMinutes / LCG_TIME_INCREMENT_MINUTES));
};

const readObsValue = (obs: any) => {
  const value = obs?.value;

  if (value && typeof value === 'object') {
    if ('display' in value && typeof value.display === 'string') {
      return value.display;
    }

    if ('uuid' in value && typeof value.uuid === 'string') {
      return value.uuid;
    }
  }

  return value != null ? String(value) : '';
};

const getEncounterObsValue = (encounter: any, conceptUuid: string) => {
  const found = encounter?.obs?.find((obs: any) => obs.concept?.uuid === conceptUuid);
  return found ? readObsValue(found) : '';
};

const isEmergencyEncounter = (encounter: any) =>
  ['true', '1065aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'].includes(
    String(getEncounterObsValue(encounter, LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID)).toLowerCase(),
  );

const getEmergencyReason = (encounter: any) =>
  String(getEncounterObsValue(encounter, LCG_EMERGENCY_REASON_CONCEPT_UUID) || '');

const isMedicationOnlyEncounter = (encounter: any) => {
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

  return hasMedicationMarker && !hasContractionMarker;
};

const getEncounterRecordedTime = (encounter: any) => {
  const explicitTimeObs = encounter?.obs?.find(
    (obs: any) =>
      (obs.concept?.uuid === '160632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' ||
        obs.concept?.uuid === PARTOGRAPHY_CONCEPTS['pulse-time-slot'] ||
        obs.concept?.uuid === PARTOGRAPHY_CONCEPTS['time-slot'] ||
        obs.concept?.uuid === TIMER_SLOT_CONCEPT_UUID ||
        obs.concept?.uuid === URINE_TEST_TIME_SLOT_CONCEPT) &&
      typeof obs.value === 'string' &&
      (obs.value.startsWith('Time:') || /^\d{1,2}:\d{2}$/.test(obs.value)),
  );

  if (explicitTimeObs?.value) {
    const match = String(explicitTimeObs.value).match(/Time:\s*(.+)/);
    if (match) {
      return match[1].trim();
    }

    if (/^\d{1,2}:\d{2}$/.test(String(explicitTimeObs.value).trim())) {
      return String(explicitTimeObs.value).trim();
    }
  }

  return formatEncounterTime(encounter?.encounterDatetime);
};

const parseNumericValue = (value: string) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const parseCervicalDilationValue = (value: string) => {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return null;
  }

  const directNumericValue = parseNumericValue(normalizedValue);
  if (directNumericValue !== null) {
    if (directNumericValue <= 0) {
      return null;
    }
    return directNumericValue;
  }

  const match = normalizedValue.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return parsed > 0 ? parsed : null;
};

const parseUrgeToPushValue = (value: string) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized === 'yes' || normalized === '1065aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') {
    return 'yes';
  }

  if (normalized === 'no' || normalized === '1066aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') {
    return 'no';
  }

  return '';
};

const descentOptionByConcept = new Map(
  DESCENT_OF_HEAD_OPTIONS.filter((option) => option.conceptUuid).map((option) => [
    option.conceptUuid,
    option.stationValue,
  ]),
);

const parseDescentOfHeadValue = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const directNumericValue = parseNumericValue(trimmedValue);
  if (directNumericValue !== null) {
    return directNumericValue;
  }

  const mappedStationValue = descentOptionByConcept.get(trimmedValue);
  if (mappedStationValue !== undefined) {
    return mappedStationValue;
  }

  const match = trimmedValue.match(/([0-5])\s*\/\s*5|\b([0-5])\b/);
  if (match) {
    return Number(match[1] ?? match[2]);
  }

  return null;
};

const LabourProgress: React.FC<LabourProgressProps> = ({
  patientUuid,
  activeFirstStageHours,
  secondStageHours,
  baseTime,
  refreshToken = 0,
  entries = [],
  onContractionsAddClick,
  onLabourProgressAddClick,
  showViewToggle = true,
  firstStageCutoffSlotIndex,
  secondStageStartTime,
  parityValue = 0,
  stopSlotIndex,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = React.useState<'graph' | 'table'>('graph');
  const [firstRowIndex, setFirstRowIndex] = React.useState(0);
  const [currentPageSize, setCurrentPageSize] = React.useState(10);
  const labourProgressAddHandler = onLabourProgressAddClick ?? onContractionsAddClick;
  const totalSlots = activeFirstStageHours.length + secondStageHours.length;
  const { data: contractionEncounters = [], mutate: mutateContractions } = usePartographyData(
    patientUuid,
    'uterine-contractions',
  );
  const { data: cervicalEncounters = [], mutate: mutateCervical } = usePartographyData(
    patientUuid,
    'cervical-dilation',
  );
  const { data: descentEncounters = [], mutate: mutateDescent } = usePartographyData(patientUuid, 'descent-of-head');

  const mutateContractionsRef = React.useRef(mutateContractions);
  const mutateCervicalRef = React.useRef(mutateCervical);
  const mutateDescentRef = React.useRef(mutateDescent);
  mutateContractionsRef.current = mutateContractions;
  mutateCervicalRef.current = mutateCervical;
  mutateDescentRef.current = mutateDescent;

  React.useEffect(() => {
    if (refreshToken <= 0) {
      return;
    }

    void Promise.all([mutateContractionsRef.current(), mutateCervicalRef.current(), mutateDescentRef.current()]);
  }, [refreshToken]);

  const mergedEncounters = React.useMemo(() => {
    const merged = new Map<string, any>();

    for (const encounter of [...contractionEncounters, ...cervicalEncounters, ...descentEncounters]) {
      if (encounter?.uuid) {
        merged.set(encounter.uuid, encounter);
      }
    }

    return Array.from(merged.values()).sort(
      (left: any, right: any) =>
        new Date(left.encounterDatetime).getTime() - new Date(right.encounterDatetime).getTime(),
    );
  }, [cervicalEncounters, contractionEncounters, descentEncounters]);
  const mergedGraphEncounters = React.useMemo(
    () => mergedEncounters.filter((encounter) => !isEmergencyEncounter(encounter)),
    [mergedEncounters],
  );

  const slotEntries = React.useMemo(() => {
    const mappedEntries = new Map<number, LabourProgressEntry>();

    if (!baseTime) {
      return mappedEntries;
    }

    const upsertEntry = (encounter: any, partialEntry: Partial<LabourProgressEntry>) => {
      const slotTime = getEncounterRecordedTime(encounter);
      const slotIndex =
        getStageAwareSlotIndexForTime(
          baseTime,
          slotTime,
          activeFirstStageHours.length,
          secondStageHours.length,
          secondStageStartTime,
        ) ?? getFallbackSlotIndex(baseTime, slotTime, totalSlots);
      if (slotIndex === null) {
        return;
      }

      const existingEntry = mappedEntries.get(slotIndex) ?? {};
      mappedEntries.set(slotIndex, {
        ...existingEntry,
        ...(slotTime ? { time: slotTime } : {}),
        ...(encounter?.encounterDatetime ? { encounterDatetime: encounter.encounterDatetime } : {}),
        ...partialEntry,
        cervicalDilation:
          partialEntry.cervicalDilation !== undefined ? partialEntry.cervicalDilation : existingEntry.cervicalDilation,
        descentOfHead:
          partialEntry.descentOfHead !== undefined ? partialEntry.descentOfHead : existingEntry.descentOfHead,
      });
    };

    mergedGraphEncounters.forEach((encounter: any) => {
      if (isMedicationOnlyEncounter(encounter)) {
        return;
      }

      const { contractionsPer10Mins, durationOfContractions } = getLabourContractionObsFromEncounter(encounter);
      const cervicalDilation = parseCervicalDilationValue(
        getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['cervical-dilation']),
      );
      const descentOfHead = parseDescentOfHeadValue(
        getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['descent-of-head']),
      );
      const urgeToPush = parseUrgeToPushValue(getEncounterObsValue(encounter, URGE_TO_PUSH_UUID));

      if (
        contractionsPer10Mins ||
        durationOfContractions ||
        cervicalDilation !== null ||
        descentOfHead !== null ||
        urgeToPush
      ) {
        upsertEntry(encounter, {
          contractionsPer10Mins,
          durationOfContractions,
          ...(cervicalDilation !== null ? { cervicalDilation } : {}),
          ...(descentOfHead !== null ? { descentOfHead } : {}),
          ...(urgeToPush ? { urgeToPush } : {}),
        });
      }
    });

    entries
      .slice()
      .sort(
        (left, right) =>
          new Date(left.encounterDatetime ?? 0).getTime() - new Date(right.encounterDatetime ?? 0).getTime(),
      )
      .forEach((entry) => {
        if (!entry.time) {
          return;
        }

        const slotIndex =
          getStageAwareSlotIndexForTime(
            baseTime,
            entry.time,
            activeFirstStageHours.length,
            secondStageHours.length,
            secondStageStartTime,
          ) ?? getFallbackSlotIndex(baseTime, entry.time, totalSlots);
        if (slotIndex === null) {
          return;
        }

        const existingEntry = mappedEntries.get(slotIndex) ?? {};
        mappedEntries.set(slotIndex, {
          ...existingEntry,
          ...entry,
          cervicalDilation:
            entry.cervicalDilation !== undefined ? entry.cervicalDilation : existingEntry.cervicalDilation,
          descentOfHead: entry.descentOfHead !== undefined ? entry.descentOfHead : existingEntry.descentOfHead,
        });
      });

    return mappedEntries;
  }, [
    activeFirstStageHours.length,
    baseTime,
    entries,
    mergedGraphEncounters,
    secondStageHours.length,
    secondStageStartTime,
    totalSlots,
  ]);

  const lowerEntries = React.useMemo(
    () =>
      Array.from(slotEntries.values()).filter(
        (entry) =>
          Boolean(entry.cervicalDilation !== undefined || entry.descentOfHead !== undefined) && Boolean(entry.time),
      ),
    [slotEntries],
  );

  const firstStageLowerIntervalSlots = React.useMemo(
    () => Math.max(1, Math.round(LCG_FIRST_STAGE_VAGINAL_EXAM_INTERVAL_MINUTES / LCG_TIME_INCREMENT_MINUTES)),
    [],
  );

  const firstStageLowerSlotEntries = React.useMemo(() => {
    const mappedEntries = new Map<number, LabourProgressEntry>();

    if (!baseTime) {
      return mappedEntries;
    }

    const orderedEntries = [...lowerEntries].sort(
      (left, right) =>
        new Date(left.encounterDatetime ?? 0).getTime() - new Date(right.encounterDatetime ?? 0).getTime(),
    );

    for (const entry of orderedEntries) {
      if (!entry.time) {
        continue;
      }

      const currentSlotIndex =
        getStageAwareSlotIndexForTime(baseTime, entry.time ?? '', activeFirstStageHours.length, 0) ??
        getFallbackSlotIndex(baseTime, entry.time, activeFirstStageHours.length);

      if (currentSlotIndex === null || currentSlotIndex < 0 || currentSlotIndex >= activeFirstStageHours.length) {
        continue;
      }

      mappedEntries.set(currentSlotIndex, {
        ...(mappedEntries.get(currentSlotIndex) ?? {}),
        ...entry,
      });
    }

    return mappedEntries;
  }, [activeFirstStageHours.length, baseTime, lowerEntries]);

  const allLabourProgressEntries = React.useMemo<LabourProgressEntry[]>(() => {
    const combinedEntries: LabourProgressEntry[] = [];

    mergedEncounters.forEach((encounter: any) => {
      if (isMedicationOnlyEncounter(encounter)) {
        return;
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
        return;
      }

      combinedEntries.push({
        encounterDatetime: encounter?.encounterDatetime,
        time,
        contractionsPer10Mins: contractionsPer10Mins || undefined,
        durationOfContractions: durationOfContractions || undefined,
        ...(cervicalDilation !== null ? { cervicalDilation } : {}),
        ...(descentOfHead !== null ? { descentOfHead } : {}),
        ...(urgeToPush ? { urgeToPush } : {}),
        isEmergency: isEmergencyEncounter(encounter),
        emergencyReason: getEmergencyReason(encounter),
      });
    });

    for (const entry of entries) {
      if (!entry.time) {
        continue;
      }

      const mergeKey = entry.time;
      const existingIndex = combinedEntries.findIndex((candidate) => candidate.time === mergeKey);
      if (existingIndex === -1) {
        combinedEntries.push(entry);
        continue;
      }

      const existingEntry = combinedEntries[existingIndex];
      combinedEntries[existingIndex] = {
        ...existingEntry,
        ...entry,
        contractionsPer10Mins: entry.contractionsPer10Mins || existingEntry.contractionsPer10Mins,
        durationOfContractions: entry.durationOfContractions || existingEntry.durationOfContractions,
        cervicalDilation: entry.cervicalDilation ?? existingEntry.cervicalDilation,
        descentOfHead: entry.descentOfHead ?? existingEntry.descentOfHead,
        urgeToPush: entry.urgeToPush || existingEntry.urgeToPush,
        isEmergency: entry.isEmergency ?? existingEntry.isEmergency,
        emergencyReason: entry.emergencyReason || existingEntry.emergencyReason,
      };
    }

    return combinedEntries.sort(
      (left, right) =>
        new Date(left.encounterDatetime ?? 0).getTime() - new Date(right.encounterDatetime ?? 0).getTime(),
    );
  }, [entries, mergedEncounters]);

  const graphLabourProgressEntries = React.useMemo(
    () => allLabourProgressEntries.filter((entry) => !entry.isEmergency),
    [allLabourProgressEntries],
  );
  const showEmergencyReasonColumn = React.useMemo(
    () => allLabourProgressEntries.some((entry) => entry.isEmergency),
    [allLabourProgressEntries],
  );

  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: number | undefined;

    const timeoutId = window.setTimeout(() => {
      setNow(new Date());
      intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const secondStageQuarterEntries = React.useMemo(() => {
    const quarterEntryMap = new Map<string, LabourProgressEntry>();

    if (!secondStageStartTime) {
      return quarterEntryMap;
    }

    for (const entry of graphLabourProgressEntries) {
      if (!entry.time) {
        continue;
      }

      const minutesFromSecondStageStart = getForwardMinutesDelta(secondStageStartTime, entry.time);
      if (
        minutesFromSecondStageStart === null ||
        minutesFromSecondStageStart < 0 ||
        minutesFromSecondStageStart > SECOND_STAGE_CONTRACTION_MAX_WINDOW_MINUTES ||
        minutesFromSecondStageStart % LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES !== 0
      ) {
        continue;
      }

      const quarterGlobalIndex = minutesFromSecondStageStart / LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES;
      const secondStageHourIndex = Math.floor(quarterGlobalIndex / 4);
      const quarterIndex = quarterGlobalIndex % 4;

      if (secondStageHourIndex < 0 || secondStageHourIndex >= secondStageHours.length) {
        continue;
      }

      quarterEntryMap.set(`${secondStageHourIndex}-${quarterIndex}`, entry);
    }

    return quarterEntryMap;
  }, [graphLabourProgressEntries, secondStageHours.length, secondStageStartTime]);

  const secondStageQuarterSlotStates = React.useMemo(() => {
    if (!secondStageStartTime) {
      return new Map<string, LcgSlotState>();
    }

    const states = new Map<string, LcgSlotState>();

    for (let secondStageHourIndex = 0; secondStageHourIndex < secondStageHours.length; secondStageHourIndex += 1) {
      for (let quarterIndex = 0; quarterIndex < 4; quarterIndex += 1) {
        const slotIndex = secondStageHourIndex * 4 + quarterIndex;
        const slotState = getPointSlotState(
          secondStageStartTime,
          slotIndex,
          now,
          SECOND_STAGE_CONTRACTION_QUARTER_OPTIONS,
        );
        states.set(`${secondStageHourIndex}-${quarterIndex}`, slotState);
      }
    }

    return states;
  }, [now, secondStageHours.length, secondStageStartTime]);

  const secondStageDescentEntries = React.useMemo(() => {
    const descentEntryMap = new Map<string, LabourProgressEntry>();

    if (!secondStageStartTime) {
      return descentEntryMap;
    }

    for (const entry of graphLabourProgressEntries) {
      if (!entry.time || entry.descentOfHead === undefined) {
        continue;
      }

      const minutesFromSecondStageStart = getForwardMinutesDelta(secondStageStartTime, entry.time);
      if (
        minutesFromSecondStageStart === null ||
        minutesFromSecondStageStart < 0 ||
        minutesFromSecondStageStart > SECOND_STAGE_DESCENT_MAX_WINDOW_MINUTES ||
        minutesFromSecondStageStart % LCG_SECOND_STAGE_DESCENT_INTERVAL_MINUTES !== 0
      ) {
        continue;
      }

      const halfGlobalIndex = minutesFromSecondStageStart / LCG_SECOND_STAGE_DESCENT_INTERVAL_MINUTES;
      const secondStageHourIndex = Math.floor(halfGlobalIndex / 2);
      const halfIndex = halfGlobalIndex % 2;

      if (secondStageHourIndex < 0 || secondStageHourIndex >= secondStageHours.length) {
        continue;
      }

      descentEntryMap.set(`${secondStageHourIndex}-${halfIndex}`, entry);
    }

    return descentEntryMap;
  }, [graphLabourProgressEntries, secondStageHours.length, secondStageStartTime]);

  const firstStageCervixLagState = React.useMemo(() => {
    if (!baseTime) {
      return null;
    }

    const secondStageStartMinutesFromBase = secondStageStartTime
      ? getForwardMinutesDelta(baseTime, secondStageStartTime)
      : null;

    const firstStageCervixEntries = graphLabourProgressEntries
      .filter((entry) => entry.time && entry.cervicalDilation !== undefined)
      .map((entry) => {
        const minutesFromBase = getForwardMinutesDelta(baseTime, entry.time as string);
        return {
          entry,
          minutesFromBase,
          dilation: Number(entry.cervicalDilation),
        };
      })
      .filter((entry) => {
        if (entry.minutesFromBase === null || !Number.isFinite(entry.dilation)) {
          return false;
        }

        if (secondStageStartMinutesFromBase === null) {
          return true;
        }

        return entry.minutesFromBase < secondStageStartMinutesFromBase;
      })
      .sort((left, right) => {
        if ((left.minutesFromBase ?? 0) !== (right.minutesFromBase ?? 0)) {
          return (left.minutesFromBase ?? 0) - (right.minutesFromBase ?? 0);
        }

        return (
          new Date(left.entry.encounterDatetime ?? 0).getTime() - new Date(right.entry.encounterDatetime ?? 0).getTime()
        );
      });

    if (firstStageCervixEntries.length === 0) {
      return null;
    }

    const latestEntry = firstStageCervixEntries[firstStageCervixEntries.length - 1];
    const currentDilation = latestEntry.dilation;
    const thresholdMinutes = CERVIX_FIRST_STAGE_LAG_MINUTES_BY_DILATION[currentDilation];

    if (!thresholdMinutes) {
      return null;
    }

    let currentDilationStartMinutes = latestEntry.minutesFromBase as number;

    for (let index = firstStageCervixEntries.length - 1; index >= 0; index -= 1) {
      const row = firstStageCervixEntries[index];
      if (row.dilation === currentDilation) {
        currentDilationStartMinutes = row.minutesFromBase as number;
        continue;
      }

      break;
    }

    const nowMinutesFromBaseRaw = getForwardMinutesDelta(baseTime, nowHHMM);
    if (nowMinutesFromBaseRaw === null) {
      return null;
    }

    // First-stage lag alert should stop once second stage starts.
    const firstStageElapsedLimit =
      secondStageStartMinutesFromBase !== null
        ? Math.min(nowMinutesFromBaseRaw, secondStageStartMinutesFromBase)
        : nowMinutesFromBaseRaw;

    const elapsedMinutes = Math.max(0, firstStageElapsedLimit - currentDilationStartMinutes);

    return {
      currentDilation,
      elapsedMinutes,
      thresholdMinutes,
      isExceeded: elapsedMinutes >= thresholdMinutes,
    };
  }, [graphLabourProgressEntries, baseTime, nowHHMM, secondStageStartTime]);

  const secondStageLagState = React.useMemo(() => {
    if (!secondStageStartTime) {
      return null;
    }

    const elapsedMinutes = getForwardMinutesDelta(secondStageStartTime, nowHHMM);
    if (elapsedMinutes === null) {
      return null;
    }

    const thresholdHours =
      parityValue > 0 ? LCG_SECOND_STAGE_ALERT_HOURS_MULTIPAROUS : LCG_SECOND_STAGE_ALERT_HOURS_NULLIPAROUS;
    const thresholdMinutes = scaleLcgGuidelineMinutes(thresholdHours * 60);

    return {
      elapsedMinutes,
      thresholdMinutes,
      thresholdHours,
      isExceeded: elapsedMinutes >= thresholdMinutes,
    };
  }, [nowHHMM, parityValue, secondStageStartTime]);

  const toIntervalUnits = (minutes: number) => {
    return Number((minutes / Math.max(1, LCG_TIME_INCREMENT_MINUTES)).toFixed(1));
  };

  const slotTimeByIndex = React.useMemo(() => {
    if (!baseTime) {
      return new Map<number, string>();
    }

    const [h, m] = baseTime.split(':').map(Number);
    const baseMinutes = h * 60 + m;

    return new Map(
      Array.from({ length: totalSlots }, (_, index) => {
        const total = (baseMinutes + index * LCG_TIME_INCREMENT_MINUTES + 24 * 60) % (24 * 60);
        const hh = String(Math.floor(total / 60)).padStart(2, '0');
        const mm = String(total % 60).padStart(2, '0');
        return [index, `${hh}:${mm}`] as const;
      }),
    );
  }, [baseTime, totalSlots]);

  const vaginalExamFilledSlotIndices = React.useMemo(() => {
    const indices = new Set<number>();

    for (const slotIndex of firstStageLowerSlotEntries.keys()) {
      if (slotIndex >= 0 && slotIndex < activeFirstStageHours.length) {
        indices.add(slotIndex);
      }
    }

    return Array.from(indices).sort((a, b) => a - b);
  }, [activeFirstStageHours.length, firstStageLowerSlotEntries]);

  const vaginalExamFilledSlotSet = React.useMemo(
    () => new Set(vaginalExamFilledSlotIndices),
    [vaginalExamFilledSlotIndices],
  );

  const firstStageCurrentSlotIndex = React.useMemo(() => {
    if (!baseTime || activeFirstStageHours.length <= 0) {
      return null;
    }

    return getStageAwareSlotIndexForTime(baseTime, nowHHMM, activeFirstStageHours.length, 0);
  }, [activeFirstStageHours.length, baseTime, nowHHMM]);

  const firstStageLowerActiveSlotIndex = React.useMemo(() => {
    if (firstStageCurrentSlotIndex === null || activeFirstStageHours.length <= 0) {
      return null;
    }

    if (vaginalExamFilledSlotIndices.length === 0) {
      return Math.min(firstStageCurrentSlotIndex, activeFirstStageHours.length - 1);
    }

    const latestFilledSlotIndex = Math.max(...vaginalExamFilledSlotIndices);
    const nextDueSlotIndex = latestFilledSlotIndex + firstStageLowerIntervalSlots;
    const candidateSlotIndex =
      firstStageCurrentSlotIndex < nextDueSlotIndex ? nextDueSlotIndex : firstStageCurrentSlotIndex;

    if (candidateSlotIndex < 0 || candidateSlotIndex >= activeFirstStageHours.length) {
      return null;
    }

    return candidateSlotIndex;
  }, [
    activeFirstStageHours.length,
    firstStageCurrentSlotIndex,
    firstStageLowerIntervalSlots,
    vaginalExamFilledSlotIndices,
  ]);

  const lowerFirstStageCellStates = React.useMemo(() => {
    const states = new Map<number, LcgSlotState | null>();

    for (let slotIndex = 0; slotIndex < activeFirstStageHours.length; slotIndex += 1) {
      if (vaginalExamFilledSlotSet.has(slotIndex)) {
        states.set(slotIndex, 'locked');
        continue;
      }

      if (firstStageCurrentSlotIndex === null || firstStageLowerActiveSlotIndex === null) {
        states.set(slotIndex, null);
        continue;
      }

      if (slotIndex < firstStageLowerActiveSlotIndex) {
        states.set(slotIndex, 'locked');
        continue;
      }

      if (slotIndex === firstStageLowerActiveSlotIndex) {
        states.set(slotIndex, firstStageCurrentSlotIndex >= firstStageLowerActiveSlotIndex ? 'active' : null);
        continue;
      }

      states.set(slotIndex, null);
    }

    return states;
  }, [
    activeFirstStageHours.length,
    firstStageCurrentSlotIndex,
    firstStageLowerActiveSlotIndex,
    vaginalExamFilledSlotSet,
  ]);

  const vaginalExamScheduleState = React.useMemo(
    () =>
      buildWomanScheduleState({
        baseTime,
        slotCount: activeFirstStageHours.length,
        actualFilledSlotIndices: vaginalExamFilledSlotIndices,
        intervalMinutes: LCG_FIRST_STAGE_VAGINAL_EXAM_INTERVAL_MINUTES,
        now,
      }),
    [activeFirstStageHours.length, baseTime, now, vaginalExamFilledSlotIndices],
  );

  const tableRows = React.useMemo(() => {
    const rows = allLabourProgressEntries
      .filter((entry) => Boolean(entry.time))
      .map((entry, index) => {
        const dt = entry.encounterDatetime ? new Date(entry.encounterDatetime) : null;
        const valid = dt && !Number.isNaN(dt.getTime());
        const emergencyReason = entry.emergencyReason?.trim();
        return {
          id: `lp-row-${index}-${entry.time}`,
          date: valid ? dt.toLocaleDateString('en-GB') : '',
          time: valid ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
          lcgTime: entry.time || '',
          contractions: entry.contractionsPer10Mins || '',
          duration: entry.durationOfContractions || '',
          cervix: entry.cervicalDilation !== undefined ? String(entry.cervicalDilation) : '',
          descent: entry.descentOfHead !== undefined ? String(entry.descentOfHead) : '',
          urge: entry.urgeToPush === 'yes' ? 'P' : entry.urgeToPush === 'no' ? 'N/P' : '',
          reason: entry.isEmergency
            ? emergencyReason
              ? t('emergencyReasonLabel', 'Emergency: {{reason}}', { reason: emergencyReason })
              : t('emergencyEntry', 'Emergency entry')
            : '',
          isEmergency: Boolean(entry.isEmergency),
        };
      });

    return rows.sort((left, right) => left.lcgTime.localeCompare(right.lcgTime));
  }, [allLabourProgressEntries, t]);

  const emergencyRowIds = React.useMemo(
    () => new Set(tableRows.filter((row) => row.isEmergency).map((row) => row.id)),
    [tableRows],
  );

  const tableHeaders = React.useMemo(
    () => [
      { key: 'date', header: t('date', 'Date') },
      { key: 'time', header: t('timeSaved', 'Time') },
      { key: 'lcgTime', header: t('lcgTime', 'LCG Time') },
      { key: 'contractions', header: t('contractionsPer10Mins', 'Contractions/10 min') },
      { key: 'duration', header: t('durationOfContractions', 'Duration') },
      { key: 'cervix', header: t('cervicalDilation', 'Cervix') },
      { key: 'descent', header: t('descentOfHead', 'Descent') },
      { key: 'urge', header: t('urgeToPush', 'Urge') },
      ...(showEmergencyReasonColumn ? [{ key: 'reason', header: t('reason', 'Reason') }] : []),
    ],
    [showEmergencyReasonColumn, t],
  );

  const contractionEntries = React.useMemo(
    () =>
      graphLabourProgressEntries.filter(
        (entry) => Boolean(entry.contractionsPer10Mins || entry.durationOfContractions) && Boolean(entry.time),
      ),
    [graphLabourProgressEntries],
  );

  const contractionSlotEntries = React.useMemo(() => {
    const mappedEntries = new Map<number, LabourContractionSlotEntries>();

    if (!baseTime) {
      contractionEntries.slice(0, totalSlots).forEach((entry, index) => {
        mappedEntries.set(index, { primary: entry });
      });
      return mappedEntries;
    }

    const orderedEntries = [...contractionEntries].sort(
      (left, right) =>
        new Date(left.encounterDatetime ?? 0).getTime() - new Date(right.encounterDatetime ?? 0).getTime(),
    );

    for (const entry of orderedEntries) {
      const primarySlotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        entry.time ?? '',
        activeFirstStageHours.length,
        secondStageHours.length,
        secondStageStartTime,
        BABY_PRIMARY_FHR_SLOT_OPTIONS,
      );
      const secondarySlotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        entry.time ?? '',
        activeFirstStageHours.length,
        secondStageHours.length,
        secondStageStartTime,
        BABY_HALF_GRID_SLOT_OPTIONS,
      );

      if (primarySlotIndex !== null) {
        mappedEntries.set(primarySlotIndex, {
          ...mappedEntries.get(primarySlotIndex),
          primary: entry,
        });
        continue;
      }

      if (secondarySlotIndex !== null) {
        mappedEntries.set(secondarySlotIndex, {
          ...mappedEntries.get(secondarySlotIndex),
          secondary: entry,
        });
      }
    }

    return mappedEntries;
  }, [
    activeFirstStageHours.length,
    baseTime,
    contractionEntries,
    secondStageHours.length,
    secondStageStartTime,
    totalSlots,
  ]);

  const contractionSlotStates = React.useMemo(() => {
    return Array.from({ length: totalSlots }, (_, slotIndex) => {
      if (!baseTime) {
        return { primary: null, secondary: null };
      }

      if (secondStageStartTime && slotIndex >= activeFirstStageHours.length) {
        const secondStageSlotIndex = slotIndex - activeFirstStageHours.length;
        return {
          primary: getPointSlotState(secondStageStartTime, secondStageSlotIndex, now, BABY_PRIMARY_FHR_SLOT_OPTIONS),
          secondary: getPointSlotState(secondStageStartTime, secondStageSlotIndex, now, BABY_HALF_GRID_SLOT_OPTIONS),
        };
      }

      return {
        primary: getPointSlotState(baseTime, slotIndex, now, BABY_PRIMARY_FHR_SLOT_OPTIONS),
        secondary: getPointSlotState(baseTime, slotIndex, now, BABY_HALF_GRID_SLOT_OPTIONS),
      };
    });
  }, [activeFirstStageHours.length, baseTime, now, secondStageStartTime, totalSlots]);

  const getSegmentClassName = (slotState: LcgSlotState | null) => {
    if (slotState === 'locked') {
      return `${styles.splitSegment} ${styles.lockedEntryCell}`;
    }

    if (slotState === 'active') {
      return `${styles.splitSegment} ${styles.activeEntryCell}`;
    }

    return styles.splitSegment;
  };

  const renderContractionValue = (metric: LabourContractionMetric, rawValue: string) => {
    if (!rawValue) {
      return '';
    }

    const { isAlert, guidance } = getLabourContractionAlertInfo(t, metric, rawValue);
    return isAlert ? (
      <span className={styles.alertCircle} title={guidance}>
        {rawValue}
      </span>
    ) : (
      rawValue
    );
  };

  const renderContractionCell = (
    slotIndex: number,
    valueSelector: (entry: LabourProgressEntry | undefined) => string | undefined,
    metric: LabourContractionMetric,
  ) => {
    const entryGroup = contractionSlotEntries.get(slotIndex);
    const isPostStop = stopSlotIndex !== undefined && slotIndex > stopSlotIndex;
    const isPreStop = stopSlotIndex !== undefined && slotIndex < stopSlotIndex;
    const slotState = contractionSlotStates[slotIndex];
    const isLockedByStageTransition =
      firstStageCutoffSlotIndex !== undefined &&
      slotIndex < activeFirstStageHours.length &&
      slotIndex > firstStageCutoffSlotIndex;
    const primaryValue = valueSelector(entryGroup?.primary) ?? '';
    const secondaryValue = valueSelector(entryGroup?.secondary) ?? '';

    const rawPrimary: LcgSlotState | null = isLockedByStageTransition ? 'locked' : (slotState?.primary ?? null);
    const rawSecondary: LcgSlotState | null = isLockedByStageTransition ? 'locked' : (slotState?.secondary ?? null);
    const computedPrimary = isPostStop ? null : isPreStop && rawPrimary === 'active' ? 'locked' : rawPrimary;
    const computedSecondary = isPostStop ? null : isPreStop && rawSecondary === 'active' ? 'locked' : rawSecondary;

    return (
      <td className={styles.entryCell}>
        <div className={styles.splitCellTwo}>
          <span className={getSegmentClassName(computedPrimary)}>{renderContractionValue(metric, primaryValue)}</span>
          <span className={getSegmentClassName(computedSecondary)}>
            {renderContractionValue(metric, secondaryValue)}
          </span>
        </div>
      </td>
    );
  };

  const renderSecondStageQuarteredContractionCell = (
    secondStageIndex: number,
    valueSelector: (entry: LabourProgressEntry | undefined) => string | undefined,
    metric: LabourContractionMetric,
  ) => {
    const absoluteSlotIndex = activeFirstStageHours.length + secondStageIndex;
    const isPostStop = stopSlotIndex !== undefined && absoluteSlotIndex > stopSlotIndex;
    const isStoppedCellOrEarlier = stopSlotIndex !== undefined && absoluteSlotIndex <= stopSlotIndex;
    const quarterSegments = [0, 1, 2, 3].map((quarterIndex) => {
      const key = `${secondStageIndex}-${quarterIndex}`;
      const entry = secondStageQuarterEntries.get(key);
      const value = valueSelector(entry) ?? '';
      const rawSlotState = secondStageQuarterSlotStates.get(key) ?? null;
      const slotState = isPostStop
        ? null
        : isStoppedCellOrEarlier && rawSlotState === 'active'
          ? 'locked'
          : rawSlotState;
      const className = getSegmentClassName(slotState);
      return { className, value };
    });

    return (
      <td className={styles.entryCell}>
        <div className={styles.splitCellFour}>
          {quarterSegments.map((segment, quarterIndex) => (
            <span key={`second-stage-quarter-${secondStageIndex}-${quarterIndex}`} className={segment.className}>
              {renderContractionValue(metric, segment.value)}
            </span>
          ))}
        </div>
      </td>
    );
  };

  const renderSecondStageQuarteredCervixCell = (secondStageIndex: number, level: number) => {
    const absoluteSlotIndex = activeFirstStageHours.length + secondStageIndex;
    const isPostStop = stopSlotIndex !== undefined && absoluteSlotIndex > stopSlotIndex;
    const isStoppedCellOrEarlier = stopSlotIndex !== undefined && absoluteSlotIndex <= stopSlotIndex;
    const quarterSegments =
      level === 10
        ? [0, 1, 2, 3].map((quarterIndex) => {
            const key = `${secondStageIndex}-${quarterIndex}`;
            const urgeValue = secondStageQuarterEntries.get(key)?.urgeToPush;
            const rawSlotState = secondStageQuarterSlotStates.get(key) ?? null;
            const slotState = isPostStop
              ? null
              : isStoppedCellOrEarlier && rawSlotState === 'active'
                ? 'locked'
                : rawSlotState;
            const className = getSegmentClassName(slotState);

            if (urgeValue === 'yes') {
              return { className, marker: 'P' };
            }

            if (urgeValue === 'no') {
              return { className, marker: '-' };
            }

            const marker = '';
            return { className, marker };
          })
        : [0, 1, 2, 3].map((quarterIndex) => {
            const key = `${secondStageIndex}-${quarterIndex}`;
            const rawSlotState = secondStageQuarterSlotStates.get(key) ?? null;
            const slotState = isPostStop
              ? null
              : isStoppedCellOrEarlier && rawSlotState === 'active'
                ? 'locked'
                : rawSlotState;
            return { className: getSegmentClassName(slotState), marker: '' };
          });

    return (
      <td className={styles.entryCell}>
        <div className={styles.splitCellFour}>
          {quarterSegments.map((segment, quarterIndex) => (
            <span key={`second-stage-cervix-${secondStageIndex}-${quarterIndex}`} className={segment.className}>
              {segment.marker}
            </span>
          ))}
        </div>
      </td>
    );
  };

  const renderSecondStageSplitDescentCell = (secondStageIndex: number, level: number) => {
    const firstHalfEntry = secondStageDescentEntries.get(`${secondStageIndex}-0`);
    const secondHalfEntry = secondStageDescentEntries.get(`${secondStageIndex}-1`);
    const absoluteSlotIndex = activeFirstStageHours.length + secondStageIndex;
    const isPostStop = stopSlotIndex !== undefined && absoluteSlotIndex > stopSlotIndex;
    const isStoppedCellOrEarlier = stopSlotIndex !== undefined && absoluteSlotIndex <= stopSlotIndex;
    const rawSlotState = secondStageQuarterSlotStates.get(`${secondStageIndex}-0`) ?? null;
    const slotState = isPostStop ? null : isStoppedCellOrEarlier && rawSlotState === 'active' ? 'locked' : rawSlotState;
    const segmentClassName = getSegmentClassName(slotState);

    return (
      <td className={styles.entryCell}>
        <div className={styles.splitCellTwo}>
          <span className={segmentClassName}>{firstHalfEntry?.descentOfHead === level ? 'O' : ''}</span>
          <span className={segmentClassName}>{secondHalfEntry?.descentOfHead === level ? 'O' : ''}</span>
        </div>
      </td>
    );
  };

  const getStageAwareCellClassName = (slotIndex: number) => {
    if (stopSlotIndex !== undefined && slotIndex > stopSlotIndex) {
      return styles.entryCell;
    }

    if (firstStageCutoffSlotIndex !== undefined && slotIndex < activeFirstStageHours.length) {
      if (slotIndex > firstStageCutoffSlotIndex) {
        return `${styles.entryCell} ${styles.lockedEntryCell}`;
      }

      return styles.entryCell;
    }

    if (
      firstStageCutoffSlotIndex !== undefined &&
      slotIndex < activeFirstStageHours.length &&
      slotIndex > firstStageCutoffSlotIndex
    ) {
      return `${styles.entryCell} ${styles.lockedEntryCell}`;
    }

    return styles.entryCell;
  };

  return (
    <div className={`${styles.sectionBlock} ${styles.continuousSheetSection}`}>
      <div className={styles.sectionHeaderControls}>
        <SectionToolbar
          showViewToggle={showViewToggle}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAddClick={labourProgressAddHandler ?? undefined}
        />
      </div>

      {viewMode === 'graph' ? (
        <table className={styles.gridTable}>
          <tbody>
            {labourContractionRows.map((row, rowIndex) => (
              <tr key={row.parameter}>
                {rowIndex === 0 ? (
                  <td
                    className={styles.verticalLabel}
                    rowSpan={labourContractionRows.length + cervixRows.length + descentRows.length}>
                    {t('labourProgress', 'LABOUR PROGRESS')}
                  </td>
                ) : null}

                <td className={`${styles.parameterCell} ${styles.multiLineParameterCell}`} colSpan={2}>
                  {row.labelLines.map((line) => (
                    <div key={`${row.parameter}-${line}`}>{t(line, line)}</div>
                  ))}
                </td>
                <td className={styles.alertValueCell}>{row.alert}</td>

                {activeFirstStageHours.map((hour, idx) => {
                  return (
                    <React.Fragment key={`${row.parameter}-labour-active-${hour}`}>
                      {renderContractionCell(
                        idx,
                        (entry) =>
                          row.parameter === 'Contractions per 10 min'
                            ? entry?.contractionsPer10Mins
                            : entry?.durationOfContractions,
                        row.parameter === 'Contractions per 10 min'
                          ? 'contractionsPer10Mins'
                          : 'durationOfContractions',
                      )}
                    </React.Fragment>
                  );
                })}

                <td className={styles.gapCell} />

                {secondStageHours.map((hour, idx) => {
                  return (
                    <React.Fragment key={`${row.parameter}-labour-second-${hour}`}>
                      {renderSecondStageQuarteredContractionCell(
                        idx,
                        (entry) =>
                          row.parameter === 'Contractions per 10 min'
                            ? entry?.contractionsPer10Mins
                            : entry?.durationOfContractions,
                        row.parameter === 'Contractions per 10 min'
                          ? 'contractionsPer10Mins'
                          : 'durationOfContractions',
                      )}
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
            {cervixRows.map((row, rowIndex) => {
              const isCervixAlertRow =
                Boolean(firstStageCervixLagState?.isExceeded) &&
                firstStageCervixLagState?.currentDilation === row.level;

              return (
                <tr key={`cervix-${row.level}`}>
                  {rowIndex === 0 ? (
                    <td className={styles.parameterCell} rowSpan={cervixRows.length}>
                      {t('cervixPlotX', 'Cervix [Plot X]')}
                    </td>
                  ) : null}

                  <td className={`${styles.levelCell}${isCervixAlertRow ? ` ${styles.alertExceededLevelCell}` : ''}`}>
                    {row.level}
                  </td>
                  <td
                    className={`${styles.alertValueCell}${
                      isCervixAlertRow ? ` ${styles.alertExceededValueCell}` : ''
                    }`}>
                    {row.alert}
                  </td>

                  {activeFirstStageHours.map((hour, idx) => {
                    const entry = firstStageLowerSlotEntries.get(idx);
                    const rawCellState = lowerFirstStageCellStates.get(idx) ?? null;
                    const isPostStop = stopSlotIndex !== undefined && idx > stopSlotIndex;
                    const isStoppedCellOrEarlier = stopSlotIndex !== undefined && idx <= stopSlotIndex;
                    const cellState = isPostStop
                      ? null
                      : isStoppedCellOrEarlier && rawCellState === 'active'
                        ? 'locked'
                        : rawCellState;
                    return (
                      <td
                        key={`cervix-active-${row.level}-${hour}`}
                        className={`${getStageAwareCellClassName(idx)}${
                          cellState === 'locked'
                            ? ` ${styles.lockedEntryCell}`
                            : cellState === 'active'
                              ? ` ${styles.activeEntryCell}`
                              : ''
                        }`}>
                        {entry?.cervicalDilation === row.level ? 'X' : ''}
                      </td>
                    );
                  })}

                  <td className={styles.gapCell} />

                  {rowIndex === 0
                    ? secondStageHours.map((hour, secondStageIndex) => (
                        <React.Fragment key={`cervix-second-${row.level}-${hour}`}>
                          {renderSecondStageQuarteredCervixCell(secondStageIndex, row.level)}
                        </React.Fragment>
                      ))
                    : rowIndex === 1
                      ? [
                          <td
                            key="cervix-guidance-cell"
                            className={styles.noteCell}
                            colSpan={3}
                            rowSpan={cervixRows.length - 1}>
                            <div>
                              {t(
                                'cervixGuidance',
                                "In active first stage, plot 'X' to record cervical dilatation. Alert triggered when lag time for current cervical dilatation is exceeded with no progress. In second stage, insert 'P' to indicate when pushing begins.",
                              )}
                            </div>
                            {firstStageCervixLagState?.isExceeded ? (
                              <div className={styles.alertText}>
                                {t(
                                  'cervixLagExceededWarning',
                                  `⚠ Cervix alert: ${firstStageCervixLagState.currentDilation}cm — lag threshold exceeded (${firstStageCervixLagState.thresholdMinutes}min).`,
                                )}
                              </div>
                            ) : null}
                            {secondStageLagState?.isExceeded ? (
                              <div className={styles.alertText}>
                                {t(
                                  'secondStageLagExceededWarning',
                                  `⚠ Second-stage alert: ${secondStageLagState.thresholdHours}h threshold exceeded.`,
                                )}
                              </div>
                            ) : null}
                          </td>,
                        ]
                      : null}
                </tr>
              );
            })}

            {descentRows.map((level, rowIndex) => (
              <tr key={`descent-${level}`}>
                {rowIndex === 0 ? (
                  <td className={styles.parameterCell} rowSpan={descentRows.length}>
                    {t('descentPlotO', 'Descent [Plot O]')}
                  </td>
                ) : null}

                <td className={styles.levelCell}>{level}</td>
                <td className={styles.alertValueCell} />

                {activeFirstStageHours.map((hour, idx) => {
                  const entry = firstStageLowerSlotEntries.get(idx);
                  const rawCellState = lowerFirstStageCellStates.get(idx) ?? null;
                  const isPostStop = stopSlotIndex !== undefined && idx > stopSlotIndex;
                  const isStoppedCellOrEarlier = stopSlotIndex !== undefined && idx <= stopSlotIndex;
                  const cellState = isPostStop
                    ? null
                    : isStoppedCellOrEarlier && rawCellState === 'active'
                      ? 'locked'
                      : rawCellState;
                  return (
                    <td
                      key={`descent-active-${level}-${hour}`}
                      className={`${getStageAwareCellClassName(idx)}${
                        cellState === 'locked'
                          ? ` ${styles.lockedEntryCell}`
                          : cellState === 'active'
                            ? ` ${styles.activeEntryCell}`
                            : ''
                      }`}>
                      {entry?.descentOfHead === level ? 'O' : ''}
                    </td>
                  );
                })}

                <td className={styles.gapCell} />

                {secondStageHours.map((hour, idx) => {
                  return (
                    <React.Fragment key={`descent-second-${level}-${hour}`}>
                      {renderSecondStageSplitDescentCell(idx, level)}
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={styles.tableContainer}>
          <DataTable rows={tableRows.slice(firstRowIndex, firstRowIndex + currentPageSize)} headers={tableHeaders}>
            {({ rows, headers, getHeaderProps, getTableProps }) => (
              <TableContainer>
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader key={header.key} {...getHeaderProps({ header })}>
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} className={emergencyRowIds.has(row.id) ? styles.emergencyRow : undefined}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
          <Pagination
            backwardText="Previous page"
            forwardText="Next page"
            itemsPerPageText="Items per page:"
            page={Math.floor(firstRowIndex / currentPageSize) + 1}
            pageSize={currentPageSize}
            pageSizes={[5, 10, 20, 30, 40, 50]}
            totalItems={tableRows.length}
            onChange={({ page, pageSize }) => {
              if (pageSize !== currentPageSize) {
                setCurrentPageSize(pageSize);
              }
              setFirstRowIndex(pageSize * (page - 1));
            }}
          />
        </div>
      )}
    </div>
  );
};

export default LabourProgress;
