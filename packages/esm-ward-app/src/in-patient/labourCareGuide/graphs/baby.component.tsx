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
import {
  getPointSlotState,
  getPointSlotIndexForTime,
  getStageAwareSlotIndexForTime,
  getStageAwarePointSlotIndexForTime,
  formatHHMM,
  type LcgSlotState,
} from '../time-slot-utils';
import { buildWomanScheduleState } from '../woman-schedule-utils';
import {
  LCG_BABY_FIRST_STAGE_FHR_INTERVAL_MINUTES,
  LCG_BABY_SECOND_STAGE_FHR_INTERVAL_MINUTES,
  LCG_BABY_SECOND_STAGE_LOWER_INTERVAL_MINUTES,
  LCG_BABY_VAGINAL_EXAM_INTERVAL_MINUTES,
  LCG_BABY_FIRST_STAGE_LOWER_INTERVAL_COLUMNS,
  LCG_TIME_INCREMENT_MINUTES,
} from '../types';
import { getBabyAlertGuidance, isBabyAlertValue, type BabyAlertKey } from '../alert-rules';
import { SectionToolbar } from '../components/section-toolbar.component';

const BABY_PRIMARY_FHR_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_BABY_FIRST_STAGE_FHR_INTERVAL_MINUTES - 1,
};

const BABY_HALF_GRID_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
  offsetMinutes: LCG_BABY_FIRST_STAGE_FHR_INTERVAL_MINUTES,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_BABY_FIRST_STAGE_FHR_INTERVAL_MINUTES - 1,
};

const BABY_BASE_ROW_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_BABY_VAGINAL_EXAM_INTERVAL_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_BABY_VAGINAL_EXAM_INTERVAL_MINUTES - 1,
};

const BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS = Array.from({ length: 4 }, (_, segmentIndex) => ({
  slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
  offsetMinutes: segmentIndex * LCG_BABY_SECOND_STAGE_FHR_INTERVAL_MINUTES,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_BABY_SECOND_STAGE_FHR_INTERVAL_MINUTES - 1,
}));

const BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS = [
  {
    // In second stage, lower baby section first half-slot (30 min).
    slotIntervalMinutes: LCG_BABY_SECOND_STAGE_LOWER_INTERVAL_MINUTES,
    offsetMinutes: 0,
    earlyAllowanceMinutes: 0,
    lateAllowanceMinutes: Math.max(0, Math.round(LCG_BABY_SECOND_STAGE_LOWER_INTERVAL_MINUTES / 2) - 1),
  },
  {
    // In second stage, lower baby section second half-slot (30 min).
    slotIntervalMinutes: LCG_BABY_SECOND_STAGE_LOWER_INTERVAL_MINUTES,
    offsetMinutes: Math.round(LCG_BABY_SECOND_STAGE_LOWER_INTERVAL_MINUTES / 2),
    earlyAllowanceMinutes: 0,
    lateAllowanceMinutes: Math.max(0, Math.round(LCG_BABY_SECOND_STAGE_LOWER_INTERVAL_MINUTES / 2) - 1),
  },
];

export type BabyEntry = {
  id: string;
  encounterDatetime: string;
  time: string;
  twinIndex: number;
  baselineFhr: string;
  fhrDeceleration: string;
  amnioticFluid: string;
  fetalPosition: string;
  caput: string;
  moulding: string;
  isEmergency?: boolean;
  emergencyReason?: string;
};

interface BabyProps {
  activeFirstStageHours: number[];
  secondStageHours: number[];
  onAddClick?: () => void;
  showViewToggle?: boolean;
  baseTime?: string;
  entries?: BabyEntry[];
  firstStageCutoffSlotIndex?: number;
  secondStageStartTime?: string;
  stopSlotIndex?: number;
  stopMarkerSlotIndex?: number;
  fetalStopSlotIndex?: number;
  sectionLabel?: string;
  showLowerRows?: boolean;
  showBirthLabel?: boolean;
}

type BabyUpperSlotEntries = Record<string, BabyEntry | undefined>;
type BabyLowerSecondStageSlotEntries = Record<string, BabyEntry | undefined>;
type BabyTableRow = {
  id: string;
  date: string;
  time: string;
  lcgTime: string;
  baselineFhr: string;
  fhrDeceleration: string;
  amnioticFluid: string;
  fetalPosition: string;
  caput: string;
  moulding: string;
  reason: string;
  isEmergency: boolean;
};

const secondStageUpperSegmentKeys = BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS.map((_, index) => `segment-${index}`);
const secondStageLowerSegmentKeys = BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS.map((_, index) => `segment-${index}`);

const babyRows = [
  { parameter: 'Baseline FHR', alert: '<110, ≥160', splitCells: true, key: 'baselineFhr', group: 'upper' },
  { parameter: 'FHR deceleration', alert: 'L', splitCells: true, key: 'fhrDeceleration', group: 'upper' },
  { parameter: 'Amniotic fluid', alert: 'M+++, B', splitCells: false, key: 'amnioticFluid', group: 'lower' },
  { parameter: 'Fetal position', alert: 'P, T', splitCells: false, key: 'fetalPosition', group: 'lower' },
  { parameter: 'Caput', alert: '+++', splitCells: false, key: 'caput', group: 'lower' },
  { parameter: 'Moulding', alert: '+++', splitCells: false, key: 'moulding', group: 'lower' },
];

const Baby: React.FC<BabyProps> = ({
  activeFirstStageHours,
  secondStageHours,
  onAddClick,
  showViewToggle = true,
  baseTime,
  entries = [],
  firstStageCutoffSlotIndex,
  secondStageStartTime,
  stopSlotIndex,
  stopMarkerSlotIndex,
  fetalStopSlotIndex,
  sectionLabel,
  showLowerRows = true,
  showBirthLabel = false,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = React.useState<'graph' | 'table'>('graph');
  const [firstRowIndex, setFirstRowIndex] = React.useState(0);
  const [currentPageSize, setCurrentPageSize] = React.useState(10);
  const [now, setNow] = React.useState(() => new Date());
  const graphEntries = React.useMemo(() => entries.filter((entry) => !entry.isEmergency), [entries]);
  const showEmergencyReasonColumn = React.useMemo(() => entries.some((entry) => entry.isEmergency), [entries]);
  const totalSlots = activeFirstStageHours.length + secondStageHours.length;
  const effectiveWholeStopSlotIndex = stopSlotIndex;
  const effectiveWholeStopMarkerSlotIndex =
    stopMarkerSlotIndex ??
    (effectiveWholeStopSlotIndex !== undefined ? Math.min(effectiveWholeStopSlotIndex + 1, totalSlots - 1) : undefined);
  const effectiveFetalStopSlotIndex = fetalStopSlotIndex ?? stopSlotIndex;
  const effectiveFetalStopMarkerSlotIndex =
    effectiveFetalStopSlotIndex !== undefined && effectiveFetalStopSlotIndex >= 0
      ? Math.min(effectiveFetalStopSlotIndex + 1, totalSlots - 1)
      : effectiveWholeStopMarkerSlotIndex;
  // Use pre-computed column count (1 guideline hour = 1 grid column, scale-independent)
  const firstStageLowerIntervalSlots = Math.max(1, LCG_BABY_FIRST_STAGE_LOWER_INTERVAL_COLUMNS);

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

  const upperEntries = React.useMemo(
    () => graphEntries.filter((entry) => Boolean(entry.baselineFhr || entry.fhrDeceleration)),
    [graphEntries],
  );

  const lowerEntries = React.useMemo(
    () =>
      graphEntries.filter((entry) =>
        Boolean(entry.amnioticFluid || entry.fetalPosition || entry.caput || entry.moulding),
      ),
    [graphEntries],
  );
  const filteredLowerEntries = React.useMemo(() => (showLowerRows ? lowerEntries : []), [lowerEntries, showLowerRows]);

  const firstStageUpperSlotEntries = React.useMemo(() => {
    const mappedEntries = new Map<number, BabyUpperSlotEntries>();

    if (!baseTime) {
      upperEntries.slice(0, activeFirstStageHours.length).forEach((entry, index) => {
        mappedEntries.set(index, { primary: entry });
      });
      return mappedEntries;
    }

    const orderedEntries = [...upperEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );

    for (const entry of orderedEntries) {
      if (secondStageStartTime) {
        const matchesSecondStage = BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS.some(
          (option) =>
            getPointSlotIndexForTime(secondStageStartTime, entry.time, secondStageHours.length, option) !== null,
        );
        if (matchesSecondStage) {
          continue;
        }
      }

      const primarySlotIndex = getPointSlotIndexForTime(
        baseTime,
        entry.time,
        activeFirstStageHours.length,
        BABY_PRIMARY_FHR_SLOT_OPTIONS,
      );
      if (primarySlotIndex !== null) {
        mappedEntries.set(primarySlotIndex, {
          ...mappedEntries.get(primarySlotIndex),
          primary: entry,
        });
        continue;
      }

      const secondarySlotIndex = getPointSlotIndexForTime(
        baseTime,
        entry.time,
        activeFirstStageHours.length,
        BABY_HALF_GRID_SLOT_OPTIONS,
      );
      if (secondarySlotIndex !== null) {
        mappedEntries.set(secondarySlotIndex, {
          ...mappedEntries.get(secondarySlotIndex),
          secondary: entry,
        });
      }
    }

    return mappedEntries;
  }, [activeFirstStageHours.length, baseTime, secondStageHours.length, secondStageStartTime, upperEntries]);

  const secondStageUpperSlotEntries = React.useMemo(() => {
    const mappedEntries = new Map<number, BabyUpperSlotEntries>();

    if (!secondStageStartTime) {
      return mappedEntries;
    }

    const orderedEntries = [...upperEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );

    for (const entry of orderedEntries) {
      const matchedSegmentIndex = BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS.findIndex(
        (option) =>
          getPointSlotIndexForTime(secondStageStartTime, entry.time, secondStageHours.length, option) !== null,
      );

      if (matchedSegmentIndex === -1) {
        continue;
      }

      const slotIndex = getPointSlotIndexForTime(
        secondStageStartTime,
        entry.time,
        secondStageHours.length,
        BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS[matchedSegmentIndex],
      );

      if (slotIndex === null) {
        continue;
      }

      const segmentKey = secondStageUpperSegmentKeys[matchedSegmentIndex];
      mappedEntries.set(slotIndex, {
        ...mappedEntries.get(slotIndex),
        [segmentKey]: entry,
      });
    }

    return mappedEntries;
  }, [secondStageHours.length, secondStageStartTime, upperEntries]);

  const upperBirthMarkerSlotIndex = React.useMemo(() => {
    const populatedFirstStageSlots = Array.from(firstStageUpperSlotEntries.entries())
      .filter(([, group]) => Boolean(group?.primary || group?.secondary))
      .map(([slotIndex]) => slotIndex);

    const populatedSecondStageSlots = Array.from(secondStageUpperSlotEntries.entries())
      .filter(([, group]) => secondStageUpperSegmentKeys.some((segmentKey) => Boolean(group?.[segmentKey])))
      .map(([slotIndex]) => activeFirstStageHours.length + slotIndex);

    const allPopulatedSlots = [...populatedFirstStageSlots, ...populatedSecondStageSlots];
    if (allPopulatedSlots.length === 0) {
      return 0;
    }

    return Math.max(...allPopulatedSlots);
  }, [activeFirstStageHours.length, firstStageUpperSlotEntries, secondStageUpperSlotEntries]);

  const firstStageLowerSlotEntries = React.useMemo(() => {
    const mappedEntries = new Map<number, BabyEntry>();

    if (!baseTime) {
      return mappedEntries;
    }

    const orderedEntries = [...filteredLowerEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );

    for (const entry of orderedEntries) {
      if (secondStageStartTime) {
        const matchesSecondStage = BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS.some(
          (option) =>
            getPointSlotIndexForTime(secondStageStartTime, entry.time, secondStageHours.length, option) !== null,
        );
        if (matchesSecondStage) {
          continue;
        }
      }

      const currentSlotIndex = getStageAwareSlotIndexForTime(baseTime, entry.time, activeFirstStageHours.length, 0);
      if (currentSlotIndex === null || currentSlotIndex < 0 || currentSlotIndex >= activeFirstStageHours.length) {
        continue;
      }

      // Keep the latest value when multiple submissions target the same slot.
      mappedEntries.set(currentSlotIndex, entry);
    }

    return mappedEntries;
  }, [activeFirstStageHours.length, baseTime, filteredLowerEntries, secondStageHours.length, secondStageStartTime]);

  const secondStageLowerSlotEntries = React.useMemo(() => {
    const mappedEntries = new Map<number, BabyLowerSecondStageSlotEntries>();

    if (!secondStageStartTime) {
      return mappedEntries;
    }

    const orderedEntries = [...filteredLowerEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );

    for (const entry of orderedEntries) {
      const matchedSegmentIndex = BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS.findIndex(
        (option) =>
          getPointSlotIndexForTime(secondStageStartTime, entry.time, secondStageHours.length, option) !== null,
      );

      if (matchedSegmentIndex === -1) {
        continue;
      }

      const slotIndex = getPointSlotIndexForTime(
        secondStageStartTime,
        entry.time,
        secondStageHours.length,
        BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS[matchedSegmentIndex],
      );

      if (slotIndex === null) {
        continue;
      }

      const segmentKey = secondStageLowerSegmentKeys[matchedSegmentIndex];
      mappedEntries.set(slotIndex, {
        ...mappedEntries.get(slotIndex),
        [segmentKey]: entry,
      });
    }

    return mappedEntries;
  }, [filteredLowerEntries, secondStageHours.length, secondStageStartTime]);

  const upperSlotStates = React.useMemo(() => {
    return Array.from({ length: totalSlots }, (_, slotIndex) => ({
      primary: baseTime ? getPointSlotState(baseTime, slotIndex, now, BABY_PRIMARY_FHR_SLOT_OPTIONS) : null,
      secondary: baseTime ? getPointSlotState(baseTime, slotIndex, now, BABY_HALF_GRID_SLOT_OPTIONS) : null,
    }));
  }, [baseTime, now, totalSlots]);

  const firstStageLowerFilledSlotIndices = React.useMemo(() => {
    if (!baseTime) {
      return [] as number[];
    }

    const filled = new Set<number>();
    for (const entry of filteredLowerEntries) {
      if (secondStageStartTime) {
        const matchesSecondStage = BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS.some(
          (option) =>
            getPointSlotIndexForTime(secondStageStartTime, entry.time, secondStageHours.length, option) !== null,
        );
        if (matchesSecondStage) {
          continue;
        }
      }

      const slotIndex = getStageAwareSlotIndexForTime(baseTime, entry.time, activeFirstStageHours.length, 0);

      if (slotIndex !== null && slotIndex >= 0 && slotIndex < activeFirstStageHours.length) {
        filled.add(slotIndex);
      }
    }

    return Array.from(filled).sort((a, b) => a - b);
  }, [activeFirstStageHours.length, baseTime, filteredLowerEntries, secondStageHours.length, secondStageStartTime]);

  const firstStageCurrentSlotIndex = React.useMemo(() => {
    if (!baseTime || activeFirstStageHours.length <= 0) {
      return null;
    }

    return getStageAwareSlotIndexForTime(baseTime, formatHHMM(now), activeFirstStageHours.length, 0);
  }, [activeFirstStageHours.length, baseTime, now]);

  const firstStageLowerActiveSlotIndex = React.useMemo(() => {
    if (firstStageCurrentSlotIndex === null || activeFirstStageHours.length <= 0) {
      return null;
    }

    if (firstStageLowerFilledSlotIndices.length === 0) {
      return Math.min(firstStageCurrentSlotIndex, activeFirstStageHours.length - 1);
    }

    const latestFilledSlotIndex = Math.max(...firstStageLowerFilledSlotIndices);
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
    firstStageLowerFilledSlotIndices,
    firstStageLowerIntervalSlots,
  ]);

  const lowerSlotStates = React.useMemo(
    () =>
      Array.from({ length: totalSlots }, (_, slotIndex) => {
        if (!baseTime) {
          return null;
        }

        if (slotIndex < activeFirstStageHours.length) {
          const isFilled = firstStageLowerFilledSlotIndices.includes(slotIndex);
          if (isFilled) {
            return 'locked';
          }

          if (firstStageCurrentSlotIndex === null) {
            return null;
          }

          if (firstStageLowerActiveSlotIndex !== null && slotIndex < firstStageLowerActiveSlotIndex) {
            return 'locked';
          }

          if (firstStageLowerActiveSlotIndex !== null && slotIndex === firstStageLowerActiveSlotIndex) {
            return firstStageCurrentSlotIndex >= firstStageLowerActiveSlotIndex ? 'active' : null;
          }

          return null;
        }

        return getPointSlotState(baseTime, slotIndex, now, BABY_BASE_ROW_SLOT_OPTIONS);
      }),
    [
      activeFirstStageHours.length,
      baseTime,
      firstStageCurrentSlotIndex,
      firstStageLowerActiveSlotIndex,
      firstStageLowerFilledSlotIndices,
      now,
      totalSlots,
    ],
  );

  const getCellClassName = (slotState: LcgSlotState | null) => {
    if (slotState === 'locked') {
      return `${styles.entryCell} ${styles.lockedEntryCell}`;
    }

    if (slotState === 'active') {
      return `${styles.entryCell} ${styles.activeEntryCell}`;
    }

    return styles.entryCell;
  };

  const getSegmentClassName = (slotState: LcgSlotState | null) => {
    if (slotState === 'locked') {
      return `${styles.splitSegment} ${styles.lockedEntryCell}`;
    }

    if (slotState === 'active') {
      return `${styles.splitSegment} ${styles.activeEntryCell}`;
    }

    return styles.splitSegment;
  };

  const renderEntryValue = (rowKey: keyof BabyEntry, value: string) => {
    if (!value) {
      return '';
    }

    const renderedValue = isBabyAlertValue(rowKey as BabyAlertKey, value) ? (
      <span className={styles.alertCircle} title={getBabyAlertGuidance(t, rowKey as BabyAlertKey)}>
        {value}
      </span>
    ) : (
      value
    );

    if (rowKey === 'baselineFhr') {
      return <span className={styles.verticalPlotValue}>{renderedValue}</span>;
    }

    return renderedValue;
  };

  const renderUpperCell = (slotIndex: number, rowKey: keyof BabyEntry, colSpan = 1) => {
    const isSecondStage = slotIndex >= activeFirstStageHours.length;
    const isPostStop = effectiveFetalStopSlotIndex !== undefined && slotIndex > effectiveFetalStopSlotIndex;
    const isPreStop = effectiveFetalStopSlotIndex !== undefined && slotIndex < effectiveFetalStopSlotIndex;
    const showBirthBannerInUpperRow =
      showBirthLabel && slotIndex === (effectiveFetalStopMarkerSlotIndex ?? upperBirthMarkerSlotIndex);

    if (isSecondStage) {
      const secondStageIndex = slotIndex - activeFirstStageHours.length;
      const entryGroup = secondStageUpperSlotEntries.get(secondStageIndex);

      return (
        <td className={styles.entryCell} colSpan={colSpan}>
          <div
            className={styles.splitCellFour}
            style={{ gridTemplateColumns: `repeat(${secondStageUpperSegmentKeys.length}, minmax(0, 1fr))` }}>
            {secondStageUpperSegmentKeys.map((segmentKey, segmentIndex) => {
              const rawSegmentState = secondStageStartTime
                ? getPointSlotState(
                    secondStageStartTime,
                    secondStageIndex,
                    now,
                    BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS[segmentIndex],
                  )
                : null;
              const segmentState = isPostStop
                ? null
                : isPreStop && rawSegmentState === 'active'
                  ? 'locked'
                  : rawSegmentState;
              const segmentEntry = entryGroup?.[segmentKey];
              const segmentValue = segmentEntry ? String(segmentEntry[rowKey] ?? '') : '';
              const showSegmentBirthBadge = showBirthBannerInUpperRow && segmentIndex === 0;

              return (
                <span key={`${slotIndex}-${segmentKey}`} className={getSegmentClassName(segmentState)}>
                  {renderEntryValue(rowKey, segmentValue)}
                  {showSegmentBirthBadge ? (
                    <span className={`${styles.birthCellBanner} ${styles.birthCellBannerInline}`}>
                      {t('birth', 'BIRTH')}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </td>
      );
    }

    const entryGroup = firstStageUpperSlotEntries.get(slotIndex);
    const slotState = upperSlotStates[slotIndex];
    const isLockedByStageTransition = firstStageCutoffSlotIndex !== undefined && slotIndex > firstStageCutoffSlotIndex;
    const primaryValue = entryGroup?.primary ? String(entryGroup.primary[rowKey] ?? '') : '';
    const secondaryValue = entryGroup?.secondary ? String(entryGroup.secondary[rowKey] ?? '') : '';
    const rawPrimary = slotState?.primary ?? null;
    const rawSecondary = slotState?.secondary ?? null;
    const computedPrimary = isPostStop
      ? null
      : isLockedByStageTransition
        ? 'locked'
        : isPreStop && rawPrimary === 'active'
          ? 'locked'
          : rawPrimary;
    const computedSecondary = isPostStop
      ? null
      : isLockedByStageTransition
        ? 'locked'
        : isPreStop && rawSecondary === 'active'
          ? 'locked'
          : rawSecondary;
    const birthCellClassName = `${styles.birthCellBanner} ${styles.birthCellBannerInline}`;
    const showPrimaryBirthBadge = showBirthBannerInUpperRow && Boolean(primaryValue || !secondaryValue);
    const showSecondaryBirthBadge = showBirthBannerInUpperRow && !showPrimaryBirthBadge;

    return (
      <td className={styles.entryCell} colSpan={colSpan}>
        <div className={styles.splitCellTwo}>
          <span className={getSegmentClassName(computedPrimary)}>
            {renderEntryValue(rowKey, primaryValue)}
            {showPrimaryBirthBadge ? <span className={birthCellClassName}>{t('birth', 'BIRTH')}</span> : null}
          </span>
          <span className={getSegmentClassName(computedSecondary)}>
            {renderEntryValue(rowKey, secondaryValue)}
            {showSecondaryBirthBadge ? <span className={birthCellClassName}>{t('birth', 'BIRTH')}</span> : null}
          </span>
        </div>
      </td>
    );
  };

  const renderSecondStageLowerCell = (slotIndex: number, rowKey: keyof BabyEntry) => {
    const entryGroup = secondStageLowerSlotEntries.get(slotIndex);
    const absoluteSlotIndex = activeFirstStageHours.length + slotIndex;
    const isPostStop = effectiveWholeStopSlotIndex !== undefined && absoluteSlotIndex > effectiveWholeStopSlotIndex;
    const isPreStop = effectiveWholeStopSlotIndex !== undefined && absoluteSlotIndex < effectiveWholeStopSlotIndex;

    return secondStageLowerSegmentKeys.map((segmentKey, segmentIndex) => {
      const rawSlotState = secondStageStartTime
        ? getPointSlotState(secondStageStartTime, slotIndex, now, BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS[segmentIndex])
        : null;
      const slotState = isPostStop ? null : isPreStop && rawSlotState === 'active' ? 'locked' : rawSlotState;
      const segmentEntry = entryGroup?.[segmentKey];
      const value = segmentEntry ? String(segmentEntry[rowKey] ?? '') : '';

      return (
        <td key={`${slotIndex}-${segmentKey}`} className={getCellClassName(slotState)}>
          {renderEntryValue(rowKey, value)}
        </td>
      );
    });
  };

  const renderSectionToolbar = () => {
    const showToolbarTitle = showViewToggle || Boolean(onAddClick) || showBirthLabel;

    return (
      <div className={styles.sectionToolbar}>
        {showToolbarTitle ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 600 }}>{sectionLabel ?? t('baby', 'BABY')}</span>
            {showBirthLabel ? <span className={styles.birthSectionBadge}>{t('birth', 'Birth')}</span> : null}
          </div>
        ) : null}
        <SectionToolbar
          showViewToggle={showViewToggle}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAddClick={onAddClick}
          addLabel={t('add', 'Add')}
        />
      </div>
    );
  };

  const slotTimeByIndex = React.useMemo(() => {
    if (!baseTime) {
      return new Map<number, string>();
    }

    const toHHMM = (minutesFromBase: number) => {
      const [h, m] = baseTime.split(':').map(Number);
      const baseMinutes = h * 60 + m;
      const total = (baseMinutes + minutesFromBase + 24 * 60) % (24 * 60);
      const hh = String(Math.floor(total / 60)).padStart(2, '0');
      const mm = String(total % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    return new Map(Array.from({ length: totalSlots }, (_, idx) => [idx, toHHMM(idx * LCG_TIME_INCREMENT_MINUTES)]));
  }, [baseTime, totalSlots]);

  const lowerFilledSlotIndices = React.useMemo(() => {
    if (!baseTime) {
      return [] as number[];
    }

    const indices = new Set<number>();
    for (const entry of filteredLowerEntries) {
      const slotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        entry.time,
        activeFirstStageHours.length,
        secondStageHours.length,
        secondStageStartTime,
        BABY_BASE_ROW_SLOT_OPTIONS,
      );
      if (slotIndex !== null) {
        indices.add(slotIndex);
      }
    }

    return Array.from(indices).sort((a, b) => a - b);
  }, [activeFirstStageHours.length, baseTime, filteredLowerEntries, secondStageHours.length, secondStageStartTime]);

  const lowerScheduleState = React.useMemo(
    () =>
      buildWomanScheduleState({
        baseTime,
        slotCount: totalSlots,
        actualFilledSlotIndices: lowerFilledSlotIndices,
        intervalMinutes: LCG_BABY_VAGINAL_EXAM_INTERVAL_MINUTES,
        now,
      }),
    [baseTime, lowerFilledSlotIndices, now, totalSlots],
  );

  const tableRows = React.useMemo(() => {
    const rows: BabyTableRow[] = [];

    const sortedEntries = [...entries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );

    for (const entry of sortedEntries) {
      const stamp = new Date(entry.encounterDatetime);
      const emergencyReason = entry.emergencyReason?.trim();
      rows.push({
        id: entry.id,
        date: Number.isNaN(stamp.getTime()) ? '' : stamp.toLocaleDateString('en-GB'),
        time: Number.isNaN(stamp.getTime())
          ? ''
          : stamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        lcgTime: entry.time,
        baselineFhr: entry.baselineFhr || '',
        fhrDeceleration: entry.fhrDeceleration || '',
        amnioticFluid: showLowerRows ? entry.amnioticFluid || '' : '',
        fetalPosition: showLowerRows ? entry.fetalPosition || '' : '',
        caput: showLowerRows ? entry.caput || '' : '',
        moulding: showLowerRows ? entry.moulding || '' : '',
        reason: entry.isEmergency
          ? emergencyReason
            ? t('emergencyReasonLabel', 'Emergency: {{reason}}', { reason: emergencyReason })
            : t('emergencyEntry', 'Emergency entry')
          : '',
        isEmergency: Boolean(entry.isEmergency),
      });
    }

    return rows.sort((left, right) => left.lcgTime.localeCompare(right.lcgTime));
  }, [entries, showLowerRows, t]);

  const emergencyRowIds = React.useMemo(
    () => new Set(tableRows.filter((r) => r.isEmergency).map((r) => r.id)),
    [tableRows],
  );

  const tableHeaders = React.useMemo(
    () => [
      { key: 'date', header: t('date', 'Date') },
      { key: 'time', header: t('timeSaved', 'Time') },
      { key: 'lcgTime', header: t('lcgTime', 'LCG Time') },
      { key: 'baselineFhr', header: t('baselineFhr', 'Baseline FHR') },
      { key: 'fhrDeceleration', header: t('fhrDeceleration', 'FHR deceleration') },
      ...(showLowerRows
        ? [
            { key: 'amnioticFluid', header: t('amnioticFluid', 'Amniotic fluid') },
            { key: 'fetalPosition', header: t('fetalPosition', 'Fetal position') },
            { key: 'caput', header: t('caput', 'Caput') },
            { key: 'moulding', header: t('moulding', 'Moulding') },
          ]
        : []),
      ...(showEmergencyReasonColumn ? [{ key: 'reason', header: t('reason', 'Reason') }] : []),
    ],
    [showEmergencyReasonColumn, showLowerRows, t],
  );

  const renderedRows = React.useMemo(
    () => (showLowerRows ? babyRows : babyRows.filter((row) => row.group === 'upper')),
    [showLowerRows],
  );

  return (
    <div className={styles.sectionBlock}>
      <div className={styles.sectionHeaderControls}>{renderSectionToolbar()}</div>

      {viewMode === 'graph' ? (
        <table className={styles.gridTable}>
          <tbody>
            {renderedRows.map((row, rowIndex) => (
              <tr key={row.parameter}>
                {rowIndex === 0 ? (
                  <td className={styles.verticalLabel} rowSpan={renderedRows.length}>
                    {(sectionLabel ?? t('baby', 'BABY')).toUpperCase()}
                  </td>
                ) : null}
                <td className={styles.parameterCell}>{t(row.parameter, row.parameter)}</td>
                <td className={styles.alertValueCell}>{row.alert}</td>

                {activeFirstStageHours.map((hour, idx) => {
                  const entry = row.group === 'upper' ? null : firstStageLowerSlotEntries.get(idx);
                  const markerSlotIndex = effectiveWholeStopMarkerSlotIndex;
                  const isPostStop = stopSlotIndex !== undefined && idx > stopSlotIndex;
                  const isPreStop = effectiveWholeStopSlotIndex !== undefined && idx < effectiveWholeStopSlotIndex;
                  const slotState =
                    row.group === 'upper'
                      ? null
                      : (() => {
                          const rawState =
                            firstStageCutoffSlotIndex !== undefined
                              ? idx > firstStageCutoffSlotIndex
                                ? 'locked'
                                : null
                              : lowerSlotStates[idx];
                          return isPostStop ? null : isPreStop && rawState === 'active' ? 'locked' : rawState;
                        })();
                  const value = entry ? String(entry[row.key as keyof BabyEntry] ?? '') : '';

                  if (row.group === 'upper') {
                    return (
                      <React.Fragment key={`${row.parameter}-baby-active-${hour}`}>
                        {renderUpperCell(idx, row.key as keyof BabyEntry)}
                      </React.Fragment>
                    );
                  }

                  return (
                    <td key={`${row.parameter}-baby-active-${hour}`} className={getCellClassName(slotState)}>
                      {renderEntryValue(row.key as keyof BabyEntry, value)}
                    </td>
                  );
                })}

                <td className={styles.gapCell} />

                {secondStageHours.map((hour, idx) => {
                  const slotIndex = activeFirstStageHours.length + idx;

                  if (row.group === 'upper') {
                    return (
                      <React.Fragment key={`${row.parameter}-baby-second-${hour}`}>
                        {renderUpperCell(slotIndex, row.key as keyof BabyEntry, 2)}
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={`${row.parameter}-baby-second-${hour}`}>
                      {renderSecondStageLowerCell(idx, row.key as keyof BabyEntry)}
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

export default Baby;
