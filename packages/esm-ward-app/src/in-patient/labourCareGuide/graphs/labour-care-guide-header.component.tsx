import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../labour-care-guide.scss';
import { LCG_TIME_INCREMENT_MINUTES } from '../types';
import { SectionToolbar } from '../components/section-toolbar.component';

interface LabourCareGuideHeaderProps {
  activeFirstStageHours: number[];
  secondStageHours: number[];
  onAddClick?: () => void;
  baseTime?: string;
  firstStageCutoffSlotIndex?: number;
  visibleFirstStageTimeSlotIndices?: number[];
  secondStageStartTime?: string;
  stopSlotIndex?: number;
  stopMarkerSlotIndex?: number;
  stopTime?: string;
}

const LabourCareGuideHeader: React.FC<LabourCareGuideHeaderProps> = ({
  activeFirstStageHours,
  secondStageHours,
  onAddClick,
  baseTime,
  firstStageCutoffSlotIndex,
  visibleFirstStageTimeSlotIndices = [],
  secondStageStartTime,
  stopSlotIndex,
  stopMarkerSlotIndex,
  stopTime,
}) => {
  const { t } = useTranslation();
  const resolvedStopMarkerSlotIndex =
    stopMarkerSlotIndex ??
    (stopSlotIndex !== undefined
      ? Math.min(stopSlotIndex + 1, activeFirstStageHours.length + secondStageHours.length - 1)
      : undefined);
  const visibleFirstStageTimeSlots = React.useMemo(
    () => new Set(visibleFirstStageTimeSlotIndices),
    [visibleFirstStageTimeSlotIndices],
  );

  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    // Refresh on minute boundaries so the UI updates as soon as a slot time is reached.
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

  const pad2 = (n: number) => String(n).padStart(2, '0');

  const parseHHMMToMinutes = (hhmm: string): number | null => {
    const parts = (hhmm ?? '').split(':');
    if (parts.length !== 2) {
      return null;
    }
    const baseHour = Number(parts[0]);
    const baseMinute = Number(parts[1]);
    if (!Number.isInteger(baseHour) || !Number.isInteger(baseMinute)) {
      return null;
    }
    if (baseHour < 0 || baseHour > 23 || baseMinute < 0 || baseMinute > 59) {
      return null;
    }

    return baseHour * 60 + baseMinute;
  };

  const addStepsToHHMM = (hhmm: string, stepIndex: number): string | null => {
    const baseMinutes = parseHHMMToMinutes(hhmm);
    if (baseMinutes === null) {
      return null;
    }

    const minutesInDay = 24 * 60;
    const total = baseMinutes + stepIndex * LCG_TIME_INCREMENT_MINUTES;
    const normalized = ((total % minutesInDay) + minutesInDay) % minutesInDay;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${pad2(h)}:${pad2(m)}`;
  };

  const shouldShowSlot = (hhmm: string, stepIndex: number): boolean => {
    const baseMinutes = parseHHMMToMinutes(hhmm);
    if (baseMinutes === null) {
      return false;
    }
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Handle crossing midnight by treating negative deltas as next-day.
    let delta = nowMinutes - baseMinutes;
    if (delta < 0) {
      delta += 24 * 60;
    }

    return delta >= stepIndex * LCG_TIME_INCREMENT_MINUTES;
  };

  const getTimeCellValue = (
    stageBaseTime: string | undefined,
    stepIndex: number,
    isLocked = false,
    absoluteSlotIndex = stepIndex,
  ): string => {
    if (isLocked) {
      return '';
    }

    if (!stageBaseTime) {
      return ':';
    }

    if (stopSlotIndex !== undefined && absoluteSlotIndex > stopSlotIndex) {
      return '';
    }

    return shouldShowSlot(stageBaseTime, stepIndex) ? (addStepsToHHMM(stageBaseTime, stepIndex) ?? ':') : ':';
  };

  return (
    <div className={styles.headerSection}>
      <div className={styles.headerToolbarRow}>
        <SectionToolbar
          showViewToggle={false}
          viewMode="graph"
          onViewModeChange={() => undefined}
          onAddClick={onAddClick}
        />
      </div>
      <div className={styles.tableWrapper}>
        <table className={`${styles.gridTable} ${styles.headerGridTable}`}>
          <colgroup>
            <col style={{ width: 'var(--lcg-col-vertical)' }} />
            <col style={{ width: 'var(--lcg-col-parameter)' }} />
            <col style={{ width: 'var(--lcg-col-alert)' }} />
            {activeFirstStageHours.map((hour) => (
              <col key={`col-active-${hour}`} style={{ width: 'var(--lcg-col-entry)' }} />
            ))}
            <col style={{ width: 'var(--lcg-col-gap)' }} />
            {secondStageHours.map((hour) => (
              <col key={`col-second-${hour}`} style={{ width: 'var(--lcg-col-entry)' }} />
            ))}
          </colgroup>
          <tbody>
            <tr>
              <td className={styles.headerOffsetCell} rowSpan={3} colSpan={2} />
              <td className={styles.headerLeadCell}>{t('time', 'Time')}</td>
              {activeFirstStageHours.map((hour, idx) => {
                const stepIndex = idx;
                const isPastFirstStageCutoff =
                  firstStageCutoffSlotIndex !== undefined && idx > firstStageCutoffSlotIndex;
                const isPastStop = stopSlotIndex !== undefined && idx > stopSlotIndex;
                const shouldHideUnpopulatedFirstStageTime =
                  isPastFirstStageCutoff && !visibleFirstStageTimeSlots.has(idx);
                const isActionMarkerCell =
                  resolvedStopMarkerSlotIndex !== undefined && idx === resolvedStopMarkerSlotIndex;
                return (
                  <td
                    key={`time-marker-${hour}`}
                    className={`${styles.timeMarker} ${isPastFirstStageCutoff ? styles.lockedEntryCell : ''}`}>
                    {isActionMarkerCell && stopTime
                      ? stopTime
                      : getTimeCellValue(baseTime, stepIndex, isPastStop || shouldHideUnpopulatedFirstStageTime, idx)}
                  </td>
                );
              })}
              <td className={styles.gapCell} />
              {secondStageHours.map((hour, idx) => {
                const secondStageBaseTime = secondStageStartTime ?? baseTime;
                const stepIndex = secondStageStartTime ? idx : activeFirstStageHours.length + idx;
                const absoluteIndex = activeFirstStageHours.length + idx;
                const isPastStop = stopSlotIndex !== undefined && absoluteIndex > stopSlotIndex;
                const isActionMarkerCell =
                  resolvedStopMarkerSlotIndex !== undefined && absoluteIndex === resolvedStopMarkerSlotIndex;
                return (
                  <td key={`time-marker-second-${hour}`} className={styles.timeMarker}>
                    {isActionMarkerCell && stopTime
                      ? stopTime
                      : getTimeCellValue(secondStageBaseTime, stepIndex, isPastStop, absoluteIndex)}
                  </td>
                );
              })}
            </tr>

            <tr>
              <td className={styles.headerLeadCell}>{t('hours', 'Hours')}</td>
              {activeFirstStageHours.map((hour, idx) => (
                <td
                  key={`active-hour-${hour}`}
                  className={`${styles.hourCell} ${
                    stopSlotIndex === undefined &&
                    firstStageCutoffSlotIndex !== undefined &&
                    idx > firstStageCutoffSlotIndex
                      ? styles.lockedEntryCell
                      : ''
                  }`}>
                  {hour}
                </td>
              ))}
              <td className={styles.gapCell} />
              {secondStageHours.map((hour) => (
                <td key={`second-hour-${hour}`} className={styles.hourCell}>
                  {hour}
                </td>
              ))}
            </tr>

            <tr>
              <td className={`${styles.headerLeadCell} ${styles.alertCell}`}>{t('alert', 'ALERT')}</td>
              <td className={styles.stageLabel} colSpan={12}>
                <div className={styles.stageBand}>
                  <span className={styles.stageArrowLeft} />
                  <span className={styles.stageBandText}>{t('activeFirstStage', 'ACTIVE FIRST STAGE')}</span>
                  <span className={styles.stageArrowRight} />
                </div>
              </td>
              <td className={styles.gapCell} />
              <td className={styles.stageLabel} colSpan={3}>
                <div className={styles.stageBand}>
                  <span className={styles.stageArrowLeft} />
                  <span className={styles.stageBandText}>{t('secondStage', 'SECOND STAGE')}</span>
                  <span className={styles.stageArrowRight} />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LabourCareGuideHeader;
