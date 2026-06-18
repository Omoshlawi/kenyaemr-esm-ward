import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import styles from '../labour-care-guide.scss';
import type { SharedDecisionMakingEntry } from '../resources/shared-decision-making.resource';
import {
  isSharedDecisionCriticalActionDisplayLabel,
  resolveSharedDecisionActionDisplayLabel,
  truncateSharedDecisionGridText,
} from '../labour-care-guide.utils';
import {
  formatHHMM,
  getPointSlotState,
  getStageAwarePointSlotIndexForTime,
  SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS,
  SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
  type LcgSlotState,
} from '../time-slot-utils';
import { SectionToolbar } from '../components/section-toolbar.component';
import LcgCorrectionAuditBanner from '../components/lcg-correction-audit-banner.component';
import {
  buildCorrectionAuditTableRow,
  formatCorrectionAuditSubtitle,
  resolveCorrectionAuditSlotTime,
  type LcgCorrectionAuditRecord,
} from '../resources/lcg-session-correction.resource';

interface SharedDecisionMakingProps {
  activeFirstStageHours: number[];
  secondStageHours: number[];
  onAddClick?: () => void;
  showViewToggle?: boolean;
  firstStageCutoffSlotIndex?: number;
  baseTime?: string;
  entries?: SharedDecisionMakingEntry[];
  secondStageStartTime?: string;
  stopSlotIndex?: number;
  correctionAuditDisplay?: LcgCorrectionAuditRecord | null;
}

const SharedDecisionMaking: React.FC<SharedDecisionMakingProps> = ({
  activeFirstStageHours,
  secondStageHours,
  onAddClick,
  showViewToggle = true,
  firstStageCutoffSlotIndex,
  baseTime,
  entries = [],
  secondStageStartTime,
  stopSlotIndex,
  correctionAuditDisplay = null,
}) => {
  const { t } = useTranslation();
  const [isTableView, setIsTableView] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  const [firstRowIndex, setFirstRowIndex] = React.useState(0);
  const [currentPageSize, setCurrentPageSize] = React.useState(10);
  const totalSlots = activeFirstStageHours.length + secondStageHours.length;
  const graphEntries = React.useMemo(() => entries.filter((entry) => !entry.isEmergency), [entries]);
  const showEmergencyReasonColumn = React.useMemo(() => entries.some((entry) => entry.isEmergency), [entries]);

  React.useEffect(() => {
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      setNow(new Date());
      intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    }, msUntilNextMinute);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const getEntryTime = React.useCallback(
    (entry: SharedDecisionMakingEntry) => entry.time ?? formatHHMM(new Date(entry.encounterDatetime)),
    [],
  );

  const assessmentSlotEntries = React.useMemo(() => {
    const map = new Map<number, { secondary?: SharedDecisionMakingEntry }>();
    if (!baseTime) return map;
    const sorted = [...graphEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );
    for (const entry of sorted) {
      const time = getEntryTime(entry);
      const secondarySlotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        time,
        activeFirstStageHours.length,
        secondStageHours.length,
        secondStageStartTime,
        SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS,
        firstStageCutoffSlotIndex,
      );
      if (secondarySlotIndex !== null) {
        const existingGroup = map.get(secondarySlotIndex) ?? {};
        existingGroup.secondary = entry;
        map.set(secondarySlotIndex, existingGroup);
      }
    }
    return map;
  }, [
    activeFirstStageHours.length,
    baseTime,
    getEntryTime,
    graphEntries,
    secondStageHours.length,
    secondStageStartTime,
    firstStageCutoffSlotIndex,
  ]);

  const planSlotEntries = React.useMemo(() => {
    const map = new Map<number, SharedDecisionMakingEntry>();
    if (!baseTime) return map;
    const sorted = [...graphEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );
    for (const entry of sorted) {
      const slotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        getEntryTime(entry),
        activeFirstStageHours.length,
        secondStageHours.length,
        secondStageStartTime,
        SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
        firstStageCutoffSlotIndex,
      );
      if (slotIndex !== null) {
        map.set(slotIndex, entry);
      }
    }
    return map;
  }, [
    activeFirstStageHours.length,
    baseTime,
    getEntryTime,
    graphEntries,
    secondStageHours.length,
    secondStageStartTime,
    firstStageCutoffSlotIndex,
  ]);

  const actionSlotEntries = React.useMemo(() => {
    const map = new Map<number, SharedDecisionMakingEntry>();
    if (!baseTime) return map;
    const sorted = [...graphEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );
    for (const entry of sorted) {
      const slotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        getEntryTime(entry),
        activeFirstStageHours.length,
        secondStageHours.length,
        secondStageStartTime,
        SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
        firstStageCutoffSlotIndex,
      );
      if (slotIndex !== null) {
        map.set(slotIndex, entry);
      }
    }
    return map;
  }, [
    activeFirstStageHours.length,
    baseTime,
    getEntryTime,
    graphEntries,
    secondStageHours.length,
    secondStageStartTime,
    firstStageCutoffSlotIndex,
  ]);

  const correctionAuditSlotIndex = React.useMemo(() => {
    if (!correctionAuditDisplay || !baseTime) {
      return null;
    }

    const terminatedAt = correctionAuditDisplay.terminatedAt || correctionAuditDisplay.encounterDatetime;
    if (!terminatedAt) {
      return null;
    }

    const slotTime = resolveCorrectionAuditSlotTime(terminatedAt);
    if (!slotTime) {
      return null;
    }

    return getStageAwarePointSlotIndexForTime(
      baseTime,
      slotTime,
      activeFirstStageHours.length,
      secondStageHours.length,
      secondStageStartTime,
      SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
      firstStageCutoffSlotIndex,
    );
  }, [
    activeFirstStageHours.length,
    baseTime,
    correctionAuditDisplay,
    firstStageCutoffSlotIndex,
    secondStageHours.length,
    secondStageStartTime,
  ]);

  const renderCorrectionAuditCellContent = () => {
    if (!correctionAuditDisplay) {
      return null;
    }

    const subtitle = formatCorrectionAuditSubtitle(correctionAuditDisplay);
    const { display, isTruncated } = truncateSharedDecisionGridText(subtitle);

    return (
      <div className={styles.sharedDecisionAuditGridCell}>
        <span className={styles.sharedDecisionAuditActionText}>
          {t('lcgAuditSdmTitle', 'Shared Decision Making — transferred session audit')}
        </span>
        <span
          className={`${styles.cellText} ${styles.sharedDecisionGridText}`}
          title={isTruncated ? subtitle : undefined}>
          {display}
        </span>
      </div>
    );
  };

  const renderActionLabel = (actionLabel: string) => {
    if (!actionLabel) {
      return null;
    }

    const className = isSharedDecisionCriticalActionDisplayLabel(actionLabel)
      ? `${styles.cellText} ${styles.sharedDecisionCriticalActionText}`
      : styles.cellText;

    return <span className={className}>{actionLabel}</span>;
  };

  const renderGridLongText = (text?: string) => {
    const fullText = String(text ?? '').trim();
    if (!fullText) {
      return null;
    }

    const { display, isTruncated } = truncateSharedDecisionGridText(fullText);

    return (
      <span
        className={`${styles.cellText} ${styles.sharedDecisionGridText}`}
        title={isTruncated ? fullText : undefined}>
        {display}
      </span>
    );
  };

  const getCellClassName = (
    slotState: LcgSlotState | null,
    isFirstStageLocked: boolean,
    isTall = true,
    hasEntry = false,
  ) => {
    const classNames = [styles.entryCell, isTall ? styles.sharedDecisionTallCell : styles.sharedDecisionShortCell];

    if (isFirstStageLocked || slotState === 'locked' || hasEntry) {
      classNames.push(styles.lockedEntryCell);
    } else if (slotState === 'active') {
      classNames.push(styles.activeEntryCell);
    }

    return classNames.join(' ');
  };

  const tableHeaders = React.useMemo(
    () => [
      { key: 'time', header: t('time', 'Time') },
      { key: 'assessment', header: t('assessment', 'Assessment') },
      { key: 'plan', header: t('plan', 'Plan') },
      { key: 'action', header: t('action', 'Action') },
      ...(showEmergencyReasonColumn ? [{ key: 'reason', header: t('reason', 'Reason') }] : []),
    ],
    [showEmergencyReasonColumn, t],
  );

  const tableRows = React.useMemo(() => {
    const entryRows = entries.map((entry) => {
      const emergencyReason = entry.emergencyReason?.trim();
      const actionLabel = entry.action ? resolveSharedDecisionActionDisplayLabel(entry.action) : '-';
      return {
        id: entry.id,
        time: formatHHMM(new Date(entry.encounterDatetime)),
        assessment: entry.assessment || '-',
        plan: entry.plan || '-',
        action: actionLabel,
        isCriticalAction: isSharedDecisionCriticalActionDisplayLabel(actionLabel),
        isAuditRow: false,
        reason: entry.isEmergency
          ? emergencyReason
            ? t('emergencyReasonLabel', 'Emergency: {{reason}}', { reason: emergencyReason })
            : t('emergencyEntry', 'Emergency entry')
          : '',
        isEmergency: Boolean(entry.isEmergency),
      };
    });

    if (!correctionAuditDisplay) {
      return entryRows;
    }

    const auditRow = buildCorrectionAuditTableRow(correctionAuditDisplay, t);

    return [
      {
        id: 'lcg-session-correction-audit',
        time: auditRow.time || '-',
        assessment: auditRow.assessment || '-',
        plan: auditRow.plan || '-',
        action: auditRow.action,
        isCriticalAction: false,
        isAuditRow: true,
        reason: '',
        isEmergency: false,
      },
      ...entryRows,
    ];
  }, [correctionAuditDisplay, entries, t]);

  const emergencyRowIds = React.useMemo(
    () => new Set(tableRows.filter((r) => r.isEmergency).map((r) => r.id)),
    [tableRows],
  );

  const criticalActionRowIds = React.useMemo(
    () => new Set(tableRows.filter((r) => r.isCriticalAction).map((r) => r.id)),
    [tableRows],
  );

  return (
    <div className={styles.sectionBlock}>
      <LcgCorrectionAuditBanner auditRecord={correctionAuditDisplay} variant="sdm" />
      <div className={styles.sectionHeaderControls}>
        <SectionToolbar
          showViewToggle={showViewToggle}
          viewMode={isTableView ? 'table' : 'graph'}
          onViewModeChange={(mode) => setIsTableView(mode === 'table')}
          onAddClick={onAddClick}
        />
      </div>

      {!isTableView && (
        <table className={styles.gridTable}>
          <tbody>
            {/* ASSESSMENT row — uses hourly and half-grid timing, like the BABY upper row */}
            <tr>
              <td className={styles.verticalLabel} rowSpan={3}>
                {t('sharedDecisionMaking', 'SHARED DECISION-MAKING')}
              </td>
              <td className={styles.parameterWideCell} colSpan={2}>
                {t('assessment', 'ASSESSMENT')}
              </td>

              {activeFirstStageHours.map((hour, idx) => {
                const isFirstStageLocked = firstStageCutoffSlotIndex !== undefined && idx > firstStageCutoffSlotIndex;
                const isPostStop = Boolean(stopSlotIndex !== undefined && idx > stopSlotIndex);
                const isPreStop = Boolean(stopSlotIndex !== undefined && idx < stopSlotIndex);
                const rawSecondaryState = baseTime
                  ? getPointSlotState(baseTime, idx, now, SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS)
                  : null;
                const secondarySlotState = isPostStop
                  ? 'locked'
                  : isPreStop && rawSecondaryState === 'active'
                    ? 'locked'
                    : stopSlotIndex !== undefined && rawSecondaryState === 'active'
                      ? 'locked'
                      : rawSecondaryState;
                const entryGroup = assessmentSlotEntries.get(idx);
                const hasAssessmentEntry = Boolean(entryGroup?.secondary?.assessment);
                return (
                  <td
                    key={`sdm-assessment-active-${hour}`}
                    className={getCellClassName(secondarySlotState, isFirstStageLocked, true, hasAssessmentEntry)}>
                    {entryGroup?.secondary?.assessment ? renderGridLongText(entryGroup.secondary.assessment) : null}
                  </td>
                );
              })}

              <td className={styles.gapCell} />

              {secondStageHours.map((hour, idx) => {
                const slotIndex = activeFirstStageHours.length + idx;
                const isPostStop = Boolean(stopSlotIndex !== undefined && slotIndex > stopSlotIndex);
                const isPreStop = Boolean(stopSlotIndex !== undefined && slotIndex < stopSlotIndex);
                const rawSecondaryState = secondStageStartTime
                  ? getPointSlotState(secondStageStartTime, idx, now, SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS)
                  : null;
                const secondarySlotState = isPostStop
                  ? 'locked'
                  : isPreStop && rawSecondaryState === 'active'
                    ? 'locked'
                    : stopSlotIndex !== undefined && rawSecondaryState === 'active'
                      ? 'locked'
                      : rawSecondaryState;
                const entryGroup = assessmentSlotEntries.get(slotIndex);
                const hasAssessmentEntry = Boolean(entryGroup?.secondary?.assessment);
                return (
                  <td
                    key={`sdm-assessment-second-${hour}`}
                    className={getCellClassName(secondarySlotState, false, true, hasAssessmentEntry)}>
                    {entryGroup?.secondary?.assessment ? renderGridLongText(entryGroup.secondary.assessment) : null}
                  </td>
                );
              })}
            </tr>

            {/* PLAN row — uses base row slot timing (opens at full hour) */}
            <tr>
              <td className={styles.parameterWideCell} colSpan={2}>
                {t('plan', 'PLAN')}
              </td>

              {activeFirstStageHours.map((hour, idx) => {
                const isFirstStageLocked = firstStageCutoffSlotIndex !== undefined && idx > firstStageCutoffSlotIndex;
                const isPostStop = Boolean(stopSlotIndex !== undefined && idx > stopSlotIndex);
                const isPreStop = Boolean(stopSlotIndex !== undefined && idx < stopSlotIndex);
                const rawSlotState = baseTime
                  ? getPointSlotState(baseTime, idx, now, SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS)
                  : null;
                const slotState = isPostStop
                  ? 'locked'
                  : isPreStop && rawSlotState === 'active'
                    ? 'locked'
                    : stopSlotIndex !== undefined && rawSlotState === 'active'
                      ? 'locked'
                      : rawSlotState;
                const entry = planSlotEntries.get(idx);
                const hasPlanEntry = Boolean(entry?.plan);
                return (
                  <td
                    key={`sdm-plan-active-${hour}`}
                    className={getCellClassName(slotState, isFirstStageLocked, true, hasPlanEntry)}>
                    {entry?.plan ? renderGridLongText(entry.plan) : null}
                  </td>
                );
              })}

              <td className={styles.gapCell} />

              {secondStageHours.map((hour, idx) => {
                const slotIndex = activeFirstStageHours.length + idx;
                const isPostStop = Boolean(stopSlotIndex !== undefined && slotIndex > stopSlotIndex);
                const isPreStop = Boolean(stopSlotIndex !== undefined && slotIndex < stopSlotIndex);
                const rawSlotState = secondStageStartTime
                  ? getPointSlotState(secondStageStartTime, idx, now, SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS)
                  : null;
                const slotState = isPostStop
                  ? 'locked'
                  : isPreStop && rawSlotState === 'active'
                    ? 'locked'
                    : stopSlotIndex !== undefined && rawSlotState === 'active'
                      ? 'locked'
                      : rawSlotState;
                const entry = planSlotEntries.get(slotIndex);
                const hasPlanEntry = Boolean(entry?.plan);
                return (
                  <td
                    key={`sdm-plan-second-${hour}`}
                    className={getCellClassName(slotState, false, true, hasPlanEntry)}>
                    {entry?.plan ? renderGridLongText(entry.plan) : null}
                  </td>
                );
              })}
            </tr>

            <tr>
              <td className={styles.parameterWideCell} colSpan={2}>
                {t('action', 'ACTION')}
              </td>

              {activeFirstStageHours.map((hour, idx) => {
                const isFirstStageLocked = firstStageCutoffSlotIndex !== undefined && idx > firstStageCutoffSlotIndex;
                const isPostStop = Boolean(stopSlotIndex !== undefined && idx > stopSlotIndex);
                const isPreStop = Boolean(stopSlotIndex !== undefined && idx < stopSlotIndex);
                const rawSlotState = baseTime
                  ? getPointSlotState(baseTime, idx, now, SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS)
                  : null;
                const slotState = isPostStop
                  ? 'locked'
                  : isPreStop && rawSlotState === 'active'
                    ? 'locked'
                    : stopSlotIndex !== undefined && rawSlotState === 'active'
                      ? 'locked'
                      : rawSlotState;
                const entry = actionSlotEntries.get(idx);
                const actionLabel = entry?.action ? resolveSharedDecisionActionDisplayLabel(entry.action) : '';
                const isAuditSlot = correctionAuditSlotIndex === idx;
                const hasActionEntry = Boolean(actionLabel) || isAuditSlot;
                return (
                  <td
                    key={`sdm-action-active-${hour}`}
                    className={getCellClassName(slotState, isFirstStageLocked, true, hasActionEntry)}>
                    {isAuditSlot ? renderCorrectionAuditCellContent() : renderActionLabel(actionLabel)}
                  </td>
                );
              })}

              <td className={styles.gapCell} />

              {secondStageHours.map((hour, idx) => {
                const slotIndex = activeFirstStageHours.length + idx;
                const isPostStop = Boolean(stopSlotIndex !== undefined && slotIndex > stopSlotIndex);
                const isPreStop = Boolean(stopSlotIndex !== undefined && slotIndex < stopSlotIndex);
                const rawSlotState = secondStageStartTime
                  ? getPointSlotState(secondStageStartTime, idx, now, SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS)
                  : null;
                const slotState = isPostStop
                  ? 'locked'
                  : isPreStop && rawSlotState === 'active'
                    ? 'locked'
                    : stopSlotIndex !== undefined && rawSlotState === 'active'
                      ? 'locked'
                      : rawSlotState;
                const entry = actionSlotEntries.get(slotIndex);
                const actionLabel = entry?.action ? resolveSharedDecisionActionDisplayLabel(entry.action) : '';
                const isAuditSlot = correctionAuditSlotIndex === slotIndex;
                const hasActionEntry = Boolean(actionLabel) || isAuditSlot;
                return (
                  <td
                    key={`sdm-action-second-${hour}`}
                    className={getCellClassName(slotState, false, true, hasActionEntry)}>
                    {isAuditSlot ? renderCorrectionAuditCellContent() : renderActionLabel(actionLabel)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      )}

      {isTableView && (
        <div className={styles.tableContainer}>
          {entries.length === 0 && !correctionAuditDisplay ? (
            <p className={styles.emptyState}>{t('noSharedDecisionMakingData', 'No shared decision making data.')}</p>
          ) : (
            <>
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
                          <TableRow
                            key={row.id}
                            className={
                              row.id === 'lcg-session-correction-audit'
                                ? styles.sharedDecisionAuditRow
                                : emergencyRowIds.has(row.id)
                                  ? styles.emergencyRow
                                  : undefined
                            }>
                            {row.cells.map((cell) => (
                              <TableCell
                                key={cell.id}
                                className={
                                  cell.info.header === 'assessment' || cell.info.header === 'plan'
                                    ? styles.sharedDecisionTableCell
                                    : undefined
                                }>
                                {cell.info.header === 'action' && row.id === 'lcg-session-correction-audit' ? (
                                  <span className={styles.sharedDecisionAuditActionText}>{cell.value}</span>
                                ) : cell.info.header === 'action' && criticalActionRowIds.has(row.id) ? (
                                  <span className={styles.sharedDecisionCriticalActionText}>{cell.value}</span>
                                ) : (
                                  cell.value
                                )}
                              </TableCell>
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
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SharedDecisionMaking;
