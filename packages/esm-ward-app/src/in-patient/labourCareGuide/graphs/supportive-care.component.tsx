import React, { useState } from 'react';
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
import type { SupportiveCareEntry } from '../resources/supportive-care.resource';
import { getSlotState, getStageAwareSlotIndexForTime, type LcgSlotState } from '../time-slot-utils';
import { getSupportiveAlertGuidance, isSupportiveAlertValue, type SupportiveAlertKey } from '../alert-rules';
import { SectionToolbar } from '../components/section-toolbar.component';

interface SupportiveCareProps {
  activeFirstStageHours: number[];
  secondStageHours: number[];
  onAddClick?: () => void;
  showViewToggle?: boolean;
  baseTime?: string;
  entries?: SupportiveCareEntry[];
  firstStageCutoffSlotIndex?: number;
  secondStageStartTime?: string;
  isAddButtonDisabled?: boolean;
  stopSlotIndex?: number;
  stopMarkerSlotIndex?: number;
  stopLabel?: string;
}

const supportiveCareRows = [
  { parameter: 'Companion', alert: 'N', key: 'companion' },
  { parameter: 'Pain relief', alert: 'N', key: 'painRelief' },
  { parameter: 'Oral fluid', alert: 'N', key: 'oralFluid' },
  { parameter: 'Posture', alert: 'SP', key: 'posture' },
];

const SupportiveCare: React.FC<SupportiveCareProps> = ({
  activeFirstStageHours,
  secondStageHours,
  onAddClick,
  showViewToggle = true,
  baseTime,
  entries = [],
  firstStageCutoffSlotIndex,
  secondStageStartTime,
  isAddButtonDisabled = false,
  stopSlotIndex,
  stopMarkerSlotIndex,
  stopLabel,
}) => {
  const { t } = useTranslation();
  const resolvedStopMarkerSlotIndex =
    stopMarkerSlotIndex ??
    (stopSlotIndex !== undefined
      ? Math.min(stopSlotIndex + 1, activeFirstStageHours.length + secondStageHours.length - 1)
      : undefined);
  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [now, setNow] = useState(() => new Date());

  const graphEntries = React.useMemo(() => entries.filter((entry) => !entry.isEmergency), [entries]);
  const showEmergencyReasonColumn = React.useMemo(() => entries.some((entry) => entry.isEmergency), [entries]);

  React.useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(intervalId);
  }, []);

  const getFullLabel = (value: string) => {
    const map: Record<string, string> = {
      Y: t('yes', 'Yes'),
      N: t('no', 'No'),
      D: t('declined', 'Declined'),
      SP: t('supine', 'Supine'),
      MO: t('mobile', 'Mobile'),
      YES: t('yes', 'Yes'),
      NO: t('no', 'No'),
      DECLINED: t('declined', 'Declined'),
      SUPINE: t('supine', 'Supine'),
      MOBILE: t('mobile', 'Mobile'),
    };
    const upperVal = value?.toUpperCase();
    return map[upperVal] || value;
  };

  const tableRows = entries
    .map((entry) => {
      const emergencyReason = entry.emergencyReason?.trim();
      const dateObj = new Date(entry.encounterDatetime);
      return {
        id: entry.id,
        date: dateObj.toLocaleDateString('en-GB'),
        time: dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        lcgTime: entry.time,
        companion: getFullLabel(entry.companion),
        painRelief: getFullLabel(entry.painRelief),
        oralFluid: getFullLabel(entry.oralFluid),
        posture: getFullLabel(entry.posture),
        reason: entry.isEmergency
          ? emergencyReason
            ? t('emergencyReasonLabel', 'Emergency: {{reason}}', { reason: emergencyReason })
            : t('emergencyEntry', 'Emergency entry')
          : '',
        isEmergency: Boolean(entry.isEmergency),
      };
    })
    .reverse();

  const emergencyRowIds = React.useMemo(
    () => new Set(tableRows.filter((r) => r.isEmergency).map((r) => r.id)),
    [tableRows],
  );

  const tableHeaders = [
    { key: 'date', header: t('date', 'Date') },
    { key: 'time', header: t('timeSaved', 'Time') },
    { key: 'lcgTime', header: t('lcgTime', 'LCG Time') },
    { key: 'companion', header: t('companionship', 'Companionship') },
    { key: 'painRelief', header: t('painRelief', 'Pain Relief') },
    { key: 'oralFluid', header: t('oralFluid', 'Oral Fluid') },
    { key: 'posture', header: t('posture', 'Posture') },
    ...(showEmergencyReasonColumn ? [{ key: 'reason', header: t('reason', 'Reason') }] : []),
  ];

  const slotEntries = React.useMemo(() => {
    const mapped = new Map<number, SupportiveCareEntry>();
    if (!baseTime) return mapped;
    const sorted = [...graphEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );
    sorted.forEach((entry) => {
      const idx = getStageAwareSlotIndexForTime(
        baseTime,
        entry.time,
        activeFirstStageHours.length,
        secondStageHours.length,
        secondStageStartTime,
        firstStageCutoffSlotIndex,
      );
      if (idx !== null) mapped.set(idx, entry);
    });
    return mapped;
  }, [
    baseTime,
    graphEntries,
    activeFirstStageHours.length,
    secondStageHours.length,
    secondStageStartTime,
    firstStageCutoffSlotIndex,
  ]);

  const resolveSlotDisplayState = (
    slotIndex: number,
    baseState: LcgSlotState | null,
    isLockedByStageTransition: boolean,
  ): LcgSlotState | null => {
    if (stopSlotIndex !== undefined && slotIndex > stopSlotIndex) {
      return 'locked';
    }

    if (isLockedByStageTransition) {
      return 'locked';
    }

    if (stopSlotIndex !== undefined && baseState === 'active') {
      return 'locked';
    }

    return baseState;
  };

  const getCellClassName = (slotState: LcgSlotState | null) => {
    const classes = [styles.entryCell];
    if (slotState === 'locked') classes.push(styles.lockedEntryCell);
    if (slotState === 'active') classes.push(styles.activeEntryCell);
    return classes.join(' ');
  };

  const renderEntryValue = (rowKey: SupportiveAlertKey, value: string, guidanceText?: string) => {
    if (!value) return '';
    return isSupportiveAlertValue(rowKey, value) ? (
      <span className={styles.alertCircle} title={guidanceText}>
        {value}
      </span>
    ) : (
      value
    );
  };

  return (
    <div className={styles.sectionBlock}>
      <div className={styles.sectionHeaderControls}>
        <SectionToolbar
          showViewToggle={showViewToggle}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAddClick={onAddClick}
          isAddButtonDisabled={isAddButtonDisabled}
        />
      </div>

      {viewMode === 'graph' ? (
        <table className={styles.gridTable}>
          <tbody>
            {supportiveCareRows.map((row, rowIndex) => (
              <tr key={row.parameter}>
                {rowIndex === 0 && (
                  <td className={styles.verticalLabel} rowSpan={supportiveCareRows.length}>
                    {t('supportiveCare', 'SUPPORTIVE CARE')}
                  </td>
                )}
                <td className={styles.parameterCell}>{t(row.parameter, row.parameter)}</td>
                <td className={styles.alertValueCell}>{row.alert}</td>

                {activeFirstStageHours.map((_, idx) => {
                  const markerSlotIndex = resolvedStopMarkerSlotIndex;
                  const markerIsInFirstStage =
                    markerSlotIndex !== undefined && markerSlotIndex < activeFirstStageHours.length;
                  const isFirstStageMarkerCell = markerIsInFirstStage && markerSlotIndex === idx;
                  const isPostStop = stopSlotIndex !== undefined && idx > stopSlotIndex;
                  const isPreStop = stopSlotIndex !== undefined && idx < stopSlotIndex;
                  const isLockedByStageTransition =
                    firstStageCutoffSlotIndex !== undefined && idx > firstStageCutoffSlotIndex;
                  const hasData = slotEntries.has(idx);
                  let baseState: LcgSlotState | null = null;
                  if (hasData) {
                    baseState = 'locked';
                  } else if (baseTime) {
                    const slotState = getSlotState(baseTime, idx, now);
                    baseState = slotState === 'locked' ? 'locked' : slotState;
                  }
                  const state = resolveSlotDisplayState(
                    idx,
                    isPreStop && baseState === 'active' ? 'locked' : baseState,
                    isLockedByStageTransition,
                  );
                  const stopMarker =
                    rowIndex === 0 && stopLabel && markerSlotIndex !== undefined && idx === markerSlotIndex
                      ? stopLabel
                      : '';
                  const cellValue = slotEntries.get(idx)?.[row.key as keyof SupportiveCareEntry] as string | undefined;

                  if (isFirstStageMarkerCell && rowIndex > 0) {
                    return null;
                  }

                  if (isFirstStageMarkerCell && rowIndex === 0 && stopMarker) {
                    return (
                      <td
                        key={`f-marker-${idx}`}
                        rowSpan={supportiveCareRows.length}
                        className={`${getCellClassName(state)} ${styles.workflowStopMarkerCell}`}>
                        <span className={styles.workflowStopLabel}>{stopMarker}</span>
                      </td>
                    );
                  }

                  return (
                    <td key={`f-${idx}`} className={getCellClassName(state)}>
                      {cellValue
                        ? renderEntryValue(
                            row.key as SupportiveAlertKey,
                            cellValue,
                            getSupportiveAlertGuidance(t, row.key as SupportiveAlertKey),
                          )
                        : ''}
                    </td>
                  );
                })}
                <td className={styles.gapCell} />
                {secondStageHours.map((_, idx) => {
                  const sIdx = activeFirstStageHours.length + idx;
                  const markerSlotIndex = resolvedStopMarkerSlotIndex;
                  const markerIsInSecondStage =
                    markerSlotIndex !== undefined && markerSlotIndex >= activeFirstStageHours.length;
                  const isSecondStageMarkerCell = markerIsInSecondStage && markerSlotIndex === sIdx;
                  const isPostStop = stopSlotIndex !== undefined && sIdx > stopSlotIndex;
                  const isPreStop = stopSlotIndex !== undefined && sIdx < stopSlotIndex;
                  const hasData = slotEntries.has(sIdx);
                  let baseState: LcgSlotState | null = null;
                  if (hasData) {
                    baseState = 'locked';
                  } else if (secondStageStartTime) {
                    const slotState = getSlotState(secondStageStartTime!, idx, now);
                    baseState = slotState === 'locked' ? 'locked' : slotState;
                  } else if (baseTime) {
                    const slotState = getSlotState(baseTime, sIdx, now);
                    baseState = slotState === 'locked' ? 'locked' : slotState;
                  }
                  const state = resolveSlotDisplayState(
                    sIdx,
                    isPreStop && baseState === 'active' ? 'locked' : baseState,
                    false,
                  );
                  const stopMarker =
                    rowIndex === 0 && stopLabel && markerSlotIndex !== undefined && sIdx === markerSlotIndex
                      ? stopLabel
                      : '';
                  const cellValue = slotEntries.get(sIdx)?.[row.key as keyof SupportiveCareEntry] as string | undefined;

                  if (isSecondStageMarkerCell && rowIndex > 0) {
                    return null;
                  }

                  if (isSecondStageMarkerCell && rowIndex === 0 && stopMarker) {
                    return (
                      <td
                        key={`s-marker-${idx}`}
                        rowSpan={supportiveCareRows.length}
                        className={`${getCellClassName(state)} ${styles.workflowStopMarkerCell}`}>
                        <span className={styles.workflowStopLabel}>{stopMarker}</span>
                      </td>
                    );
                  }

                  return (
                    <td key={`s-${idx}`} className={getCellClassName(state)}>
                      {cellValue
                        ? renderEntryValue(
                            row.key as SupportiveAlertKey,
                            cellValue,
                            getSupportiveAlertGuidance(t, row.key as SupportiveAlertKey),
                          )
                        : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={styles.tableContainer}>
          <DataTable
            rows={tableRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
            headers={tableHeaders}>
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <TableContainer>
                <Table {...getTableProps()} size="sm">
                  <TableHead>
                    <TableRow>
                      {headers.map((h) => (
                        <TableHeader {...getHeaderProps({ header: h })} key={h.key}>
                          {h.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        {...getRowProps({ row: r })}
                        key={r.id}
                        className={emergencyRowIds.has(r.id) ? styles.emergencyRow : undefined}>
                        {r.cells.map((c) => (
                          <TableCell key={c.id}>{c.value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
          <Pagination
            totalItems={tableRows.length}
            pageSize={pageSize}
            page={currentPage}
            onChange={({ page, pageSize }) => {
              setCurrentPage(page);
              setPageSize(pageSize);
            }}
            pageSizes={[5, 10, 25]}
          />
        </div>
      )}
    </div>
  );
};

export default SupportiveCare;
