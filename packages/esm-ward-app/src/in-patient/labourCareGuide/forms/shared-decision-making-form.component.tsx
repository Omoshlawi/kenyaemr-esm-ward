import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { Modal, Grid, Column, TextArea, InlineNotification, Select, SelectItem } from '@carbon/react';
import { SharedDecisionTimePickerDropdown } from './form-scoped-time-pickers.component';
import SharedDecisionAssessmentField from './shared-decision-assessment-field.component';
import styles from '../partography-data-form.scss';
import { buildAssessmentPrefillFromAlerts, type SharedDecisionAlertItem } from '../alert-rules';
import {
  SHARED_DECISION_MAKING_ACTIONS,
  UUID_SHARED_DECISION_REFERRAL,
  UUID_SHARED_DECISION_TERMINATE_ONGOING_PROGRESS,
  UUID_SHARED_DECISION_TRANSFER_TO_CS,
  LCG_TERMINATION_REASON_OTHER_CONCEPT_UUID,
  LCG_TERMINATION_REASON_WRONG_PATIENT_CONCEPT_UUID,
} from '../types';
import { saveSharedDecisionMakingData } from '../resources/shared-decision-making.resource';
import LcgCorrectionAuditBanner from '../components/lcg-correction-audit-banner.component';
import type { LcgCorrectionAuditRecord } from '../resources/lcg-session-correction.resource';
import { useLcgFormClock } from '../hooks/use-lcg-form-clock';
import {
  formatHHMM,
  getAllowedEmergencyTimes,
  getAllowedPointTimesForSlots,
  getPointSlotIndexForTime,
  getPointSlotState,
  getStageAwarePointSlotIndexForTime,
  SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS,
  SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
} from '../time-slot-utils';

export type SharedDecisionMakingFormData = {
  assessment: string;
  action: string;
  plan: string;
  time: string;
  terminationReasonType?: string;
  terminationReasonText?: string;
};

export type SharedDecisionMakingFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SharedDecisionMakingFormData) => void;
  onDataSaved?: () => void;
  autoPromptSummary?: string;
  autoPromptItems?: SharedDecisionAlertItem[];
  isAutoPrompt?: boolean;
  autoPromptDebugWindow?: {
    triggerTimeMs: number;
    openAtMs: number | null;
    expiresAtMs: number;
  };
  isEmergencyMode?: boolean;
  emergencyReason?: string;
  patient?: {
    uuid: string;
    name: string;
    gender: string;
    age: string;
  };
  isMultipleGestation?: boolean;
  hasTwinOneBirthRecorded?: boolean;
  correctionAuditDisplay?: LcgCorrectionAuditRecord | null;
};

const SharedDecisionMakingForm: React.FC<
  SharedDecisionMakingFormProps & {
    existingTimeEntries?: Array<{ hour: number; time: string }>;
    baseTime?: string;
    slotCount?: number;
    firstStageSlotCount?: number;
    secondStageSlotCount?: number;
    secondStageStartTime?: string;
  }
> = ({
  isOpen,
  onClose,
  onSubmit,
  onDataSaved,
  autoPromptSummary,
  autoPromptItems = [],
  isAutoPrompt = false,
  autoPromptDebugWindow,
  isEmergencyMode = false,
  emergencyReason,
  patient,
  isMultipleGestation = false,
  hasTwinOneBirthRecorded = false,
  correctionAuditDisplay = null,
  existingTimeEntries = [],
  baseTime,
  slotCount = 0,
  firstStageSlotCount,
  secondStageSlotCount = 0,
  secondStageStartTime,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const now = useLcgFormClock(isOpen);
  const [consentModalOpen, setConsentModalOpen] = React.useState(false);
  const [pendingCleanData, setPendingCleanData] = React.useState<SharedDecisionMakingFormData | null>(null);
  const actionOptions = React.useMemo(() => {
    const TWIN_ONE_BIRTH_UUID = 'd9ad3cc2-5800-4cd0-ab51-fa3306295617';
    const DELIVERY_UUID = 'fb50f3e1-0971-4f82-9774-41ff57e38043';

    if (!isMultipleGestation) {
      return SHARED_DECISION_MAKING_ACTIONS.filter((option) => option.value !== TWIN_ONE_BIRTH_UUID);
    }

    if (hasTwinOneBirthRecorded) {
      return SHARED_DECISION_MAKING_ACTIONS.filter((option) => option.value !== TWIN_ONE_BIRTH_UUID);
    }

    return SHARED_DECISION_MAKING_ACTIONS.filter((option) => option.value !== DELIVERY_UUID);
  }, [hasTwinOneBirthRecorded, isMultipleGestation]);
  const criticalActionValues = React.useMemo(
    () =>
      new Set([
        '159739AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '0dcc1312-e83e-4317-97c3-4b127b599744',
        'fb50f3e1-0971-4f82-9774-41ff57e38043',
        '160433AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ]),
    [],
  );
  const consentExemptActionValues = React.useMemo(
    () =>
      new Set<string>([
        UUID_SHARED_DECISION_REFERRAL,
        UUID_SHARED_DECISION_TRANSFER_TO_CS,
        UUID_SHARED_DECISION_TERMINATE_ONGOING_PROGRESS,
      ]),
    [],
  );
  const resolvedFirstStageSlotCount = firstStageSlotCount ?? slotCount;
  const resolvedSecondStageSlotCount = secondStageStartTime ? secondStageSlotCount : 0;

  const { control, handleSubmit, reset, setError, clearErrors, watch, setValue } =
    useForm<SharedDecisionMakingFormData>({
      defaultValues: {
        assessment: '',
        action: '',
        plan: '',
        time: '',
        terminationReasonType: '',
        terminationReasonText: '',
      },
    });

  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const assessmentPrefill = buildAssessmentPrefillFromAlerts(autoPromptItems);
      reset({
        assessment: assessmentPrefill,
        action: '',
        plan: '',
        time: '',
        terminationReasonType: '',
        terminationReasonText: '',
      });
      clearErrors();
      setSaveError(null);
      setSaveSuccess(false);
    }

    wasOpenRef.current = isOpen;
  }, [autoPromptItems, clearErrors, isOpen, reset]);

  const selectedTime = watch('time');
  const selectedAction = watch('action');
  const selectedTerminationReasonType = watch('terminationReasonType');
  const isTerminateActionSelected = selectedAction === UUID_SHARED_DECISION_TERMINATE_ONGOING_PROGRESS;
  const isOtherTerminationReason = selectedTerminationReasonType === LCG_TERMINATION_REASON_OTHER_CONCEPT_UUID;

  React.useEffect(() => {
    if (!isTerminateActionSelected) {
      return;
    }

    setValue('assessment', t('lcgTerminateAssessmentDefault', 'Session terminated — pending data correction'), {
      shouldDirty: true,
    });
    setValue(
      'plan',
      t('lcgTerminatePlanDefault', 'Use the correction workflow to reopen or transfer this session if needed.'),
      { shouldDirty: true },
    );
  }, [isTerminateActionSelected, setValue, t]);

  const formatDebugTime = React.useCallback((timeMs: number) => {
    if (!Number.isFinite(timeMs)) {
      return '--:--:--';
    }

    const date = new Date(timeMs);
    return date.toLocaleTimeString([], { hour12: false });
  }, []);

  const groupedAutoPromptItems = React.useMemo(() => {
    const sectionOrder = ['Supportive Care', 'Baby', 'Woman', 'Labour Progress'];
    const sectionToTokens = new Map<string, Array<{ code: string; guidance: string }>>();

    for (const item of autoPromptItems) {
      if (!item?.section || !item?.code) {
        continue;
      }

      if (!sectionToTokens.has(item.section)) {
        sectionToTokens.set(item.section, []);
      }

      sectionToTokens.get(item.section)!.push({ code: item.code, guidance: item.guidance });
    }

    const orderedSections = [
      ...sectionOrder.filter((section) => sectionToTokens.has(section)),
      ...Array.from(sectionToTokens.keys()).filter((section) => !sectionOrder.includes(section)),
    ];

    return orderedSections.map((section) => [section, sectionToTokens.get(section)!] as const);
  }, [autoPromptItems]);

  const availableAssessmentSlotKeys = React.useMemo(() => {
    if (!baseTime || slotCount === 0) {
      return [];
    }

    const availableSlots: string[] = [];

    Array.from({ length: resolvedFirstStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
      const secondaryKey = `secondary-${slotIndex}`;
      if (getPointSlotState(baseTime, slotIndex, now, SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS) === 'active') {
        availableSlots.push(secondaryKey);
      }
    });

    if (secondStageStartTime && resolvedSecondStageSlotCount > 0) {
      Array.from({ length: resolvedSecondStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
        const absoluteSlotIndex = resolvedFirstStageSlotCount + slotIndex;
        const secondaryKey = `secondary-${absoluteSlotIndex}`;
        if (
          getPointSlotState(secondStageStartTime, slotIndex, now, SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS) === 'active'
        ) {
          availableSlots.push(secondaryKey);
        }
      });
    }

    return availableSlots;
  }, [baseTime, now, resolvedFirstStageSlotCount, resolvedSecondStageSlotCount, secondStageStartTime, slotCount]);

  const availableActionPlanSlotKeys = React.useMemo(() => {
    if (!baseTime || slotCount === 0) {
      return [];
    }

    const availableSlots: string[] = [];

    Array.from({ length: resolvedFirstStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
      const hourlyKey = `hourly-${slotIndex}`;
      if (getPointSlotState(baseTime, slotIndex, now, SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS) === 'active') {
        availableSlots.push(hourlyKey);
      }
    });

    if (secondStageStartTime && resolvedSecondStageSlotCount > 0) {
      Array.from({ length: resolvedSecondStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
        const absoluteSlotIndex = resolvedFirstStageSlotCount + slotIndex;
        const hourlyKey = `hourly-${absoluteSlotIndex}`;
        if (
          getPointSlotState(secondStageStartTime, slotIndex, now, SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS) === 'active'
        ) {
          availableSlots.push(hourlyKey);
        }
      });
    }

    return availableSlots;
  }, [baseTime, now, resolvedFirstStageSlotCount, resolvedSecondStageSlotCount, secondStageStartTime, slotCount]);

  const assessmentAllowedTimes = React.useMemo(() => {
    if (!baseTime || availableAssessmentSlotKeys.length === 0) {
      return [];
    }

    const secondarySlotIndices = availableAssessmentSlotKeys
      .filter((slotKey) => slotKey.startsWith('secondary-'))
      .map((slotKey) => Number(slotKey.replace('secondary-', '')))
      .filter((slotIndex) => Number.isInteger(slotIndex));

    const firstStageIndices = secondarySlotIndices.filter((slotIndex) => slotIndex < resolvedFirstStageSlotCount);
    const secondStageIndices = secondarySlotIndices
      .filter((slotIndex) => slotIndex >= resolvedFirstStageSlotCount)
      .map((slotIndex) => slotIndex - resolvedFirstStageSlotCount);

    return Array.from(
      new Set([
        ...getAllowedPointTimesForSlots(baseTime, firstStageIndices, SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS, now),
        ...(secondStageStartTime
          ? getAllowedPointTimesForSlots(
              secondStageStartTime,
              secondStageIndices,
              SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS,
              now,
            )
          : []),
      ]),
    ).sort();
  }, [availableAssessmentSlotKeys, baseTime, now, resolvedFirstStageSlotCount, secondStageStartTime]);

  const actionPlanAllowedTimes = React.useMemo(() => {
    if (!baseTime || availableActionPlanSlotKeys.length === 0) {
      return [];
    }

    const hourlySlotIndices = availableActionPlanSlotKeys
      .filter((slotKey) => slotKey.startsWith('hourly-'))
      .map((slotKey) => Number(slotKey.replace('hourly-', '')))
      .filter((slotIndex) => Number.isInteger(slotIndex));

    const firstStageIndices = hourlySlotIndices.filter((slotIndex) => slotIndex < resolvedFirstStageSlotCount);
    const secondStageIndices = hourlySlotIndices
      .filter((slotIndex) => slotIndex >= resolvedFirstStageSlotCount)
      .map((slotIndex) => slotIndex - resolvedFirstStageSlotCount);

    return Array.from(
      new Set([
        ...getAllowedPointTimesForSlots(baseTime, firstStageIndices, SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS, now),
        ...(secondStageStartTime
          ? getAllowedPointTimesForSlots(
              secondStageStartTime,
              secondStageIndices,
              SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
              now,
            )
          : []),
      ]),
    ).sort();
  }, [availableActionPlanSlotKeys, baseTime, now, resolvedFirstStageSlotCount, secondStageStartTime]);

  const slotAllowedTimes = React.useMemo(() => {
    if (isEmergencyMode) {
      return getAllowedEmergencyTimes(now);
    }

    return Array.from(new Set([...assessmentAllowedTimes, ...actionPlanAllowedTimes])).sort();
  }, [actionPlanAllowedTimes, assessmentAllowedTimes, isEmergencyMode, now]);

  const displayAllowedTimes = React.useMemo(() => {
    if (slotAllowedTimes.length > 0) {
      return slotAllowedTimes;
    }
    const nowHHMM = formatHHMM(now);
    return nowHHMM ? [nowHHMM] : [];
  }, [now, slotAllowedTimes]);

  const isInputLocked = !isEmergencyMode && Boolean(baseTime) && slotAllowedTimes.length === 0;
  const isTimeSelectable = !isInputLocked || isAutoPrompt;
  const areFieldsEnabled = ((!isInputLocked && Boolean(selectedTime)) || isEmergencyMode) && !isSaving;

  const handleFormSubmit = async (data: SharedDecisionMakingFormData) => {
    clearErrors();
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      if (!patient?.uuid) throw new Error('No patient UUID');

      if (!data.time) {
        setError('time', { type: 'manual', message: t('timeRequired', 'Time is required') });
        return;
      }

      if (!isEmergencyMode && baseTime && slotCount > 0 && !slotAllowedTimes.includes(data.time)) {
        setError('time', {
          type: 'manual',
          message: t('timeNotAllowed', 'Select a valid time slot'),
        });
        return;
      }

      if (!data.assessment.trim()) {
        setError('assessment', {
          type: 'manual',
          message: t('assessmentRequired', 'Assessment is required'),
        });
        return;
      }

      if (!data.action.trim()) {
        setError('action', {
          type: 'manual',
          message: t('actionRequired', 'Action is required'),
        });
        return;
      }

      if (!data.plan.trim()) {
        setError('plan', {
          type: 'manual',
          message: t('planRequired', 'Plan is required'),
        });
        return;
      }

      const isTerminateAction = data.action === UUID_SHARED_DECISION_TERMINATE_ONGOING_PROGRESS;
      if (isTerminateAction && !data.terminationReasonType) {
        setError('terminationReasonType', {
          type: 'manual',
          message: t('terminationReasonTypeRequired', 'Termination reason is required'),
        });
        return;
      }

      if (
        isTerminateAction &&
        data.terminationReasonType === LCG_TERMINATION_REASON_OTHER_CONCEPT_UUID &&
        !data.terminationReasonText?.trim()
      ) {
        setError('terminationReasonText', {
          type: 'manual',
          message: t('terminationReasonTextRequired', 'Please describe the termination reason'),
        });
        return;
      }

      const cleanData: SharedDecisionMakingFormData = {
        assessment: data.assessment.trim(),
        action: typeof data.action === 'string' ? data.action : (data.action as any)?.uuid || '',
        plan: data.plan.trim(),
        time: data.time,
        terminationReasonType: data.terminationReasonType,
        terminationReasonText: data.terminationReasonText?.trim(),
      };

      if (criticalActionValues.has(cleanData.action) && !consentExemptActionValues.has(cleanData.action)) {
        setPendingCleanData(cleanData);
        setConsentModalOpen(true);
        setIsSaving(false);
        return;
      }

      await executeSave(cleanData);
    } catch (error) {
      setSaveError(t('saveError', 'Failed to save data'));
    } finally {
      setIsSaving(false);
    }
  };

  const executeSave = async (cleanData: SharedDecisionMakingFormData) => {
    try {
      const result = await saveSharedDecisionMakingData(patient!.uuid, cleanData, t, undefined, undefined, {
        emergencyReason: isEmergencyMode ? emergencyReason : undefined,
        terminationReasonType: cleanData.terminationReasonType,
        terminationReasonText: cleanData.terminationReasonText,
      });

      if (!result.success) {
        setSaveError(result.message);
        return;
      }

      setSaveSuccess(true);

      if (onDataSaved) {
        onDataSaved();
      }

      onSubmit(cleanData);
      reset();

      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      setSaveError(t('saveError', 'Failed to save data'));
    }
  };

  const handleClose = () => {
    reset();
    clearErrors();
    onClose();
  };

  return (
    <>
      <Modal
        open={isOpen}
        onRequestClose={handleClose}
        modalHeading={t('sharedDecisionMakingData', 'Shared Decision Making')}
        primaryButtonText={isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
        primaryButtonDisabled={isSaving || !areFieldsEnabled}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestSubmit={handleSubmit(handleFormSubmit)}
        onSecondarySubmit={handleClose}
        className={styles.cervixModal}
        size="md">
        {saveSuccess && (
          <InlineNotification
            kind="success"
            title={t('saveSuccess', 'Data saved successfully')}
            subtitle={t('sharedDecisionMakingDataSaved', 'Shared decision making data has been saved')}
            hideCloseButton
          />
        )}

        {saveError && (
          <InlineNotification
            kind="error"
            title={t('saveError', 'Error saving data')}
            subtitle={saveError}
            onCloseButtonClick={() => setSaveError(null)}
          />
        )}

        {isEmergencyMode ? (
          <InlineNotification
            kind="warning"
            title={t('emergencyModeActive', 'Emergency mode active')}
            subtitle={
              emergencyReason
                ? t('emergencyReasonDisplay', `Reason: ${emergencyReason}`)
                : t('emergencyReasonMissing', 'No reason captured')
            }
            hideCloseButton
          />
        ) : null}

        <LcgCorrectionAuditBanner auditRecord={correctionAuditDisplay} variant="form" />

        {groupedAutoPromptItems.length ? (
          <div className={styles.autoPromptSummary}>
            <p className={styles.autoPromptSummaryTitle}>{t('activeClinicalAlerts', 'Active clinical alerts')}</p>
            <p className={styles.autoPromptHint}>
              {t('hoverAlertInfoForGuidance', 'Hover the info button next to each alert code to view guidance.')}
            </p>
            {groupedAutoPromptItems.map(([section, tokens]) => (
              <p key={section} className={styles.autoPromptSummaryRow}>
                <span>{section}: </span>
                {tokens.map((token, index) => (
                  <React.Fragment key={`${section}-${token.code}-${index}`}>
                    <span className={styles.autoPromptToken}>{token.code}</span>
                    <button
                      type="button"
                      className={styles.autoPromptInfoTrigger}
                      title={token.guidance}
                      aria-label={t('viewAlertGuidance', 'View alert guidance for {{token}}', { token: token.code })}>
                      i
                    </button>
                    {index < tokens.length - 1 ? ', ' : ''}
                  </React.Fragment>
                ))}
              </p>
            ))}
          </div>
        ) : autoPromptSummary ? (
          <p className={styles.autoPromptSummary}>{autoPromptSummary}</p>
        ) : null}

        {isAutoPrompt && autoPromptDebugWindow ? (
          <p style={{ marginTop: '0.5rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#525252' }}>
            {t('autoPromptDebugWindowLabel', 'Alert at')} {formatDebugTime(autoPromptDebugWindow.triggerTimeMs)} •{' '}
            {autoPromptDebugWindow.openAtMs != null
              ? `${t('autoPromptDebugOpenLabel', 'opens at')} ${formatDebugTime(autoPromptDebugWindow.openAtMs)} • `
              : `${t('autoPromptDebugNoAudioLabel', 'audio suppressed before hour end')} • `}
            {t('autoPromptDebugCloseLabel', 'closes at')} {formatDebugTime(autoPromptDebugWindow.expiresAtMs)}
          </p>
        ) : null}

        <Grid className={styles.formGrid} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* TIME */}
          <Column lg={16} md={4} sm={2}>
            <div className={styles.formField}>
              <Controller
                name="time"
                control={control}
                rules={{
                  required: t('timeRequired', 'Time is required'),
                  validate: (value) =>
                    !slotAllowedTimes.length ||
                    slotAllowedTimes.includes(value) ||
                    t('timeNotAllowed', 'Select a valid time'),
                }}
                render={({ field, fieldState }) => (
                  <div>
                    <label className={styles.fieldLabel}>{t('time', 'Time')}</label>
                    <SharedDecisionTimePickerDropdown
                      id="time-picker"
                      labelText=""
                      value={typeof field.value === 'string' ? field.value : ''}
                      onChange={field.onChange}
                      disabled={!baseTime}
                      existingTimeEntries={existingTimeEntries}
                      allowedTimes={baseTime ? displayAllowedTimes : undefined}
                      disablePastTimes={!isEmergencyMode}
                      currentTime={formatHHMM(now)}
                      invalid={!!fieldState.error}
                      invalidText={fieldState.error?.message}
                    />
                  </div>
                )}
              />
            </div>
          </Column>

          {/* ASSESSMENT */}
          <Column lg={16} md={8} sm={4}>
            <h4 className={styles.sectionFormHeading}>{t('assessment', 'Assessment')}</h4>
            <div className={styles.formField}>
              <Controller
                name="assessment"
                control={control}
                rules={{ required: t('assessmentRequired', 'Assessment is required') }}
                render={({ field, fieldState }) => (
                  <SharedDecisionAssessmentField
                    id="assessment-textarea"
                    labelText={t('assessment', 'Assessment *')}
                    placeholder={t('enterAssessment', 'Enter assessment...')}
                    value={typeof field.value === 'string' ? field.value : ''}
                    onChange={field.onChange}
                    alertItems={autoPromptItems}
                    disabled={!areFieldsEnabled}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                  />
                )}
              />
            </div>
          </Column>

          {/* PLAN */}
          <Column lg={16} md={8} sm={4}>
            <h4 className={styles.sectionFormHeading}>{t('plan', 'Plan')}</h4>
            <div className={styles.formField}>
              <Controller
                name="plan"
                control={control}
                rules={{ required: t('planRequired', 'Plan is required') }}
                render={({ field, fieldState }) => (
                  <TextArea
                    id="plan-textarea"
                    labelText={t('plan', 'Plan *')}
                    placeholder={t('enterPlan', 'Enter plan...')}
                    rows={6}
                    value={typeof field.value === 'string' ? field.value : ''}
                    onChange={(event) => field.onChange(event.target.value)}
                    disabled={!areFieldsEnabled}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                  />
                )}
              />
            </div>
          </Column>

          {/* ACTION */}
          <Column lg={16} md={8} sm={4}>
            <h4 className={styles.sectionFormHeading}>{t('action', 'Action')}</h4>
            <div className={styles.formField}>
              <Controller
                name="action"
                control={control}
                rules={{ required: t('actionRequired', 'Action is required') }}
                render={({ field, fieldState }) => (
                  <Select
                    id="action-select"
                    labelText={t('action', 'Action *')}
                    value={typeof field.value === 'string' ? field.value : ''}
                    onChange={(event) => field.onChange(event.target.value)}
                    disabled={!areFieldsEnabled}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}>
                    <SelectItem value="" text={t('selectAction', 'Select action')} />

                    {actionOptions.map((option) => {
                      const label = option.label;
                      return <SelectItem key={option.value} value={option.value} text={t(label, label)} />;
                    })}
                  </Select>
                )}
              />
            </div>
          </Column>

          {isTerminateActionSelected ? (
            <>
              <Column lg={16} md={8} sm={4}>
                <div className={styles.formField}>
                  <Controller
                    name="terminationReasonType"
                    control={control}
                    rules={{
                      required: t('terminationReasonTypeRequired', 'Termination reason is required'),
                    }}
                    render={({ field, fieldState }) => (
                      <Select
                        id="termination-reason-type"
                        labelText={t('terminationReasonType', 'Termination reason *')}
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(event) => field.onChange(event.target.value)}
                        disabled={!areFieldsEnabled}
                        invalid={!!fieldState.error}
                        invalidText={fieldState.error?.message}>
                        <SelectItem value="" text={t('selectReason', 'Select reason')} />
                        <SelectItem
                          value={LCG_TERMINATION_REASON_WRONG_PATIENT_CONCEPT_UUID}
                          text={t('wrongPatientSelected', 'Wrong patient selected')}
                        />
                        <SelectItem value={LCG_TERMINATION_REASON_OTHER_CONCEPT_UUID} text={t('other', 'Other')} />
                      </Select>
                    )}
                  />
                </div>
              </Column>

              {isOtherTerminationReason ? (
                <Column lg={16} md={8} sm={4}>
                  <div className={styles.formField}>
                    <Controller
                      name="terminationReasonText"
                      control={control}
                      rules={{
                        required: t('terminationReasonTextRequired', 'Please describe the termination reason'),
                      }}
                      render={({ field, fieldState }) => (
                        <TextArea
                          id="termination-reason-text"
                          labelText={t('terminationReasonDetails', 'Reason details *')}
                          rows={3}
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={(event) => field.onChange(event.target.value)}
                          disabled={!areFieldsEnabled}
                          invalid={!!fieldState.error}
                          invalidText={fieldState.error?.message}
                        />
                      )}
                    />
                  </div>
                </Column>
              ) : null}
            </>
          ) : null}
        </Grid>
      </Modal>

      <Modal
        open={consentModalOpen}
        onRequestClose={() => setConsentModalOpen(false)}
        modalHeading={t('consentRequired', 'Informed Consent Required')}
        primaryButtonText={t('acknowledgeAndProceed', 'Acknowledge & Proceed')}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestSubmit={async () => {
          setConsentModalOpen(false);
          if (pendingCleanData) {
            await executeSave(pendingCleanData);
            setPendingCleanData(null);
          }
        }}
        onSecondarySubmit={() => {
          setConsentModalOpen(false);
          setPendingCleanData(null);
        }}
        size="sm">
        <p style={{ marginBottom: '1rem' }}>
          {t(
            'consentReminderForCriticalAction',
            'Reminder: confirm and document informed consent before proceeding with this action.',
          )}
        </p>
        <p style={{ color: 'var(--cds-support-error, #da1e28)', fontWeight: 600 }}>
          {t('consentAcknowledgement', 'This action will stop the monitoring workflow and cannot be undone.')}
        </p>
      </Modal>
    </>
  );
};

export default SharedDecisionMakingForm;
