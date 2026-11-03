import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  Button,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Add, DropPhoto, Edit, Time, TrashCan, View, WarningAlt } from '@carbon/react/icons';
import {
  getPatientName,
  showSnackbar,
  useConfig,
  useEmrConfiguration,
  usePatient,
  useSession,
  useVisit,
} from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { type WardConfigObject } from '../../../config-schema';
import {
  BLOOD_TRANSFUSION_DEFAULTS,
  TRANSFUSION_BLOOD_TYPES,
  TRANSFUSION_OBSERVATION_ROWS,
  TRANSFUSION_NO_REACTION,
  TRANSFUSION_REACTION_GROUPS,
} from '../config/blood-transfusion.defaults';
import {
  fetchBloodTransfusionsFromBackend,
  syncBloodTransfusion,
  voidBloodTransfusionEncounter,
} from '../resources/blood-transfusion.resource';
import {
  type BloodTransfusion,
  type BloodTransfusionStore,
  type TransfusionRowSyncStatus,
} from '../types/blood-transfusion.types';
import { rowSignature, storeFromBackendTransfusions } from '../utils/blood-transfusion-obs.mapper';
import {
  ageLabel,
  emptyTransfusionStore,
  hasAbnormalObservation,
  hasTransfusionReaction,
  nextTransfusionNumber,
  sortTransfusions,
  transfusionChartDay,
  transfusionPhase,
  transfusionProgress,
  upsertTransfusion,
  type TransfusionPhase,
} from '../utils/blood-transfusion.utils';
import { toFacilityDate, toFacilityParts } from '../utils/timezone.utils';
import BloodTransfusionForm from './blood-transfusion-form.component';
import styles from './blood-transfusion.scss';

type PatientResource = {
  birthDate?: string;
  gender?: string;
  identifier?: Array<{ value?: string; type?: { text?: string } }>;
};

type BloodTransfusionChartProps = {
  patientUuid: string;
};

function sexLabel(gender: string | undefined): string | undefined {
  const g = gender?.toLowerCase();
  if (g === 'female' || g === 'f') {
    return 'Female';
  }
  if (g === 'male' || g === 'm') {
    return 'Male';
  }
  return gender ? 'Other' : undefined;
}

const ALL_REACTIONS = [
  { id: TRANSFUSION_NO_REACTION, label: 'None' },
  ...TRANSFUSION_REACTION_GROUPS.flatMap((group) => group.options),
];
const COLUMN_COUNT = 10;
const ALL_DAYS = 'all';

const PHASE_LABELS: Record<TransfusionPhase, string> = {
  draft: 'Draft',
  inProgress: 'In progress',
  ended: 'Ended · not submitted',
  submitted: 'Submitted',
};

const PHASE_TAG: Record<TransfusionPhase, 'warm-gray' | 'blue' | 'purple' | 'green'> = {
  draft: 'warm-gray',
  inProgress: 'blue',
  ended: 'purple',
  submitted: 'green',
};

const BloodTransfusionChart: React.FC<BloodTransfusionChartProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const { patient } = usePatient(patientUuid);
  const facilityTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const chartActionsEnabled = true;

  const [store, setStore] = useState<BloodTransfusionStore>(emptyTransfusionStore);
  const storeRef = useRef(store);
  storeRef.current = store;
  const [openId, setOpenId] = useState<string | undefined>();
  const [newRecord, setNewRecord] = useState<BloodTransfusion | undefined>();
  const [dayFilter, setDayFilter] = useState<string>(ALL_DAYS);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const nowLocal = useMemo(() => {
    const now = new Date(nowMs);
    const { hour, minute } = toFacilityParts(now, facilityTimeZone);
    return `${toFacilityDate(now, facilityTimeZone)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(
      2,
      '0',
    )}`;
  }, [nowMs, facilityTimeZone]);

  const config = useConfig<WardConfigObject>();
  const encounterTypeUuid =
    config?.bloodTransfusion?.encounterTypeUuid || BLOOD_TRANSFUSION_DEFAULTS.encounterTypeUuid;
  const { activeVisit } = useVisit(patientUuid);
  const { emrConfiguration } = useEmrConfiguration();
  /** Transfusion id → row id → status of a save that is running or failed. */
  const [pendingRows, setPendingRows] = useState<Record<string, Record<string, TransfusionRowSyncStatus>>>({});
  const syncQueue = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    setStore(emptyTransfusionStore());
    setOpenId(undefined);
    setNewRecord(undefined);
    setPendingRows({});
  }, [patientUuid]);

  const swrKey = patientUuid ? (['ward-blood-transfusions', patientUuid, encounterTypeUuid, facilityTimeZone] as const) : null;
  const {
    data: backendTransfusions,
    isLoading: isLoadingBackend,
    mutate: mutateBackend,
  } = useSWR(swrKey, () => fetchBloodTransfusionsFromBackend(patientUuid!, encounterTypeUuid, facilityTimeZone), {
    revalidateOnFocus: true,
  });

  useEffect(() => {
    if (!backendTransfusions) {
      return;
    }
    setStore((current) =>
      storeFromBackendTransfusions(
        backendTransfusions,
        current.transfusions.filter((item) => !item.encounterUuid),
        facilityTimeZone,
      ),
    );
  }, [backendTransfusions, facilityTimeZone]);

  const setRowsStatus = useCallback(
    (transfusionId: string, rowIds: string[], status: TransfusionRowSyncStatus | undefined) =>
      setPendingRows((prev) => {
        const rows = { ...prev[transfusionId] };
        for (const rowId of rowIds) {
          if (status) {
            rows[rowId] = status;
          } else {
            delete rows[rowId];
          }
        }
        return { ...prev, [transfusionId]: rows };
      }),
    [],
  );

  /** Sends rows (and the header fields) to OpenMRS; saves for one transfusion run one after another. */
  const syncToOpenMrs = (transfusionId: string, rowIds: string[]) => {
    const locationUuid = activeVisit?.location?.uuid ?? session?.sessionLocation?.uuid;
    if (!patientUuid || !activeVisit?.uuid || !locationUuid) {
      setRowsStatus(transfusionId, rowIds, 'error');
      console.warn('[Ward] Blood transfusion: not saved to OpenMRS, the patient has no active visit');
      return;
    }
    setRowsStatus(transfusionId, rowIds, 'saving');
    const previous = syncQueue.current.get(transfusionId) ?? Promise.resolve();
    const next = previous.then(async () => {
      const latest = storeRef.current.transfusions.find((item) => item.id === transfusionId);
      if (!latest) {
        setRowsStatus(transfusionId, rowIds, undefined);
        return;
      }
      try {
        const result = await syncBloodTransfusion({
          transfusion: latest,
          rowIds,
          patientUuid,
          visitUuid: activeVisit.uuid,
          visitStartDatetime: activeVisit.startDatetime,
          locationUuid,
          encounterTypeUuid,
          providerUuid: session?.currentProvider?.uuid,
          encounterRoleUuid: emrConfiguration?.clinicianEncounterRole?.uuid,
          timeZone: facilityTimeZone,
          nowLocal,
        });
        setStore((current) => {
          const record = current.transfusions.find((item) => item.id === transfusionId);
          if (!record) {
            return current;
          }
          const syncedRows = { ...record.syncedRows };
          for (const [rowId, signature] of Object.entries(result.syncedRows)) {
            if (signature) {
              syncedRows[rowId] = signature;
            } else {
              delete syncedRows[rowId];
            }
          }
          return upsertTransfusion(current, { ...record, encounterUuid: result.encounterUuid, syncedRows });
        });
        setRowsStatus(transfusionId, rowIds, undefined);
        await mutateBackend();
      } catch (error) {
        setRowsStatus(transfusionId, rowIds, 'error');
        console.warn('[Ward] Blood transfusion: not saved to OpenMRS', error);
      }
    });
    syncQueue.current.set(transfusionId, next);
  };

  /** Rows whose reading differs from what OpenMRS last received. */
  const unsyncedRowIds = (record: BloodTransfusion) =>
    TRANSFUSION_OBSERVATION_ROWS.map((row) => row.id).filter(
      (rowId) => rowSignature(record.observations[rowId]) !== (record.syncedRows?.[rowId] ?? ''),
    );

  const transfusions = useMemo(() => sortTransfusions(store.transfusions), [store.transfusions]);

  const dayLabel = (date: string | undefined) => {
    if (!date) {
      return t('noDate', 'No date');
    }
    return date;
  };

  const groups = useMemo(() => {
    const byDay = new Map<string, BloodTransfusion[]>();
    for (const record of transfusions) {
      const key = transfusionChartDay(record) ?? '';
      byDay.set(key, [...(byDay.get(key) ?? []), record]);
    }
    return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [transfusions]);

  const visibleGroups = dayFilter === ALL_DAYS ? groups : groups.filter(([date]) => date === dayFilter);
  const running = transfusions.filter((record) => record.status === 'draft' && transfusionPhase(record) !== 'draft');
  const open = newRecord ?? transfusions.find((item) => item.id === openId);
  const userName = session?.user?.person?.display ?? session?.user?.display;

  /** Updates in-memory chart state only; OpenMRS remains the source of truth after sync. */
  const persist = (record: BloodTransfusion): BloodTransfusion => {
    const current = storeRef.current;
    const stored = current.transfusions.find((item) => item.id === record.id);
    const saved: BloodTransfusion = stored
      ? {
          ...record,
          encounterUuid: stored.encounterUuid ?? record.encounterUuid,
          syncedRows: stored.syncedRows ?? record.syncedRows,
        }
      : record;
    const next = upsertTransfusion(current, saved);
    setStore(next);
    return saved;
  };

  const handleRowCommit = (record: BloodTransfusion, rowId: string) => {
    if (!chartActionsEnabled || record.status === 'submitted') {
      return;
    }
    const stored = storeRef.current.transfusions.find((item) => item.id === record.id);
    if (rowSignature(record.observations[rowId]) === (stored?.syncedRows?.[rowId] ?? '')) {
      return;
    }
    persist({ ...record, status: 'draft', updatedAt: new Date().toISOString() });
    if (newRecord?.id === record.id) {
      setNewRecord(undefined);
      setOpenId(record.id);
    }
    syncToOpenMrs(record.id, [rowId]);
  };

  const close = () => {
    setOpenId(undefined);
    setNewRecord(undefined);
  };

  const startNew = () => {
    const now = new Date();
    const date = toFacilityDate(now, facilityTimeZone);
    const { hour, minute } = toFacilityParts(now, facilityTimeZone);
    const resource = patient as PatientResource | undefined;
    const ipNumber = resource?.identifier?.find((item) => /inpatient|\bip\b/i.test(item.type?.text ?? ''))?.value;
    setNewRecord({
      id: `transfusion-${now.getTime()}`,
      number: nextTransfusionNumber(storeRef.current, date),
      status: 'draft',
      patientName: patient ? getPatientName(patient) : undefined,
      ipNumber,
      ward: session?.sessionLocation?.display ?? activeVisit?.location?.display,
      sex: sexLabel(resource?.gender),
      age: ageLabel(resource?.birthDate, now),
      bloodTypes: [],
      transfusionDate: date,
      transfusionTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      startedBy: userName,
      rateUnit: 'mlPerMin',
      observations: {},
      reactions: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      recordedBy: userName,
    });
  };

  const handleSaveDraft = (record: BloodTransfusion) => {
    const saved = persist({ ...record, status: 'draft' as const, updatedAt: new Date().toISOString() });
    setNewRecord(undefined);
    setOpenId(saved.id);
    syncToOpenMrs(saved.id, unsyncedRowIds(saved));
    showSnackbar({
      kind: 'info',
      title: t('transfusionDraftSaved', 'Transfusion draft saved'),
      subtitle: saved.number,
    });
  };

  const handleSubmit = (record: BloodTransfusion) => {
    const now = new Date().toISOString();
    const saved = persist({
      ...record,
      status: 'submitted',
      updatedAt: now,
      submittedAt: now,
      submittedBy: userName,
    });
    close();
    syncToOpenMrs(saved.id, unsyncedRowIds(saved));
    showSnackbar({
      kind: hasTransfusionReaction(saved.reactions) || hasAbnormalObservation(saved) ? 'warning' : 'success',
      title: t('transfusionSubmitted', 'Transfusion record submitted'),
      subtitle: hasTransfusionReaction(saved.reactions)
        ? t('transfusionSubmittedWithReaction', '{{number}} · reaction recorded', { number: saved.number })
        : saved.number,
    });
  };

  const handleDeleteDraft = (record: BloodTransfusion) => {
    if (record.encounterUuid) {
      voidBloodTransfusionEncounter(record.encounterUuid)
        .then(() => mutateBackend())
        .catch((error) => console.warn('[Ward] Blood transfusion: could not remove the draft from OpenMRS', error));
    }
    setStore((current) => ({
      ...current,
      transfusions: current.transfusions.filter((item) => item.id !== record.id),
    }));
  };

  if (open) {
    return (
      <BloodTransfusionForm
        transfusion={open}
        isNew={Boolean(newRecord)}
        nowLocal={nowLocal}
        readOnly={!chartActionsEnabled || open.status === 'submitted'}
        syncedRows={store.transfusions.find((item) => item.id === open.id)?.syncedRows}
        pendingRows={pendingRows[open.id]}
        onRowCommit={handleRowCommit}
        onCancel={close}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
      />
    );
  }

  const typeLabel = (record: BloodTransfusion) =>
    record.bloodTypes
      .map((id) =>
        id === 'others' && record.otherType
          ? record.otherType
          : t(`transfusionType_${id}`, TRANSFUSION_BLOOD_TYPES.find((option) => option.id === id)?.label ?? id),
      )
      .join(', ');

  const reactionLabel = (record: BloodTransfusion) =>
    record.reactions
      .map((id) => t(`transfusionReaction_${id}`, ALL_REACTIONS.find((option) => option.id === id)?.label ?? id))
      .join(', ');

  return (
    <section className={styles.listCard} aria-labelledby="transfusion-list-title">
      <header className={styles.listHeader}>
        <h3 id="transfusion-list-title" className={styles.listTitle}>
          <DropPhoto size={20} aria-hidden />
          {t('bloodTransfusionTitle', 'Blood Transfusion')}
        </h3>
        {chartActionsEnabled ? (
          <Button size="sm" renderIcon={Add} className={styles.blueBtn} onClick={startNew}>
            {t('newTransfusion', 'New transfusion')}
          </Button>
        ) : null}
      </header>

      {isLoadingBackend ? (
        <InlineLoading description={t('loadingTransfusions', 'Loading blood transfusions…')} />
      ) : null}

      {!activeVisit ? (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={t('transfusionNeedsVisit', 'Active visit required')}
          subtitle={t(
            'transfusionNeedsVisitHint',
            'Start or open an active visit to save blood transfusion records to OpenMRS.',
          )}
        />
      ) : null}

      {running.map((record) => {
        const progress = transfusionProgress(record, nowLocal);
        return (
          <div
            key={record.id}
            className={`${styles.runningBanner} ${progress.overdue ? styles.runningOverdue : ''}`}
            role="status">
            <Time size={20} aria-hidden />
            <div className={styles.runningText}>
              <strong>
                {transfusionPhase(record) === 'ended'
                  ? t('transfusionAwaitingSubmit', '{{number}} ended — awaiting submission', { number: record.number })
                  : t('transfusionRunning', '{{number}} in progress since {{time}}', {
                      number: record.number,
                      time: record.timeStarted,
                    })}
              </strong>
              <span>
                {t('observationsRecorded', 'Observations recorded: {{recorded}} of {{expected}}', {
                  recorded: progress.recorded,
                  expected: progress.expected,
                })}
                {progress.overdue
                  ? ` · ${t('observationsOverdue', '{{count}} overdue', { count: progress.overdue })}`
                  : ''}
                {progress.nextDue
                  ? ` · ${t('nextObservationDue', 'Next due {{time}}', { time: progress.nextDue.slice(11) })}`
                  : ''}
              </span>
            </div>
            <Button kind="primary" size="sm" className={styles.blueBtn} onClick={() => setOpenId(record.id)}>
              {chartActionsEnabled ? t('recordObservations', 'Record observations') : t('view', 'View')}
            </Button>
          </div>
        );
      })}

      {transfusions.length ? (
        <>
          <div className={styles.listFilters}>
            <Select
              id="transfusion-day-filter"
              size="sm"
              inline
              labelText={t('show', 'Show')}
              value={dayFilter}
              onChange={(event) => setDayFilter(event.target.value)}>
              <SelectItem
                value={ALL_DAYS}
                text={t('allDaysCount', 'All days ({{count}})', { count: transfusions.length })}
              />
              {groups.map(([date, records]) => (
                <SelectItem key={date} value={date} text={`${dayLabel(date)} (${records.length})`} />
              ))}
            </Select>
          </div>
          <div className={styles.listTableWrap}>
            <Table size="sm" useZebraStyles={false} className={styles.listTable}>
              <TableHead>
                <TableRow>
                  <TableHeader>{t('transfusionNo', 'Transfusion No')}</TableHeader>
                  <TableHeader>{t('typeOfBlood', 'Type of blood')}</TableHeader>
                  <TableHeader>{t('donorNumber', 'Donor no.')}</TableHeader>
                  <TableHeader>{t('startedEnded', 'Started – ended')}</TableHeader>
                  <TableHeader>{t('amountMl', 'Amount (mL)')}</TableHeader>
                  <TableHeader>{t('observations', 'Observations')}</TableHeader>
                  <TableHeader>{t('reactions', 'Reactions')}</TableHeader>
                  <TableHeader>{t('status', 'Status')}</TableHeader>
                  <TableHeader>{t('savedBy', 'Saved by')}</TableHeader>
                  <TableHeader aria-label={t('actions', 'Actions')} />
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleGroups.map(([date, records]) => (
                  <React.Fragment key={date}>
                    <TableRow className={styles.dayRow}>
                      <TableCell colSpan={COLUMN_COUNT}>
                        <strong>{dayLabel(date)}</strong>
                        <span className={styles.dayCount}>
                          {t('transfusionCount', '{{count}} transfusion(s)', { count: records.length })}
                        </span>
                      </TableCell>
                    </TableRow>
                    {records.map((record) => {
                      const abnormal = hasAbnormalObservation(record);
                      const editable = chartActionsEnabled && record.status === 'draft';
                      const phase = transfusionPhase(record);
                      const progress = transfusionProgress(record, nowLocal);
                      return (
                        <TableRow key={record.id}>
                          <TableCell className={styles.numberCell}>
                            {record.number}
                            {record.ward ? <div className={styles.subText}>{record.ward}</div> : null}
                          </TableCell>
                          <TableCell>{typeLabel(record)}</TableCell>
                          <TableCell>{record.donorNumber}</TableCell>
                          <TableCell>
                            {record.timeStarted ? (
                              <div>
                                {record.transfusionDate} {record.timeStarted}
                              </div>
                            ) : null}
                            {record.endedTime ? (
                              <div className={styles.subText}>
                                {record.endedDate} {record.endedTime}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>{record.amountMl}</TableCell>
                          <TableCell>
                            <span
                              className={
                                progress.overdue && record.status === 'draft' ? styles.reactionText : undefined
                              }>
                              {progress.recorded}/{progress.expected}
                            </span>
                            {progress.overdue && record.status === 'draft' ? (
                              <div className={styles.overdueText}>
                                {t('observationsOverdue', '{{count}} overdue', { count: progress.overdue })}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {hasTransfusionReaction(record.reactions) ? (
                              <span className={styles.reactionText}>
                                <WarningAlt size={14} aria-hidden />
                                {reactionLabel(record)}
                              </span>
                            ) : abnormal ? (
                              <span className={styles.reactionText}>
                                <WarningAlt size={14} aria-hidden />
                                {t('abnormalObservations', 'Abnormal observations')}
                              </span>
                            ) : record.status === 'submitted' ? (
                              t('none', 'None')
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Tag size="sm" type={PHASE_TAG[phase]}>
                              {t(`transfusionPhase_${phase}`, PHASE_LABELS[phase])}
                            </Tag>
                          </TableCell>
                          <TableCell>
                            {record.submittedBy ?? record.recordedBy}
                            <div className={styles.subText}>
                              {new Date(record.submittedAt ?? record.updatedAt).toLocaleString(undefined, {
                                timeZone: facilityTimeZone,
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </TableCell>
                          <TableCell className={styles.actionsCell}>
                            <Button
                              kind="ghost"
                              size="sm"
                              hasIconOnly
                              renderIcon={editable ? Edit : View}
                              iconDescription={editable ? t('continueEditing', 'Continue editing') : t('view', 'View')}
                              onClick={() => setOpenId(record.id)}
                            />
                            {editable && phase === 'draft' ? (
                              <Button
                                kind="ghost"
                                size="sm"
                                hasIconOnly
                                renderIcon={TrashCan}
                                iconDescription={t('deleteDraft', 'Delete draft')}
                                onClick={() => handleDeleteDraft(record)}
                              />
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <p className={styles.emptyList}>{t('noTransfusions', 'No blood transfusions have been recorded.')}</p>
      )}
    </section>
  );
};

export default BloodTransfusionChart;
