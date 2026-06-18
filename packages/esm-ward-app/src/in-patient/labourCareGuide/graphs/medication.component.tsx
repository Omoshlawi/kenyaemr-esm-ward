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
import type { MedicationEntry } from '../resources/medication.resource';
import { expandMedicationEntryToTableRows } from '../resources/medication.resource';
import { getPointSlotState, getStageAwarePointSlotIndexForTime, type LcgSlotState } from '../time-slot-utils';
import {
  LCG_MEDICATION_OXYTOCIN_INTERVAL_MINUTES,
  LCG_TIME_INCREMENT_MINUTES,
  MEDICATION_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  MEDICATION_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
} from '../types';
import { SectionToolbar } from '../components/section-toolbar.component';

interface MedicationProps {
  activeFirstStageHours: number[];
  secondStageHours: number[];
  onAddClick?: () => void;
  showViewToggle?: boolean;
  baseTime?: string;
  entries?: MedicationEntry[];
  firstStageCutoffSlotIndex?: number;
  secondStageStartTime?: string;
  stopSlotIndex?: number;
}

const medicationRows = [
  { parameter: 'Medicine', rowKey: 'medicine' as const },
  { parameter: 'IV fluids', rowKey: 'ivFluids' as const },
];

type MedicationSlotEntries = {
  first?: MedicationEntry;
  second?: MedicationEntry;
};

type MedicationRowKey = 'oxytocinUL' | 'oxytocinDrops' | 'medicine' | 'ivFluids';

const MEDICATION_HALF_SLOT_OPTIONS = [
  {
    slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
    offsetMinutes: 0,
    earlyAllowanceMinutes: MEDICATION_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
    lateAllowanceMinutes: MEDICATION_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
  },
  {
    slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
    offsetMinutes: LCG_MEDICATION_OXYTOCIN_INTERVAL_MINUTES,
    earlyAllowanceMinutes: MEDICATION_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
    lateAllowanceMinutes: MEDICATION_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
  },
] as const;

const MEDICATION_HALF_SLOT_DISPLAY_OPTIONS = [
  {
    slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
    offsetMinutes: 0,
    earlyAllowanceMinutes: MEDICATION_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
    lateAllowanceMinutes: Math.max(
      MEDICATION_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
      LCG_MEDICATION_OXYTOCIN_INTERVAL_MINUTES - 1,
    ),
  },
  {
    slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
    offsetMinutes: LCG_MEDICATION_OXYTOCIN_INTERVAL_MINUTES,
    earlyAllowanceMinutes: MEDICATION_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
    lateAllowanceMinutes: Math.max(
      MEDICATION_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
      LCG_MEDICATION_OXYTOCIN_INTERVAL_MINUTES - 1,
    ),
  },
] as const;

const Medication: React.FC<MedicationProps> = ({
  activeFirstStageHours,
  secondStageHours,
  onAddClick,
  showViewToggle = true,
  baseTime,
  entries = [],
  firstStageCutoffSlotIndex,
  secondStageStartTime,
  stopSlotIndex,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');
  const [now, setNow] = React.useState(() => new Date());

  const graphEntries = React.useMemo(() => entries.filter((entry) => !entry.isEmergency), [entries]);
  const showEmergencyReasonColumn = React.useMemo(() => entries.some((entry) => entry.isEmergency), [entries]);

  // Pagination State
  const [firstRowIndex, setFirstRowIndex] = useState(0);
  const [currentPageSize, setCurrentPageSize] = useState(10);

  React.useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(intervalId);
  }, []);

  const slotEntries = React.useMemo(() => {
    const mappedEntries = new Map<number, MedicationSlotEntries>();
    if (!baseTime) return mappedEntries;

    const orderedEntries = [...graphEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );

    orderedEntries.forEach((entry) => {
      const strictSegmentIndex = MEDICATION_HALF_SLOT_OPTIONS.findIndex(
        (option) =>
          getStageAwarePointSlotIndexForTime(
            baseTime,
            entry.time,
            activeFirstStageHours.length,
            secondStageHours.length,
            secondStageStartTime,
            option,
            firstStageCutoffSlotIndex,
          ) !== null,
      );

      const segmentIndex =
        strictSegmentIndex !== -1
          ? strictSegmentIndex
          : MEDICATION_HALF_SLOT_DISPLAY_OPTIONS.findIndex(
              (option) =>
                getStageAwarePointSlotIndexForTime(
                  baseTime,
                  entry.time,
                  activeFirstStageHours.length,
                  secondStageHours.length,
                  secondStageStartTime,
                  option,
                  firstStageCutoffSlotIndex,
                ) !== null,
            );

      if (segmentIndex === -1) {
        return;
      }

      const slotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        entry.time,
        activeFirstStageHours.length,
        secondStageHours.length,
        secondStageStartTime,
        strictSegmentIndex !== -1
          ? MEDICATION_HALF_SLOT_OPTIONS[segmentIndex]
          : MEDICATION_HALF_SLOT_DISPLAY_OPTIONS[segmentIndex],
        firstStageCutoffSlotIndex,
      );

      if (slotIndex === null) {
        return;
      }

      const current = mappedEntries.get(slotIndex) ?? {};
      mappedEntries.set(slotIndex, {
        ...current,
        [segmentIndex === 0 ? 'first' : 'second']: entry,
      });
    });

    return mappedEntries;
  }, [
    baseTime,
    graphEntries,
    activeFirstStageHours.length,
    secondStageHours.length,
    secondStageStartTime,
    firstStageCutoffSlotIndex,
  ]);

  const getSegmentClassName = (slotState: LcgSlotState | null) => {
    if (slotState === 'locked') return `${styles.splitSegment} ${styles.lockedEntryCell}`;
    if (slotState === 'active') return `${styles.splitSegment} ${styles.activeEntryCell}`;
    return styles.splitSegment;
  };

  const getSegmentSlotState = (slotIndex: number, segmentIndex: number): LcgSlotState | null => {
    const isPostStop = stopSlotIndex !== undefined && slotIndex > stopSlotIndex;
    const isPreStop = stopSlotIndex !== undefined && slotIndex < stopSlotIndex;
    if (isPostStop) {
      return 'locked';
    }

    const options = MEDICATION_HALF_SLOT_OPTIONS[segmentIndex];
    const isSecondStage = slotIndex >= activeFirstStageHours.length;

    const rawState = isSecondStage
      ? secondStageStartTime
        ? getPointSlotState(secondStageStartTime, slotIndex - activeFirstStageHours.length, now, options)
        : baseTime
          ? getPointSlotState(baseTime, slotIndex, now, options)
          : null
      : baseTime
        ? getPointSlotState(baseTime, slotIndex, now, options)
        : null;

    if (!isSecondStage && firstStageCutoffSlotIndex !== undefined && slotIndex > firstStageCutoffSlotIndex) {
      return 'locked';
    }

    return isPreStop && rawState === 'active'
      ? 'locked'
      : stopSlotIndex !== undefined && rawState === 'active'
        ? 'locked'
        : rawState;
  };

  const getOxytocinUnitsValue = (entry?: MedicationEntry) => {
    if (!entry) return '';
    if (entry.oxytocinU_L !== undefined && entry.oxytocinU_L !== null) return entry.oxytocinU_L;
    return entry.oxytocin === 'N' ? 'N' : '';
  };

  const getOxytocinDropsValue = (entry?: MedicationEntry) => {
    if (!entry) return '';
    if (entry.oxytocinDrops !== undefined && entry.oxytocinDrops !== null) return entry.oxytocinDrops;
    return entry.oxytocin === 'N' ? 'N' : '';
  };

  const getRowValue = (entry: MedicationEntry | undefined, rowKey: MedicationRowKey) => {
    if (!entry) {
      return '';
    }

    if (rowKey === 'oxytocinUL') {
      return getOxytocinUnitsValue(entry);
    }

    if (rowKey === 'oxytocinDrops') {
      return getOxytocinDropsValue(entry);
    }

    if (rowKey === 'medicine') {
      return entry.medicine ?? '';
    }

    return (entry as any)[rowKey] ?? '';
  };

  const renderSplitEntryCell = (slotIndex: number, rowKey: MedicationRowKey, key: string) => {
    const slotEntry = slotEntries.get(slotIndex);

    return (
      <td key={key} className={styles.entryCell}>
        <div className={styles.splitCellTwo}>
          <span className={getSegmentClassName(getSegmentSlotState(slotIndex, 0))}>
            {getRowValue(slotEntry?.first, rowKey)}
          </span>
          <span className={getSegmentClassName(getSegmentSlotState(slotIndex, 1))}>
            {getRowValue(slotEntry?.second, rowKey)}
          </span>
        </div>
      </td>
    );
  };

  // Table Data Mapping
  const headers = [
    { key: 'date', header: t('date', 'Date') },
    { key: 'timeSaved', header: t('timeSaved', 'Time') },
    { key: 'lcgTime', header: t('lcgTime', 'LCG Time') },
    { key: 'oxytocinUL', header: t('oxytocinUL', 'Oxytocin (U/L)') },
    { key: 'oxytocinDrops', header: t('oxytocinDrops', 'Drops/min') },
    { key: 'drug', header: t('drug', 'Drug') },
    { key: 'dosage', header: t('dosage', 'Dosage') },
    { key: 'route', header: t('route', 'Route') },
    { key: 'ivFluidType', header: t('ivFluidType', 'IV Fluid Type') },
    ...(showEmergencyReasonColumn ? [{ key: 'reason', header: t('reason', 'Reason') }] : []),
  ];

  const tableRows = entries
    .flatMap((entry) =>
      expandMedicationEntryToTableRows(entry, {
        formatDate: (encounterDatetime) => new Date(encounterDatetime).toLocaleDateString(),
        formatTimeSaved: (encounterDatetime) =>
          new Date(encounterDatetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        formatEmergencyReason: (reason) => t('emergencyReasonLabel', 'Emergency: {{reason}}', { reason: reason ?? '' }),
      }),
    )
    .reverse();

  const emergencyRowIds = React.useMemo(
    () => new Set(tableRows.filter((r) => r.isEmergency).map((r) => r.id)),
    [tableRows],
  );

  return (
    <div className={styles.sectionBlock}>
      <div className={styles.sectionHeaderControls}>
        <SectionToolbar
          showViewToggle={showViewToggle}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAddClick={onAddClick}
        />
      </div>

      {viewMode === 'graph' ? (
        <table className={styles.gridTable}>
          <tbody>
            <tr>
              <td className={styles.verticalLabel} rowSpan={medicationRows.length + 2}>
                {t('medication', 'MEDICATION')}
              </td>
              <td className={styles.parameterCell} rowSpan={2}>
                {t('oxytocin', 'Oxytocin')}
              </td>
              <td className={styles.alertValueCell}>{t('uL', 'U/L')}</td>
              {activeFirstStageHours.map((_, idx) => renderSplitEntryCell(idx, 'oxytocinUL', `oxy-ul-first-${idx}`))}
              <td className={styles.gapCell} />
              {secondStageHours.map((_, idx) =>
                renderSplitEntryCell(activeFirstStageHours.length + idx, 'oxytocinUL', `oxy-ul-second-${idx}`),
              )}
            </tr>

            <tr>
              <td className={styles.alertValueCell}>{t('dropsPerMin', 'Drops/min')}</td>
              {activeFirstStageHours.map((_, idx) =>
                renderSplitEntryCell(idx, 'oxytocinDrops', `oxy-drops-first-${idx}`),
              )}
              <td className={styles.gapCell} />
              {secondStageHours.map((_, idx) =>
                renderSplitEntryCell(activeFirstStageHours.length + idx, 'oxytocinDrops', `oxy-drops-second-${idx}`),
              )}
            </tr>

            {medicationRows.map((row) => (
              <tr key={row.rowKey}>
                <td className={styles.parameterWideCell} colSpan={2}>
                  {t(row.parameter, row.parameter)}
                </td>
                {activeFirstStageHours.map((_, idx) =>
                  renderSplitEntryCell(idx, row.rowKey, `${row.rowKey}-first-${idx}`),
                )}
                <td className={styles.gapCell} />
                {secondStageHours.map((_, idx) =>
                  renderSplitEntryCell(activeFirstStageHours.length + idx, row.rowKey, `${row.rowKey}-second-${idx}`),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={styles.tableContainer}>
          <DataTable rows={tableRows.slice(firstRowIndex, firstRowIndex + currentPageSize)} headers={headers}>
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

export default Medication;
