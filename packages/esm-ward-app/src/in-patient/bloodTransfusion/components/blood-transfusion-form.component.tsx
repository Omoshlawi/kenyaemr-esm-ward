import React, { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Tag,
  TextInput,
} from '@carbon/react';
import {
  ArrowLeft,
  Catalog,
  Checkmark,
  CheckmarkFilled,
  DropPhoto,
  Information,
  Printer,
  Save,
  Time,
  WarningAlt,
} from '@carbon/react/icons';
import { formatDate } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import {
  TRANSFUSION_BLOOD_TYPES,
  TRANSFUSION_INPUT_LIMITS,
  TRANSFUSION_OBSERVATION_ROWS,
  TRANSFUSION_RATE_UNITS,
  TRANSFUSION_NO_REACTION,
  TRANSFUSION_REACTION_GROUPS,
} from '../config/blood-transfusion.defaults';
import {
  type BloodTransfusion,
  type TransfusionObservation,
  type TransfusionRateUnit,
  type TransfusionRequiredField,
  type TransfusionRowSyncStatus,
} from '../types/blood-transfusion.types';
import { rowSignature } from '../utils/blood-transfusion-obs.mapper';
import {
  hasAbnormalObservation,
  isEndBeforeStart,
  isStartInFuture,
  isVitalOutOfRange,
  missingForSubmit,
  rowsWithOutOfRangeVitals,
  type TransfusionVitalField,
  observationDueTime,
  observationFlags,
  observationRowState,
  previousObservationMinTime,
  transfusionProgress,
  transfusionsEqual,
  hasTransfusionReaction,
  toggleTransfusionReaction,
  type ObservationRowState,
} from '../utils/blood-transfusion.utils';
import ProviderSearch from './provider-search.component';
import TransfusionTimePicker from './transfusion-time-picker.component';
import { variantClass } from '../utils/variant-class.utils';
import styles from './blood-transfusion.scss';

type BloodTransfusionFormProps = {
  transfusion: BloodTransfusion;
  isNew: boolean;
  nowLocal: string;
  readOnly: boolean;
  /** Row id → signature of the reading OpenMRS holds. */
  syncedRows?: Record<string, string>;
  /** Row id → status of a save that is running or failed. */
  pendingRows?: Record<string, TransfusionRowSyncStatus>;
  /** Called when focus leaves an observation row, so the row can be saved straight away. */
  onRowCommit?: (transfusion: BloodTransfusion, rowId: string) => void;
  onCancel: () => void;
  onSaveDraft: (transfusion: BloodTransfusion) => void;
  onSubmit: (transfusion: BloodTransfusion) => void;
};

const BloodTransfusionForm: React.FC<BloodTransfusionFormProps> = ({
  transfusion,
  isNew,
  nowLocal,
  readOnly,
  syncedRows,
  pendingRows,
  onRowCommit,
  onCancel,
  onSaveDraft,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState<BloodTransfusion>(transfusion);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [loadedId, setLoadedId] = useState(transfusion.id);

  if (transfusion.id !== loadedId) {
    setLoadedId(transfusion.id);
    setValue(transfusion);
    setShowErrors(false);
    setConfirmDiscard(false);
  }

  const rowSyncStatus = (rowId: string): TransfusionRowSyncStatus | undefined => {
    if (pendingRows?.[rowId]) {
      return pendingRows[rowId];
    }
    const signature = rowSignature(value.observations[rowId]);
    return signature && syncedRows?.[rowId] === signature ? 'saved' : undefined;
  };

  const commitRow = (rowId: string) => (event: React.FocusEvent<HTMLTableRowElement>) => {
    if (!readOnly && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      onRowCommit?.(value, rowId);
    }
  };

  const dirty = !readOnly && (isNew || !transfusionsEqual(value, transfusion));
  const progress = transfusionProgress(value, nowLocal);
  const rowStateLabel: Record<ObservationRowState, string> = {
    recorded: t('recorded', 'Recorded'),
    overdue: t('overdue', 'Overdue'),
    due: t('dueNow', 'Due now'),
    upcoming: t('upcoming', 'Upcoming'),
    notApplicable: t('notNeeded', 'Not needed'),
  };

  const handleCancel = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onCancel();
  };

  const set = <K extends keyof BloodTransfusion>(key: K, next: BloodTransfusion[K]) =>
    setValue((prev) => ({ ...prev, [key]: next }));

  const setDateWithCurrentTime = (
    dateKey: 'transfusionDate' | 'endedDate',
    timeKey: 'transfusionTime' | 'endedTime',
    date: string,
  ) =>
    setValue((prev) => ({
      ...prev,
      [dateKey]: date || undefined,
      [timeKey]: date ? nowLocal.slice(11, 16) : undefined,
    }));

  const setObservation = (rowId: string, patch: Partial<TransfusionObservation>) =>
    setValue((prev) => ({
      ...prev,
      observations: { ...prev.observations, [rowId]: { ...prev.observations[rowId], ...patch } },
    }));

  const toggleReaction = (id: string, checked: boolean) =>
    setValue((prev) => ({
      ...prev,
      reactions: toggleTransfusionReaction(prev.reactions, id, checked),
    }));

  const bloodType = value.bloodTypes[0];
  const selectBloodType = (id: string) =>
    setValue((prev) => ({
      ...prev,
      bloodTypes: [id],
      otherType: id === 'others' ? prev.otherType : undefined,
    }));

  const today = nowLocal.slice(0, 10);
  const missing = useMemo(() => new Set(missingForSubmit(value)), [value]);
  const endBeforeStart = isEndBeforeStart(value);
  const startInFuture = isStartInFuture(value, nowLocal);
  const abnormal = hasAbnormalObservation(value);
  const invalid = (field: TransfusionRequiredField) => showErrors && missing.has(field);
  const requiredText = t('required', 'Required');
  const outOfRangeRows = rowsWithOutOfRangeVitals(value);
  const rangeText = (field: TransfusionVitalField) =>
    t('transfusionVitalRange', 'Enter {{min}}–{{max}}', TRANSFUSION_INPUT_LIMITS[field]);
  const baseline = value.observations.before;

  const parseNumber = (raw: string) => {
    if (raw === '') {
      return undefined;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  /** The OpenMRS rate and volume concepts do not accept decimals. */
  const parseWholeNumber = (raw: string) => {
    const parsed = parseNumber(raw);
    return parsed === undefined ? undefined : Math.round(parsed);
  };

  const handleSubmit = () => {
    const time = nowLocal.slice(11, 16);
    const completed: BloodTransfusion = {
      ...value,
      transfusionTime: value.transfusionTime ?? (value.transfusionDate ? time : undefined),
      endedTime: value.endedTime ?? (value.endedDate ? time : undefined),
    };
    if (
      missingForSubmit(completed).length ||
      isEndBeforeStart(completed) ||
      startInFuture ||
      rowsWithOutOfRangeVitals(completed).length
    ) {
      setValue(completed);
      setShowErrors(true);
      return;
    }
    onSubmit(completed);
  };

  const required = (text: string) => (
    <>
      {text} <span className={styles.requiredMark}>*</span>
    </>
  );

  return (
    <section className={styles.formCard} aria-labelledby="transfusion-chart-title">
      <header className={styles.formHeader}>
        <div className={styles.formHeading}>
          <span className={styles.headerIcon}>
            <DropPhoto size={24} aria-hidden />
          </span>
          <div className={styles.formHeadingText}>
            <h3 id="transfusion-chart-title" className={styles.formTitle}>
              {t('bloodTransfusionChartTitle', 'Blood Transfusion Observation Chart')}
            </h3>
            <p className={styles.formSubtitle}>
              {t(
                'bloodTransfusionChartSubtitle',
                'Record transfusion details and monitor the patient for any reactions.',
              )}
            </p>
            <div className={styles.formHeaderMeta}>
              {dirty ? (
                <Tag size="sm" type="red">
                  {t('unsavedChanges', 'Unsaved changes')}
                </Tag>
              ) : null}
              <Tag size="sm" type={value.status === 'submitted' ? 'green' : 'warm-gray'}>
                {value.status === 'submitted' ? t('submitted', 'Submitted') : t('draft', 'Draft')}
              </Tag>
              <span className={styles.savedStamp}>
                {isNew
                  ? t('notSavedYet', 'Not saved yet')
                  : t('lastSavedBy', 'Last saved {{date}}{{by}}', {
                      date: formatDate(new Date(transfusion.updatedAt)),
                      by: transfusion.recordedBy ? ` · ${transfusion.recordedBy}` : '',
                    })}
              </span>
              <span className={styles.numberPill}>
                <Catalog size={14} aria-hidden />
                {t('transfusionNo', 'Transfusion No')}: {value.number}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.headerDate}>
          <TextInput
            id="transfusion-date"
            size="md"
            type="date"
            labelText={required(t('dateOfTransfusion', 'Date of transfusion'))}
            max={today}
            value={value.transfusionDate ?? ''}
            disabled={readOnly}
            invalid={invalid('transfusionDate')}
            invalidText={requiredText}
            onChange={(event) => setDateWithCurrentTime('transfusionDate', 'transfusionTime', event.target.value)}
          />
        </div>
      </header>

      {readOnly && value.status === 'submitted' ? (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={t('transfusionSubmittedTitle', 'Submitted record')}
          subtitle={t(
            'transfusionSubmittedHint',
            'Submitted by {{user}} on {{date}}. This record can no longer be edited.',
            {
              user: value.submittedBy ?? '',
              date: value.submittedAt ? formatDate(new Date(value.submittedAt)) : '',
            },
          )}
        />
      ) : null}

      {/* ---------- type of blood ---------- */}
      <div className={styles.block}>
        <div>
          <h4 id="transfusion-blood-type-title" className={styles.blockTitle}>
            <span className={styles.blockIcon}>
              <DropPhoto size={16} aria-hidden />
            </span>
            {required(t('typeOfBloodTransfused', 'Type of Blood Transfused'))}
          </h4>
          <p className={styles.blockHint}>{t('selectBloodTypeHint', 'Select the type of blood transfused')}</p>
        </div>
        <RadioButtonGroup
          name="transfusion-blood-type"
          aria-labelledby="transfusion-blood-type-title"
          valueSelected={bloodType ?? ''}
          disabled={readOnly}
          invalid={invalid('bloodTypes')}
          invalidText={t('selectOneBloodType', 'Select the type of blood transfused')}
          onChange={(selected) => selectBloodType(String(selected))}
          orientation="horizontal"
          className={styles.bloodTypeRadios}>
          {TRANSFUSION_BLOOD_TYPES.map((option) => (
            <RadioButton
              key={option.id}
              id={`transfusion-type-${option.id}`}
              value={option.id}
              labelText={t(`transfusionType_${option.id}`, option.label)}
            />
          ))}
        </RadioButtonGroup>
        {bloodType === 'others' ? (
          <TextInput
            id="transfusion-other-type"
            size="sm"
            labelText={required(t('specifyOtherType', 'Specify other type'))}
            placeholder={t('specifyOtherType', 'Specify other type')}
            value={value.otherType ?? ''}
            disabled={readOnly}
            invalid={invalid('otherType')}
            invalidText={requiredText}
            className={styles.otherTypeInput}
            onChange={(event) => set('otherType', event.target.value)}
          />
        ) : null}
      </div>

      {/* ---------- transfusion details ---------- */}
      <div className={styles.block}>
        <h4 className={styles.blockTitle}>
          <span className={styles.blockIcon}>
            <Catalog size={16} aria-hidden />
          </span>
          {t('transfusionDetails', 'Transfusion Details')}
        </h4>
        <div className={styles.grid3}>
          <TextInput
            id="transfusion-donor-number"
            size="sm"
            labelText={required(t('bloodUnitDonorNumber', 'Blood Unit Donor Number'))}
            placeholder={t('enterDonorNumber', 'Enter donor number')}
            value={value.donorNumber ?? ''}
            disabled={readOnly}
            invalid={invalid('donorNumber')}
            invalidText={requiredText}
            onChange={(event) => set('donorNumber', event.target.value)}
          />
          <TextInput
            id="transfusion-started-by"
            size="sm"
            labelText={required(t('transfusionStartedBy', 'Transfusion Started By'))}
            placeholder={t('nameOfStaff', 'Name of staff')}
            value={value.startedBy ?? ''}
            disabled={readOnly}
            invalid={invalid('startedBy')}
            invalidText={requiredText}
            onChange={(event) => set('startedBy', event.target.value)}
          />
          <ProviderSearch
            id="transfusion-counter-checked"
            labelText={required(t('counterCheckedBy', 'Counter Checked By'))}
            value={value.counterCheckedBy}
            disabled={readOnly}
            invalid={invalid('counterCheckedBy')}
            invalidText={t('selectProvider', 'Search and select a provider')}
            onChange={(provider) =>
              setValue((prev) => ({
                ...prev,
                counterCheckedBy: provider?.display,
                counterCheckedByUuid: provider?.uuid,
              }))
            }
          />
          <TransfusionTimePicker
            id="transfusion-time-started"
            labelText={required(t('timeTransfusionStarted', 'Time Transfusion Started'))}
            value={value.timeStarted}
            disabled={readOnly}
            showNowButton
            nowLocal={nowLocal}
            maxTime={value.transfusionDate === today ? nowLocal.slice(11, 16) : undefined}
            invalid={invalid('timeStarted') || (!readOnly && startInFuture)}
            invalidText={
              startInFuture
                ? t('transfusionStartInFuture', 'Cannot be later than the current time ({{time}})', {
                    time: nowLocal.slice(11, 16),
                  })
                : requiredText
            }
            onChange={(time) => set('timeStarted', time)}
          />
          <div className={styles.rateField}>
            <TextInput
              id="transfusion-rate"
              size="sm"
              type="number"
              labelText={t('rateOfTransfusion', 'Rate of Transfusion')}
              placeholder={t('enterRate', 'Enter rate')}
              min={TRANSFUSION_INPUT_LIMITS.rate.min}
              max={TRANSFUSION_INPUT_LIMITS.rate.max}
              step="1"
              value={value.rate ?? ''}
              disabled={readOnly}
              onChange={(event) => set('rate', parseWholeNumber(event.target.value))}
            />
            <Select
              id="transfusion-rate-unit"
              size="sm"
              labelText={t('unit', 'Unit')}
              value={value.rateUnit ?? 'mlPerMin'}
              disabled={readOnly}
              onChange={(event) => set('rateUnit', event.target.value as TransfusionRateUnit)}>
              {TRANSFUSION_RATE_UNITS.map((unit) => (
                <SelectItem key={unit.id} value={unit.id} text={t(`transfusionRate_${unit.id}`, unit.label)} />
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* ---------- observations ---------- */}
      <div className={styles.block}>
        <h4 className={styles.blockTitle}>
          <span className={styles.blockIcon}>
            <Time size={16} aria-hidden />
          </span>
          {t('observations', 'Observations')}
        </h4>
        <div className={styles.progressBar} aria-live="polite">
          <span>
            {t('observationsRecorded', 'Observations recorded: {{recorded}} of {{expected}}', {
              recorded: progress.recorded,
              expected: progress.expected,
            })}
          </span>
          <span className={styles.progressTrack} aria-hidden>
            <span
              className={styles.progressFill}
              style={{ width: `${progress.expected ? (progress.recorded / progress.expected) * 100 : 0}%` }}
            />
          </span>
          {progress.overdue && value.status !== 'submitted' ? (
            <span className={styles.overdueText}>
              <WarningAlt size={14} aria-hidden />
              {t('observationsOverdue', '{{count}} overdue', { count: progress.overdue })}
            </span>
          ) : null}
          {progress.nextDue && value.status !== 'submitted' ? (
            <span className={styles.nextDueText}>
              {t('nextObservationDue', 'Next due {{time}}', { time: progress.nextDue.slice(11) })}
            </span>
          ) : null}
        </div>
        {abnormal ? (
          <InlineNotification
            kind="warning"
            lowContrast
            hideCloseButton
            title={t('transfusionAbnormalObs', 'Possible transfusion reaction')}
            subtitle={t(
              'transfusionAbnormalObsHint',
              'Temperature ≥ 38 °C, a rise of ≥ 1 °C or a pulse rise of ≥ 20 bpm from baseline. Assess the patient and inform the clinician.',
            )}
          />
        ) : null}
        <div className={styles.obsTableWrap}>
          <table className={styles.obsTable}>
            <thead>
              <tr>
                <th>{t('observation', 'Observation')}</th>
                <th>{t('due', 'Due')}</th>
                <th>{t('exactTime', 'Time')}</th>
                <th>{t('temperatureC', 'Temp')}</th>
                <th>{t('pulseRateBpm', 'PR')}</th>
                <th>{t('respiratoryRateShort', 'RR')}</th>
                <th>{t('bloodPressureMmHg', 'BP')}</th>
                <th>{t('remarks', 'Remarks')}</th>
              </tr>
            </thead>
            <tbody>
              {TRANSFUSION_OBSERVATION_ROWS.map((row) => {
                const reading = value.observations[row.id];
                const isBaseline = row.id === 'before';
                const flags = observationFlags(baseline, reading, isBaseline);
                const due = observationDueTime(row, value.timeStarted, value.endedTime);
                const state = observationRowState(row, value, nowLocal);
                const showState = value.status !== 'submitted' || state === 'recorded';
                const syncStatus = rowSyncStatus(row.id);
                const minTime = previousObservationMinTime(row.id, value.observations);
                const timeBeforePrevious = Boolean(minTime && reading?.time && reading.time < minTime);
                return (
                  <tr
                    key={row.id}
                    onBlur={commitRow(row.id)}
                    className={`${isBaseline ? styles.baselineRow : ''} ${
                      state === 'overdue' && value.status !== 'submitted' ? styles.overdueRow : ''
                    } ${state === 'notApplicable' ? styles.notNeededRow : ''}`}>
                    <th scope="row" className={styles.obsLabel}>
                      {t(`transfusionRow_${row.id}`, row.label)}
                      {isBaseline ? <span className={styles.requiredMark}> *</span> : null}
                      {syncStatus ? (
                        <span
                          className={`${styles.rowSync} ${variantClass(styles, 'rowSync', syncStatus)}`}
                          role="status"
                          title={
                            syncStatus === 'saving'
                              ? t('savingToOpenMrs', 'Saving…')
                              : syncStatus === 'saved'
                                ? t('savedToOpenMrs', 'Saved')
                                : t('notSavedToOpenMrs', 'Not saved — leave the row to retry')
                          }>
                          {syncStatus === 'saving' ? (
                            <InlineLoading description={t('savingToOpenMrs', 'Saving…')} />
                          ) : syncStatus === 'saved' ? (
                            <CheckmarkFilled size={12} aria-hidden />
                          ) : (
                            <WarningAlt size={12} aria-hidden />
                          )}
                          <span className={styles.rowSyncText}>
                            {syncStatus === 'saving'
                              ? t('savingToOpenMrs', 'Saving…')
                              : syncStatus === 'saved'
                                ? t('savedToOpenMrs', 'Saved')
                                : t('notSavedToOpenMrs', 'Not saved — leave the row to retry')}
                          </span>
                        </span>
                      ) : null}
                    </th>
                    <td className={styles.dueCell}>
                      {due ? <div>{due}</div> : null}
                      {showState && state !== 'upcoming' ? (
                        <span className={`${styles.rowState} ${variantClass(styles, 'rowState', state)}`}>
                          {rowStateLabel[state]}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <TransfusionTimePicker
                        id={`transfusion-${row.id}-time`}
                        compact
                        hideLabel
                        showNowButton
                        labelText={t('exactTime', 'Exact Time')}
                        value={reading?.time}
                        disabled={readOnly}
                        invalid={timeBeforePrevious}
                        invalidText={
                          timeBeforePrevious && minTime
                            ? t('timeBeforePreviousObservation', 'Cannot be earlier than {{time}}', { time: minTime })
                            : undefined
                        }
                        nowLocal={nowLocal}
                        minTime={minTime}
                        maxTime={nowLocal.slice(11, 16)}
                        onChange={(time) => setObservation(row.id, { time })}
                      />
                    </td>
                    <td className={flags.temperature ? styles.flagCell : undefined}>
                      <div className={styles.unitInput}>
                        <TextInput
                          id={`transfusion-${row.id}-temp`}
                          size="sm"
                          type="number"
                          hideLabel
                          labelText={t('temperatureC', 'Temp (°C)')}
                          step="0.1"
                          min={TRANSFUSION_INPUT_LIMITS.temperature.min}
                          max={TRANSFUSION_INPUT_LIMITS.temperature.max}
                          value={reading?.temperature ?? ''}
                          disabled={readOnly}
                          invalid={
                            (isBaseline && invalid('baselineTemperature')) ||
                            isVitalOutOfRange('temperature', reading?.temperature)
                          }
                          invalidText={
                            isVitalOutOfRange('temperature', reading?.temperature)
                              ? rangeText('temperature')
                              : requiredText
                          }
                          onChange={(event) => setObservation(row.id, { temperature: parseNumber(event.target.value) })}
                        />
                        <span className={styles.unit}>°C</span>
                      </div>
                    </td>
                    <td className={flags.pulse ? styles.flagCell : undefined}>
                      <div className={styles.unitInput}>
                        <TextInput
                          id={`transfusion-${row.id}-pulse`}
                          size="sm"
                          type="number"
                          hideLabel
                          labelText={t('pulseRateBpm', 'PR (bpm)')}
                          min={TRANSFUSION_INPUT_LIMITS.pulse.min}
                          max={TRANSFUSION_INPUT_LIMITS.pulse.max}
                          value={reading?.pulse ?? ''}
                          disabled={readOnly}
                          invalid={
                            (isBaseline && invalid('baselinePulse')) || isVitalOutOfRange('pulse', reading?.pulse)
                          }
                          invalidText={isVitalOutOfRange('pulse', reading?.pulse) ? rangeText('pulse') : requiredText}
                          onChange={(event) => setObservation(row.id, { pulse: parseNumber(event.target.value) })}
                        />
                        <span className={styles.unit}>bpm</span>
                      </div>
                    </td>
                    <td>
                      <TextInput
                        id={`transfusion-${row.id}-rr`}
                        size="sm"
                        type="number"
                        hideLabel
                        labelText={t('respiratoryRateShort', 'RR (breaths/min)')}
                        min={TRANSFUSION_INPUT_LIMITS.respiratoryRate.min}
                        max={TRANSFUSION_INPUT_LIMITS.respiratoryRate.max}
                        value={reading?.respiratoryRate ?? ''}
                        disabled={readOnly}
                        invalid={isVitalOutOfRange('respiratoryRate', reading?.respiratoryRate)}
                        invalidText={rangeText('respiratoryRate')}
                        onChange={(event) =>
                          setObservation(row.id, { respiratoryRate: parseNumber(event.target.value) })
                        }
                      />
                    </td>
                    <td>
                      <div className={styles.bpInputs}>
                        <TextInput
                          id={`transfusion-${row.id}-systolic`}
                          size="sm"
                          type="number"
                          hideLabel
                          labelText={t('systolic', 'Systolic')}
                          placeholder={readOnly ? '' : t('sysShort', 'Sys')}
                          min={TRANSFUSION_INPUT_LIMITS.systolic.min}
                          max={TRANSFUSION_INPUT_LIMITS.systolic.max}
                          value={reading?.systolic ?? ''}
                          disabled={readOnly}
                          invalid={isVitalOutOfRange('systolic', reading?.systolic)}
                          invalidText={rangeText('systolic')}
                          onChange={(event) => setObservation(row.id, { systolic: parseNumber(event.target.value) })}
                        />
                        <span className={styles.bpSlash}>/</span>
                        <TextInput
                          id={`transfusion-${row.id}-diastolic`}
                          size="sm"
                          type="number"
                          hideLabel
                          labelText={t('diastolic', 'Diastolic')}
                          placeholder={readOnly ? '' : t('diaShort', 'Dia')}
                          min={TRANSFUSION_INPUT_LIMITS.diastolic.min}
                          max={TRANSFUSION_INPUT_LIMITS.diastolic.max}
                          value={reading?.diastolic ?? ''}
                          disabled={readOnly}
                          invalid={isVitalOutOfRange('diastolic', reading?.diastolic)}
                          invalidText={rangeText('diastolic')}
                          onChange={(event) => setObservation(row.id, { diastolic: parseNumber(event.target.value) })}
                        />
                      </div>
                    </td>
                    <td>
                      <TextInput
                        id={`transfusion-${row.id}-remarks`}
                        size="sm"
                        hideLabel
                        labelText={t('remarks', 'Remarks')}
                        placeholder={readOnly ? '' : t('enterRemarks', 'Enter remarks…')}
                        value={reading?.remarks ?? ''}
                        disabled={readOnly}
                        onChange={(event) => setObservation(row.id, { remarks: event.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.endRow}>
          <div className={styles.endField}>
            <span className={styles.endLabel}>
              <Time size={16} aria-hidden />
              {required(t('dateTransfusionEnded', 'Date transfusion ended'))}
            </span>
            <div className={styles.endInputs}>
              <TextInput
                id="transfusion-ended-date"
                size="sm"
                type="date"
                hideLabel
                labelText={t('dateTransfusionEnded', 'Date transfusion ended')}
                value={value.endedDate ?? ''}
                disabled={readOnly}
                invalid={invalid('endedDate') || (showErrors && endBeforeStart)}
                invalidText={endBeforeStart ? t('endBeforeStart', 'Ends before it started') : requiredText}
                onChange={(event) => setDateWithCurrentTime('endedDate', 'endedTime', event.target.value)}
              />
            </div>
          </div>
          <div className={styles.endField}>
            <span className={styles.endLabel}>
              <DropPhoto size={16} aria-hidden />
              {required(t('amountTransfused', 'Amount Transfused'))}
            </span>
            <div className={styles.unitInput}>
              <TextInput
                id="transfusion-amount"
                size="sm"
                type="number"
                hideLabel
                labelText={t('amountTransfused', 'Amount Transfused')}
                placeholder={t('enterAmount', 'Enter amount')}
                min={TRANSFUSION_INPUT_LIMITS.amountMl.min}
                max={TRANSFUSION_INPUT_LIMITS.amountMl.max}
                step="1"
                value={value.amountMl ?? ''}
                disabled={readOnly}
                invalid={invalid('amountMl')}
                invalidText={requiredText}
                onChange={(event) => set('amountMl', parseWholeNumber(event.target.value))}
              />
              <span className={styles.unit}>mL</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- reactions ---------- */}
      <div className={styles.reactionBlock}>
        <h4 className={styles.reactionTitle}>
          <WarningAlt size={16} aria-hidden />
          {t('transfusionReactionsTitle', 'Symptoms or Signs of Transfusion Reactions Observed')}
        </h4>
        <Checkbox
          id={`transfusion-reaction-${TRANSFUSION_NO_REACTION}`}
          labelText={t('transfusionReaction_none', 'None — no reaction observed')}
          checked={value.reactions.includes(TRANSFUSION_NO_REACTION)}
          disabled={readOnly}
          onChange={(_, { checked }) => toggleReaction(TRANSFUSION_NO_REACTION, checked)}
        />
        <div className={styles.reactionGrid}>
          {TRANSFUSION_REACTION_GROUPS.map((group) => (
            <fieldset key={group.id} className={styles.reactionGroup}>
              <legend>{t(`transfusionReactionGroup_${group.id}`, group.label)}</legend>
              {group.options.map((option) => (
                <Checkbox
                  key={option.id}
                  id={`transfusion-reaction-${option.id}`}
                  labelText={t(`transfusionReaction_${option.id}`, option.label)}
                  checked={value.reactions.includes(option.id)}
                  disabled={readOnly}
                  onChange={(_, { checked }) => toggleReaction(option.id, checked)}
                />
              ))}
            </fieldset>
          ))}
        </div>
        {hasTransfusionReaction(value.reactions) ? (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('transfusionReactionSuspected', 'Transfusion reaction suspected')}
            subtitle={t(
              'transfusionReactionAction',
              'Stop the transfusion, keep the IV line open with normal saline, inform the clinician and the blood bank, and return the unit and giving set.',
            )}
          />
        ) : null}
      </div>

      <p className={styles.noteBar}>
        <Information size={16} aria-hidden />
        {t('transfusionNote', 'Note: Monitor the patient closely and document any adverse reactions immediately.')}
      </p>

      {showErrors && (missing.size || endBeforeStart || startInFuture || outOfRangeRows.length) ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('transfusionIncomplete', 'Complete the required fields')}
          subtitle={t('transfusionIncompleteHint', '{{count}} required field(s) are missing or invalid.', {
            count: missing.size + (endBeforeStart ? 1 : 0) + (startInFuture ? 1 : 0) + outOfRangeRows.length,
          })}
        />
      ) : null}

      {confirmDiscard ? (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={t('discardTransfusionChanges', 'Discard unsaved changes?')}
          subtitle={t('discardTransfusionChangesHint', 'Use Save Draft to keep what you entered.')}>
          <div className={styles.discardActions}>
            <Button kind="ghost" size="sm" onClick={() => setConfirmDiscard(false)}>
              {t('keepEditing', 'Keep editing')}
            </Button>
            <Button kind="danger--ghost" size="sm" onClick={onCancel}>
              {t('discardChanges', 'Discard changes')}
            </Button>
          </div>
        </InlineNotification>
      ) : null}

      <footer className={`${styles.formFooter} icu-print-no-print`}>
        <div className={styles.footerActions}>
          <Button kind="tertiary" size="md" renderIcon={ArrowLeft} onClick={handleCancel}>
            {readOnly ? t('backToList', 'Back to list') : t('cancel', 'Cancel')}
          </Button>
          <Button kind="ghost" size="md" renderIcon={Printer} onClick={() => globalThis.print()}>
            {t('print', 'Print')}
          </Button>
        </div>
        {!readOnly ? (
          <div className={styles.footerActions}>
            <Button kind="tertiary" size="md" renderIcon={Save} disabled={!dirty} onClick={() => onSaveDraft(value)}>
              {t('saveDraft', 'Save Draft')}
            </Button>
            <Button kind="primary" size="md" renderIcon={Checkmark} onClick={handleSubmit}>
              {t('saveAndSubmit', 'Save & Submit')}
            </Button>
          </div>
        ) : null}
      </footer>
    </section>
  );
};

export default BloodTransfusionForm;
