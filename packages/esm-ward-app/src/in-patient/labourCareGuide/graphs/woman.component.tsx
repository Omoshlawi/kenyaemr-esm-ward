import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../labour-care-guide.scss';
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
import { usePartographyData } from '../partography.resource';
import {
  LCG_TIME_INCREMENT_MINUTES,
  WOMAN_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  LCG_WOMAN_INTERVAL_MINUTES,
  LCG_EMERGENCY_OVERRIDE_CONCEPT_UUID,
  LCG_EMERGENCY_REASON_CONCEPT_UUID,
  PARTOGRAPHY_CONCEPTS,
} from '../types';
import {
  addStepsToHHMM,
  getNextAllowedTime,
  getStageAwareSlotIndexForTime,
  parseHHMMToMinutes,
  type LcgSlotState,
} from '../time-slot-utils';
import { buildWomanScheduleState } from '../woman-schedule-utils';
import { getWomanAlertGuidance, isWomanAlertValue, type WomanAlertKey } from '../alert-rules';
import { SectionToolbar } from '../components/section-toolbar.component';

interface WomanProps {
  patientUuid: string;
  activeFirstStageHours: number[];
  secondStageHours: number[];
  onAddClick?: () => void;
  showViewToggle?: boolean;
  baseTime?: string;
  firstStageCutoffSlotIndex?: number;
  secondStageStartTime?: string;
  latestObservationTime?: string;
  intervalMinutes?: number;
  localEntries?: WomanLocalEntry[];
  stopSlotIndex?: number;
}

export type WomanLocalEntry = {
  time: string; // LCG form time HH:MM
  recordedAt: string; // ISO datetime of submission
  pulse?: string;
  systolicBp?: string;
  diastolicBp?: string;
  temperature?: string;
  protein?: string;
  acetone?: string;
  isEmergency?: boolean;
  emergencyReason?: string;
};

type WomanEntry = {
  pulse?: string;
  systolicBp?: string;
  diastolicBp?: string;
  temperature?: string;
  urine?: string;
};

const womanRows = [
  { parameter: 'Pulse', alert: '<60, ≥120' },
  { parameter: 'Systolic BP', alert: '<80, ≥140' },
  { parameter: 'Diastolic BP', alert: '≥90' },
  { parameter: 'Temperature °C', alert: '<35.0, ≥37.5' },
  { parameter: 'Urine', alert: '<P++, < A++' },
];

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

const MINUTES_IN_DAY = 24 * 60;

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
  if (relativeMinutes < -WOMAN_TIME_SLOT_EARLY_ALLOWANCE_MINUTES) {
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

const getEncounterRecordedTime = (encounter: any) => {
  const explicitTimeObs = encounter?.obs?.find(
    (obs: any) =>
      (obs.concept?.uuid === '160632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' ||
        obs.concept?.uuid === PARTOGRAPHY_CONCEPTS['pulse-time-slot'] ||
        obs.concept?.uuid === PARTOGRAPHY_CONCEPTS['time-slot']) &&
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

const formatProteinToken = (raw?: string) => {
  const value = (raw ?? '').trim().toUpperCase();
  if (!value) {
    return '';
  }
  if (value.includes('2001195') || value === 'ND') {
    return 'ND';
  }
  if (value.includes('1364') || value.includes('THREE PLUS') || value.includes('+++')) {
    return 'P+++';
  }
  if (value.includes('1363') || value.includes('TWO PLUS') || value.includes('++')) {
    return 'P++';
  }
  if (value.includes('1362') || value.includes('ONE PLUS') || value.includes('+')) {
    return 'P+';
  }
  if (value.includes('1874') || value.includes('TRACE') || value === 'P' || value === 'P-') {
    return 'P';
  }
  return raw ?? '';
};

const formatAcetoneToken = (raw?: string) => {
  const value = (raw ?? '').trim().toUpperCase();
  if (!value) {
    return '';
  }
  if (value.includes('2001195') || value === 'ND') {
    return 'ND';
  }
  if (value.includes('1364') || value.includes('THREE PLUS') || value.includes('+++')) {
    return 'A+++';
  }
  if (value.includes('1363') || value.includes('TWO PLUS') || value.includes('++')) {
    return 'A++';
  }
  if (value.includes('1362') || value.includes('ONE PLUS') || value.includes('+')) {
    return 'A+';
  }
  if (value.includes('1874') || value.includes('TRACE') || value === 'A') {
    return 'A';
  }
  return raw ?? '';
};

const Woman: React.FC<WomanProps> = ({
  patientUuid,
  activeFirstStageHours,
  secondStageHours,
  onAddClick,
  showViewToggle = true,
  baseTime,
  firstStageCutoffSlotIndex,
  secondStageStartTime,
  latestObservationTime,
  intervalMinutes = LCG_WOMAN_INTERVAL_MINUTES,
  localEntries = [],
  stopSlotIndex,
}) => {
  const { t } = useTranslation();
  const [now, setNow] = React.useState(() => new Date());
  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');
  const [firstRowIndex, setFirstRowIndex] = useState(0);
  const [currentPageSize, setCurrentPageSize] = useState(10);
  const totalSlots = activeFirstStageHours.length + secondStageHours.length;

  const { data: pulseEncounters = [] } = usePartographyData(patientUuid || '', 'maternal-pulse');
  const { data: bloodPressureEncounters = [] } = usePartographyData(patientUuid || '', 'blood-pressure');
  const { data: temperatureEncounters = [] } = usePartographyData(patientUuid || '', 'temperature');
  const { data: urineEncounters = [] } = usePartographyData(patientUuid || '', 'urine-analysis');
  const pulseGraphEncounters = React.useMemo(
    () => pulseEncounters.filter((enc) => !isEmergencyEncounter(enc)),
    [pulseEncounters],
  );
  const bloodPressureGraphEncounters = React.useMemo(
    () => bloodPressureEncounters.filter((enc) => !isEmergencyEncounter(enc)),
    [bloodPressureEncounters],
  );
  const temperatureGraphEncounters = React.useMemo(
    () => temperatureEncounters.filter((enc) => !isEmergencyEncounter(enc)),
    [temperatureEncounters],
  );
  const urineGraphEncounters = React.useMemo(
    () => urineEncounters.filter((enc) => !isEmergencyEncounter(enc)),
    [urineEncounters],
  );
  const showEmergencyReasonColumn = React.useMemo(
    () =>
      [...pulseEncounters, ...bloodPressureEncounters, ...temperatureEncounters, ...urineEncounters].some((enc) =>
        isEmergencyEncounter(enc),
      ) || localEntries.some((entry) => Boolean(entry.isEmergency)),
    [bloodPressureEncounters, localEntries, pulseEncounters, temperatureEncounters, urineEncounters],
  );

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

  const slotEntries = React.useMemo(() => {
    const mappedEntries = new Map<number, WomanEntry>();

    if (!baseTime) {
      return mappedEntries;
    }

    const upsertEntry = (encounter: any, partialEntry: Partial<WomanEntry>) => {
      const slotTime = getEncounterRecordedTime(encounter);
      const slotIndex =
        getStageAwareSlotIndexForTime(
          baseTime,
          slotTime,
          activeFirstStageHours.length,
          secondStageHours.length,
          secondStageStartTime,
          firstStageCutoffSlotIndex,
        ) ?? getFallbackSlotIndex(baseTime, slotTime, totalSlots);
      if (slotIndex === null) {
        return;
      }

      mappedEntries.set(slotIndex, {
        ...(mappedEntries.get(slotIndex) ?? {}),
        ...partialEntry,
      });
    };

    [...pulseGraphEncounters]
      .sort((a: any, b: any) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime())
      .forEach((encounter: any) => {
        const pulse = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['maternal-pulse']);
        if (pulse) {
          upsertEntry(encounter, { pulse });
        }
      });

    [...bloodPressureGraphEncounters]
      .sort((a: any, b: any) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime())
      .forEach((encounter: any) => {
        const systolicBp = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['systolic-bp']);
        const diastolicBp = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['diastolic-bp']);

        if (systolicBp || diastolicBp) {
          upsertEntry(encounter, { systolicBp, diastolicBp });
        }
      });

    [...temperatureGraphEncounters]
      .sort((a: any, b: any) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime())
      .forEach((encounter: any) => {
        const temperature = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS.temperature);
        if (temperature) {
          upsertEntry(encounter, { temperature });
        }
      });

    [...urineGraphEncounters]
      .sort((a: any, b: any) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime())
      .forEach((encounter: any) => {
        const protein = formatProteinToken(getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['protein-level']));
        const acetone = formatAcetoneToken(getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['ketone-level']));
        if (protein || acetone) {
          const urine = protein && acetone ? `${protein}/${acetone}` : protein || acetone || '';
          upsertEntry(encounter, {
            urine,
          });
        }
      });

    return mappedEntries;
  }, [
    activeFirstStageHours.length,
    baseTime,
    bloodPressureGraphEncounters,
    pulseGraphEncounters,
    secondStageHours.length,
    secondStageStartTime,
    firstStageCutoffSlotIndex,
    temperatureGraphEncounters,
    totalSlots,
    urineGraphEncounters,
  ]);

  // Merge optimistic local entries (not yet in API) into the slot map
  const mergedSlotEntries = React.useMemo(() => {
    if (!localEntries.length || !baseTime) return slotEntries;
    const merged = new Map(slotEntries);
    for (const entry of localEntries) {
      if (entry.isEmergency) {
        continue;
      }

      const slotIndex =
        getStageAwareSlotIndexForTime(
          baseTime,
          entry.time,
          activeFirstStageHours.length,
          secondStageHours.length,
          secondStageStartTime,
          firstStageCutoffSlotIndex,
        ) ?? getFallbackSlotIndex(baseTime, entry.time, totalSlots);
      if (slotIndex === null) continue;
      const protein = entry.protein ? formatProteinToken(entry.protein) : '';
      const acetone = entry.acetone ? formatAcetoneToken(entry.acetone) : '';
      merged.set(slotIndex, {
        ...(merged.get(slotIndex) ?? {}),
        ...(entry.pulse ? { pulse: entry.pulse } : {}),
        ...(entry.systolicBp ? { systolicBp: entry.systolicBp } : {}),
        ...(entry.diastolicBp ? { diastolicBp: entry.diastolicBp } : {}),
        ...(entry.temperature ? { temperature: entry.temperature } : {}),
        ...(protein || acetone
          ? { urine: protein && acetone ? `${protein}/${acetone}` : protein || acetone || '' }
          : {}),
      });
    }
    return merged;
  }, [
    activeFirstStageHours.length,
    baseTime,
    localEntries,
    secondStageHours.length,
    secondStageStartTime,
    firstStageCutoffSlotIndex,
    slotEntries,
    totalSlots,
  ]);

  const actualFilledSlotIndices = React.useMemo(
    () =>
      Array.from(mergedSlotEntries.entries())
        .filter(([, entry]) =>
          Boolean(entry.pulse || entry.systolicBp || entry.diastolicBp || entry.temperature || entry.urine),
        )
        .map(([slotIndex]) => slotIndex),
    [mergedSlotEntries],
  );

  const secondStageSegmentEntries = React.useMemo(() => {
    const segmentEntries = new Map<number, { first?: WomanEntry; second?: WomanEntry }>();

    if (!baseTime || !secondStageStartTime) {
      return segmentEntries;
    }

    const secondStageBaseMinutes = parseHHMMToMinutes(secondStageStartTime);
    if (secondStageBaseMinutes === null) {
      return segmentEntries;
    }

    const setSegmentEntry = (time: string, partialEntry: Partial<WomanEntry>) => {
      const absoluteSlotIndex = getStageAwareSlotIndexForTime(
        baseTime,
        time,
        activeFirstStageHours.length,
        secondStageHours.length,
        secondStageStartTime,
        firstStageCutoffSlotIndex,
      );

      if (absoluteSlotIndex === null || absoluteSlotIndex < activeFirstStageHours.length) {
        return;
      }

      const secondStageSlotIndex = absoluteSlotIndex - activeFirstStageHours.length;
      const targetMinutes = parseHHMMToMinutes(time);
      if (targetMinutes === null) {
        return;
      }

      let relativeMinutes = targetMinutes - secondStageBaseMinutes;
      if (relativeMinutes < -WOMAN_TIME_SLOT_EARLY_ALLOWANCE_MINUTES) {
        relativeMinutes += MINUTES_IN_DAY;
      }

      const slotStartMinutes = secondStageSlotIndex * LCG_TIME_INCREMENT_MINUTES;
      const minuteWithinSlot = relativeMinutes - slotStartMinutes;
      const segmentKey: 'first' | 'second' = minuteWithinSlot >= LCG_TIME_INCREMENT_MINUTES / 2 ? 'second' : 'first';

      const previous = segmentEntries.get(secondStageSlotIndex) ?? {};
      const previousSegment = previous[segmentKey] ?? {};

      segmentEntries.set(secondStageSlotIndex, {
        ...previous,
        [segmentKey]: {
          ...previousSegment,
          ...partialEntry,
        },
      });
    };

    [...pulseGraphEncounters]
      .sort((a: any, b: any) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime())
      .forEach((encounter: any) => {
        const pulse = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['maternal-pulse']);
        const slotTime = getEncounterRecordedTime(encounter);
        if (pulse && slotTime) {
          setSegmentEntry(slotTime, { pulse });
        }
      });

    [...bloodPressureGraphEncounters]
      .sort((a: any, b: any) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime())
      .forEach((encounter: any) => {
        const systolicBp = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['systolic-bp']);
        const diastolicBp = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['diastolic-bp']);
        const slotTime = getEncounterRecordedTime(encounter);
        if ((systolicBp || diastolicBp) && slotTime) {
          setSegmentEntry(slotTime, { systolicBp, diastolicBp });
        }
      });

    [...temperatureGraphEncounters]
      .sort((a: any, b: any) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime())
      .forEach((encounter: any) => {
        const temperature = getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS.temperature);
        const slotTime = getEncounterRecordedTime(encounter);
        if (temperature && slotTime) {
          setSegmentEntry(slotTime, { temperature });
        }
      });

    [...urineGraphEncounters]
      .sort((a: any, b: any) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime())
      .forEach((encounter: any) => {
        const protein = formatProteinToken(getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['protein-level']));
        const acetone = formatAcetoneToken(getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['ketone-level']));
        const slotTime = getEncounterRecordedTime(encounter);
        if ((protein || acetone) && slotTime) {
          setSegmentEntry(slotTime, {
            urine: protein && acetone ? `${protein}/${acetone}` : protein || acetone || '',
          });
        }
      });

    for (const entry of localEntries) {
      if (entry.isEmergency) {
        continue;
      }

      const protein = entry.protein ? formatProteinToken(entry.protein) : '';
      const acetone = entry.acetone ? formatAcetoneToken(entry.acetone) : '';

      setSegmentEntry(entry.time, {
        ...(entry.pulse ? { pulse: entry.pulse } : {}),
        ...(entry.systolicBp ? { systolicBp: entry.systolicBp } : {}),
        ...(entry.diastolicBp ? { diastolicBp: entry.diastolicBp } : {}),
        ...(entry.temperature ? { temperature: entry.temperature } : {}),
        ...(protein || acetone
          ? { urine: protein && acetone ? `${protein}/${acetone}` : protein || acetone || '' }
          : {}),
      });
    }

    return segmentEntries;
  }, [
    activeFirstStageHours.length,
    baseTime,
    bloodPressureGraphEncounters,
    firstStageCutoffSlotIndex,
    localEntries,
    pulseGraphEncounters,
    secondStageHours.length,
    secondStageStartTime,
    temperatureGraphEncounters,
    urineGraphEncounters,
  ]);

  const getSlotTimeByIndex = React.useCallback(
    (slotIndex: number) => {
      if (!baseTime) {
        return null;
      }

      if (slotIndex < activeFirstStageHours.length) {
        return addStepsToHHMM(baseTime, slotIndex);
      }

      const secondStageIndex = slotIndex - activeFirstStageHours.length;
      const secondStageBase = secondStageStartTime || baseTime;
      return addStepsToHHMM(secondStageBase, secondStageIndex);
    },
    [activeFirstStageHours.length, baseTime, secondStageStartTime],
  );

  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Candidate-slot cell states for first stage (1-hour interval, no catch-up)
  const womanFirstStageFilledSlotIndices = React.useMemo(
    () =>
      Array.from(mergedSlotEntries.entries())
        .filter(
          ([slotIndex, entry]) =>
            slotIndex < activeFirstStageHours.length &&
            Boolean(entry.pulse || entry.systolicBp || entry.diastolicBp || entry.temperature || entry.urine),
        )
        .map(([slotIndex]) => slotIndex)
        .sort((a, b) => a - b),
    [activeFirstStageHours.length, mergedSlotEntries],
  );

  const womanFirstStageIntervalSlots = React.useMemo(
    () => Math.max(1, Math.round(LCG_WOMAN_INTERVAL_MINUTES / LCG_TIME_INCREMENT_MINUTES)),
    [],
  );

  const womanFirstStageCurrentSlotIndex = React.useMemo(() => {
    if (!baseTime || activeFirstStageHours.length <= 0) {
      return null;
    }
    return getStageAwareSlotIndexForTime(baseTime, nowHHMM, activeFirstStageHours.length, 0);
  }, [activeFirstStageHours.length, baseTime, nowHHMM]);

  const womanFirstStageCandidateSlotIndex = React.useMemo(() => {
    if (womanFirstStageCurrentSlotIndex === null || activeFirstStageHours.length <= 0) {
      return null;
    }
    if (womanFirstStageFilledSlotIndices.length === 0) {
      return Math.min(womanFirstStageCurrentSlotIndex, activeFirstStageHours.length - 1);
    }
    const latestFilled = Math.max(...womanFirstStageFilledSlotIndices);
    const nextDue = latestFilled + womanFirstStageIntervalSlots;
    const candidate = womanFirstStageCurrentSlotIndex < nextDue ? nextDue : womanFirstStageCurrentSlotIndex;
    if (candidate < 0 || candidate >= activeFirstStageHours.length) {
      return null;
    }
    return candidate;
  }, [
    activeFirstStageHours.length,
    womanFirstStageCurrentSlotIndex,
    womanFirstStageFilledSlotIndices,
    womanFirstStageIntervalSlots,
  ]);

  const womanFirstStageCellStates = React.useMemo(() => {
    const states = new Map<number, LcgSlotState | null>();
    const filledSet = new Set(womanFirstStageFilledSlotIndices);

    for (let slotIndex = 0; slotIndex < activeFirstStageHours.length; slotIndex += 1) {
      if (filledSet.has(slotIndex)) {
        states.set(slotIndex, 'locked');
        continue;
      }
      if (womanFirstStageCurrentSlotIndex === null || womanFirstStageCandidateSlotIndex === null) {
        states.set(slotIndex, null);
        continue;
      }
      if (slotIndex < womanFirstStageCandidateSlotIndex) {
        states.set(slotIndex, 'locked');
        continue;
      }
      if (slotIndex === womanFirstStageCandidateSlotIndex) {
        states.set(slotIndex, womanFirstStageCurrentSlotIndex >= womanFirstStageCandidateSlotIndex ? 'active' : null);
        continue;
      }
      states.set(slotIndex, null);
    }

    return states;
  }, [
    activeFirstStageHours.length,
    womanFirstStageCandidateSlotIndex,
    womanFirstStageCurrentSlotIndex,
    womanFirstStageFilledSlotIndices,
  ]);

  const womanScheduleState = React.useMemo(
    () =>
      buildWomanScheduleState({
        baseTime,
        slotCount: totalSlots,
        actualFilledSlotIndices,
        intervalMinutes,
        now,
        firstStageSlotCount: activeFirstStageHours.length,
        secondStageStartTime,
      }),
    [
      actualFilledSlotIndices,
      activeFirstStageHours.length,
      baseTime,
      intervalMinutes,
      now,
      secondStageStartTime,
      totalSlots,
    ],
  );

  const nextAllowedTime = React.useMemo(() => {
    if (womanScheduleState.nextDueSlotIndex !== null) {
      return getSlotTimeByIndex(womanScheduleState.nextDueSlotIndex);
    }

    return latestObservationTime ? getNextAllowedTime(latestObservationTime, intervalMinutes) : null;
  }, [getSlotTimeByIndex, intervalMinutes, latestObservationTime, womanScheduleState.nextDueSlotIndex]);

  // ---- Table view data ----
  const tableHeaders = [
    { key: 'date', header: t('date', 'Date') },
    { key: 'time', header: t('time', 'Time') },
    { key: 'lcgTime', header: t('lcgTime', 'LCG Time') },
    { key: 'pulse', header: t('pulse', 'Pulse') },
    { key: 'systolicBp', header: t('systolicBp', 'Systolic BP') },
    { key: 'diastolicBp', header: t('diastolicBp', 'Diastolic BP') },
    { key: 'temperature', header: t('temperature', 'Temperature') },
    { key: 'urine', header: t('urine', 'Urine') },
    ...(showEmergencyReasonColumn ? [{ key: 'reason', header: t('reason', 'Reason') }] : []),
  ];

  const tableRows = React.useMemo(() => {
    type RawRow = {
      id: string;
      date: string;
      time: string;
      lcgTime: string;
      pulse: string;
      systolicBp: string;
      diastolicBp: string;
      temperature: string;
      urine: string;
      reason: string;
      isEmergency?: boolean;
      isPlaceholder?: boolean;
    };

    const fmtDate = (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const fmtTime = (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const byLcgTime = new Map<string, RawRow>();

    const mergeNonEmpty = (existing: RawRow, partial: Partial<RawRow>): RawRow => ({
      ...existing,
      ...(partial.pulse ? { pulse: partial.pulse } : {}),
      ...(partial.systolicBp ? { systolicBp: partial.systolicBp } : {}),
      ...(partial.diastolicBp ? { diastolicBp: partial.diastolicBp } : {}),
      ...(partial.temperature ? { temperature: partial.temperature } : {}),
      ...(partial.urine ? { urine: partial.urine } : {}),
      ...(partial.reason ? { reason: partial.reason } : {}),
      ...(partial.isEmergency !== undefined ? { isEmergency: partial.isEmergency } : {}),
      ...(partial.date ? { date: partial.date } : {}),
      ...(partial.time ? { time: partial.time } : {}),
    });

    const mergeEnc = (encounter: any, partial: Partial<RawRow>) => {
      const lcgTime = getEncounterRecordedTime(encounter);
      if (!lcgTime) return;
      const isEmergency = isEmergencyEncounter(encounter);
      const emergencyReasonText = getEmergencyReason(encounter).trim();
      const emergencyReason = isEmergency
        ? emergencyReasonText
          ? t('emergencyReasonLabel', 'Emergency: {{reason}}', { reason: emergencyReasonText })
          : t('emergencyEntry', 'Emergency entry')
        : '';
      const existing = byLcgTime.get(lcgTime);
      if (existing) {
        byLcgTime.set(lcgTime, mergeNonEmpty(existing, { ...partial, reason: emergencyReason, isEmergency }));
      } else {
        byLcgTime.set(lcgTime, {
          id: `api-${lcgTime}-${encounter.uuid ?? ''}`,
          date: fmtDate(encounter.encounterDatetime ?? ''),
          time: fmtTime(encounter.encounterDatetime ?? ''),
          lcgTime,
          pulse: '',
          systolicBp: '',
          diastolicBp: '',
          temperature: '',
          urine: '',
          reason: emergencyReason,
          isEmergency,
          ...(partial.pulse ? { pulse: partial.pulse } : {}),
          ...(partial.systolicBp ? { systolicBp: partial.systolicBp } : {}),
          ...(partial.diastolicBp ? { diastolicBp: partial.diastolicBp } : {}),
          ...(partial.temperature ? { temperature: partial.temperature } : {}),
          ...(partial.urine ? { urine: partial.urine } : {}),
        });
      }
    };

    [...pulseEncounters].forEach((enc: any) => {
      mergeEnc(enc, {
        pulse: getEncounterObsValue(enc, PARTOGRAPHY_CONCEPTS['maternal-pulse']),
      });
    });
    [...bloodPressureEncounters].forEach((enc: any) => {
      mergeEnc(enc, {
        systolicBp: getEncounterObsValue(enc, PARTOGRAPHY_CONCEPTS['systolic-bp']),
        diastolicBp: getEncounterObsValue(enc, PARTOGRAPHY_CONCEPTS['diastolic-bp']),
      });
    });
    [...temperatureEncounters].forEach((enc: any) => {
      mergeEnc(enc, { temperature: getEncounterObsValue(enc, PARTOGRAPHY_CONCEPTS.temperature) });
    });
    [...urineEncounters].forEach((enc: any) => {
      const prot = formatProteinToken(getEncounterObsValue(enc, PARTOGRAPHY_CONCEPTS['protein-level']));
      const acet = formatAcetoneToken(getEncounterObsValue(enc, PARTOGRAPHY_CONCEPTS['ketone-level']));
      const urine = prot && acet ? `${prot}/${acet}` : prot || acet || '';
      mergeEnc(enc, { urine });
    });

    for (const entry of localEntries) {
      const prot = entry.protein ? formatProteinToken(entry.protein) : '';
      const acet = entry.acetone ? formatAcetoneToken(entry.acetone) : '';
      const existing = byLcgTime.get(entry.time);
      const urineValue = prot && acet ? `${prot}/${acet}` : prot || acet || '';
      if (existing) {
        byLcgTime.set(
          entry.time,
          mergeNonEmpty(existing, {
            pulse: entry.pulse,
            systolicBp: entry.systolicBp,
            diastolicBp: entry.diastolicBp,
            temperature: entry.temperature,
            urine: urineValue,
            reason: entry.isEmergency
              ? entry.emergencyReason?.trim()
                ? t('emergencyReasonLabel', 'Emergency: {{reason}}', { reason: entry.emergencyReason.trim() })
                : t('emergencyEntry', 'Emergency entry')
              : '',
            isEmergency: Boolean(entry.isEmergency),
          }),
        );
      } else {
        byLcgTime.set(entry.time, {
          id: `local-${entry.time}-${entry.recordedAt}`,
          date: fmtDate(entry.recordedAt),
          time: fmtTime(entry.recordedAt),
          lcgTime: entry.time,
          pulse: entry.pulse ?? '',
          systolicBp: entry.systolicBp ?? '',
          diastolicBp: entry.diastolicBp ?? '',
          temperature: entry.temperature ?? '',
          urine: urineValue,
          reason: entry.isEmergency
            ? entry.emergencyReason?.trim()
              ? t('emergencyReasonLabel', 'Emergency: {{reason}}', { reason: entry.emergencyReason.trim() })
              : t('emergencyEntry', 'Emergency entry')
            : '',
          isEmergency: Boolean(entry.isEmergency),
        });
      }
    }

    return Array.from(byLcgTime.values())
      .filter((row) => Boolean(row.pulse || row.systolicBp || row.diastolicBp || row.temperature || row.urine))
      .sort(
        (left, right) =>
          new Date(`${left.date.split('/').reverse().join('-')}T${left.time || '00:00'}:00`).getTime() -
          new Date(`${right.date.split('/').reverse().join('-')}T${right.time || '00:00'}:00`).getTime(),
      );
  }, [bloodPressureEncounters, localEntries, pulseEncounters, t, temperatureEncounters, urineEncounters]);

  const emergencyRowIds = React.useMemo(
    () => new Set(tableRows.filter((r) => Boolean(r.isEmergency)).map((r) => r.id)),
    [tableRows],
  );

  const getCellClassName = (slotState: LcgSlotState | null) => {
    if (slotState === 'locked' || slotState === 'pending') {
      return `${styles.entryCell} ${styles.lockedEntryCell}`;
    }

    if (slotState === 'active') {
      return `${styles.entryCell} ${styles.activeEntryCell}`;
    }

    return styles.entryCell;
  };

  const getVerticalSegmentClassName = (slotState: LcgSlotState | null, hasValue: boolean) => {
    if (hasValue || slotState === 'locked' || slotState === 'pending') {
      return styles.lockedEntryCell;
    }

    if (slotState === 'active') {
      return styles.activeEntryCell;
    }

    return '';
  };

  const renderEntryValue = (rowKey: keyof WomanEntry, value: string) => {
    if (!value) {
      return '';
    }

    if (rowKey === 'urine') {
      const [protein = '', acetone = ''] = value.split('/');
      const proteinAlert = protein.trim().toUpperCase() === 'P++' || protein.trim().toUpperCase() === 'P+++';
      const acetoneAlert = acetone.trim().toUpperCase() === 'A++' || acetone.trim().toUpperCase() === 'A+++';
      const guidance = getWomanAlertGuidance(t, 'urine');

      return (
        <>
          {proteinAlert ? (
            <span className={styles.alertCircle} title={guidance}>
              {protein}
            </span>
          ) : (
            protein
          )}
          {protein || acetone ? '/' : ''}
          {acetoneAlert ? (
            <span className={styles.alertCircle} title={guidance}>
              {acetone}
            </span>
          ) : (
            acetone
          )}
        </>
      );
    }

    return isWomanAlertValue(rowKey as WomanAlertKey, value) ? (
      <span className={styles.alertCircle} title={getWomanAlertGuidance(t, rowKey as WomanAlertKey)}>
        {value}
      </span>
    ) : (
      value
    );
  };

  return (
    <div className={`${styles.sectionBlock} ${styles.continuousSheetSection}`}>
      <div className={styles.sectionHeaderControls}>
        <div className={styles.sectionHeaderStack}>
          <SectionToolbar
            showViewToggle={showViewToggle}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddClick={onAddClick}
          />
          {nextAllowedTime ? (
            <div className={styles.sectionHintText}>
              {t(
                'womanLastAndNextAllowedTime',
                `Last observation at ${latestObservationTime}. Next woman observation window opens around ${nextAllowedTime}`,
              )}
            </div>
          ) : null}
        </div>
      </div>

      {viewMode === 'graph' ? (
        <table className={styles.gridTable}>
          <tbody>
            {womanRows.map((row, rowIndex) => (
              <tr key={row.parameter}>
                {rowIndex === 0 ? (
                  <td className={styles.verticalLabel} rowSpan={womanRows.length}>
                    {t('woman', 'WOMAN')}
                  </td>
                ) : null}
                <td className={styles.parameterCell}>{t(row.parameter, row.parameter)}</td>
                <td className={styles.alertValueCell}>{row.alert}</td>

                {activeFirstStageHours.map((hour, idx) => {
                  const entry = mergedSlotEntries.get(idx);
                  const slotTime = getSlotTimeByIndex(idx);
                  const rowKey =
                    row.parameter === 'Pulse'
                      ? 'pulse'
                      : row.parameter === 'Systolic BP'
                        ? 'systolicBp'
                        : row.parameter === 'Diastolic BP'
                          ? 'diastolicBp'
                          : row.parameter === 'Temperature °C'
                            ? 'temperature'
                            : 'urine';
                  const isPostStop = stopSlotIndex !== undefined && idx > stopSlotIndex;
                  const isPreStop = stopSlotIndex !== undefined && idx < stopSlotIndex;
                  const rawSlotState: LcgSlotState | null =
                    firstStageCutoffSlotIndex !== undefined && idx > firstStageCutoffSlotIndex
                      ? 'locked'
                      : (womanFirstStageCellStates.get(idx) ?? null);
                  const slotState = isPostStop
                    ? 'locked'
                    : isPreStop && rawSlotState === 'active'
                      ? 'locked'
                      : stopSlotIndex !== undefined && rawSlotState === 'active'
                        ? 'locked'
                        : rawSlotState;

                  const displayValue = entry ? String(entry[rowKey as keyof WomanEntry] ?? '') : '';

                  return (
                    <td key={`${row.parameter}-woman-active-${hour}`} className={getCellClassName(slotState)}>
                      {displayValue ? renderEntryValue(rowKey as keyof WomanEntry, displayValue) : ''}
                    </td>
                  );
                })}

                <td className={styles.gapCell} />

                {secondStageHours.map((hour, idx) => {
                  const slotIndex = activeFirstStageHours.length + idx;
                  const entryGroup = secondStageSegmentEntries.get(idx);
                  const rowKey =
                    row.parameter === 'Pulse'
                      ? 'pulse'
                      : row.parameter === 'Systolic BP'
                        ? 'systolicBp'
                        : row.parameter === 'Diastolic BP'
                          ? 'diastolicBp'
                          : row.parameter === 'Temperature °C'
                            ? 'temperature'
                            : 'urine';
                  const isPostStop2 = stopSlotIndex !== undefined && slotIndex > stopSlotIndex;
                  const isPreStop2 = stopSlotIndex !== undefined && slotIndex < stopSlotIndex;
                  const rawSlotState2 = womanScheduleState.lockedSlotIndices.has(slotIndex)
                    ? 'locked'
                    : womanScheduleState.activeSlotIndices.has(slotIndex)
                      ? 'active'
                      : null;
                  const slotState = isPostStop2
                    ? 'locked'
                    : isPreStop2 && rawSlotState2 === 'active'
                      ? 'locked'
                      : stopSlotIndex !== undefined && rawSlotState2 === 'active'
                        ? 'locked'
                        : rawSlotState2;

                  const firstValue = entryGroup?.first
                    ? String(entryGroup.first[rowKey as keyof WomanEntry] ?? '')
                    : '';
                  const secondValue = entryGroup?.second
                    ? String(entryGroup.second[rowKey as keyof WomanEntry] ?? '')
                    : '';

                  const firstDisplayValue = firstValue;
                  const secondDisplayValue = secondValue;

                  return (
                    <td key={`${row.parameter}-woman-second-${hour}`} className={styles.entryCell}>
                      <div className={styles.womanSecondStageSplitCell}>
                        <span
                          className={`${styles.womanSecondStageSplitSegment} ${getVerticalSegmentClassName(
                            slotState,
                            Boolean(firstValue),
                          )}`}>
                          {firstDisplayValue ? renderEntryValue(rowKey as keyof WomanEntry, firstDisplayValue) : ''}
                        </span>
                        <span
                          className={`${styles.womanSecondStageSplitSegment} ${getVerticalSegmentClassName(
                            slotState,
                            Boolean(secondValue),
                          )}`}>
                          {secondDisplayValue ? renderEntryValue(rowKey as keyof WomanEntry, secondDisplayValue) : ''}
                        </span>
                      </div>
                    </td>
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
                        <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
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

export default Woman;
