import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { Modal, Grid, Column, TextArea, InlineNotification, Select, SelectItem } from '@carbon/react';
import { SharedDecisionTimePickerDropdown } from './form-scoped-time-pickers.component';
import styles from '../partography-data-form.scss';
import { SHARED_DECISION_MAKING_ACTIONS } from '../types';
import { saveSharedDecisionMakingData } from '../resources/shared-decision-making.resource';
import {
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
};

export type SharedDecisionMakingFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SharedDecisionMakingFormData) => void;
  onDataSaved?: () => void;
  autoPromptSummary?: string;
  autoPromptItems?: Array<{ section: string; code: string; guidance: string }>;
  isAutoPrompt?: boolean;
  autoPromptDebugWindow?: {
    triggerTimeMs: number;
    openAtMs: number;
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
  const [now, setNow] = React.useState(() => new Date());
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
  const resolvedFirstStageSlotCount = firstStageSlotCount ?? slotCount;
  const resolvedSecondStageSlotCount = secondStageStartTime ? secondStageSlotCount : 0;

  const { control, handleSubmit, reset, setError, clearErrors, watch } = useForm<SharedDecisionMakingFormData>({
    defaultValues: {
      assessment: '',
      action: '',
      plan: '',
      time: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({ assessment: '', action: '', plan: '', time: '' });
      clearErrors();
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [isOpen, reset, clearErrors]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setNow(new Date());

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
  }, [isOpen]);

  const selectedTime = watch('time');

  const formatDebugTime = React.useCallback((timeMs: number) => {
    if (!Number.isFinite(timeMs)) {
      return '--:--:--';
    }

    const date = new Date(timeMs);
    return date.toLocaleTimeString([], { hour12: false });
  }, []);

  const groupedAutoPromptItems = React.useMemo(() => {
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

    return Array.from(sectionToTokens.entries());
  }, [autoPromptItems]);

  const occupiedAssessmentSlotKeys = React.useMemo(() => {
    const occupiedSlots = new Set<string>();

    if (!baseTime || slotCount === 0) {
      return occupiedSlots;
    }

    for (const entry of existingTimeEntries) {
      const secondarySlotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        entry.time,
        resolvedFirstStageSlotCount,
        resolvedSecondStageSlotCount,
        secondStageStartTime,
        SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS,
      );
      if (secondarySlotIndex !== null) {
        occupiedSlots.add(`secondary-${secondarySlotIndex}`);
      }
    }

    return occupiedSlots;
  }, [
    baseTime,
    existingTimeEntries,
    resolvedFirstStageSlotCount,
    resolvedSecondStageSlotCount,
    secondStageStartTime,
    slotCount,
  ]);

  const occupiedActionPlanSlotKeys = React.useMemo(() => {
    const occupiedSlots = new Set<string>();

    if (!baseTime || slotCount === 0) {
      return occupiedSlots;
    }

    for (const entry of existingTimeEntries) {
      const hourlySlotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        entry.time,
        resolvedFirstStageSlotCount,
        resolvedSecondStageSlotCount,
        secondStageStartTime,
        SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
      );
      if (hourlySlotIndex !== null) {
        occupiedSlots.add(`hourly-${hourlySlotIndex}`);
      }
    }

    return occupiedSlots;
  }, [
    baseTime,
    existingTimeEntries,
    resolvedFirstStageSlotCount,
    resolvedSecondStageSlotCount,
    secondStageStartTime,
    slotCount,
  ]);

  const occupiedHourlySlotIndices = React.useMemo(() => {
    const occupied = new Set<number>();

    if (!baseTime || slotCount === 0) {
      return occupied;
    }

    for (const entry of existingTimeEntries) {
      const slotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        entry.time,
        resolvedFirstStageSlotCount,
        resolvedSecondStageSlotCount,
        secondStageStartTime,
        SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
      );

      if (slotIndex !== null) {
        occupied.add(slotIndex);
      }
    }

    return occupied;
  }, [
    baseTime,
    existingTimeEntries,
    resolvedFirstStageSlotCount,
    resolvedSecondStageSlotCount,
    secondStageStartTime,
    slotCount,
  ]);

  const availableAssessmentSlotKeys = React.useMemo(() => {
    if (!baseTime || slotCount === 0) {
      return [];
    }

    const availableSlots: string[] = [];

    Array.from({ length: resolvedFirstStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
      const secondaryKey = `secondary-${slotIndex}`;
      if (
        !occupiedHourlySlotIndices.has(slotIndex) &&
        !occupiedAssessmentSlotKeys.has(secondaryKey) &&
        getPointSlotState(baseTime, slotIndex, now, SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS) === 'active'
      ) {
        availableSlots.push(secondaryKey);
      }
    });

    if (secondStageStartTime && resolvedSecondStageSlotCount > 0) {
      Array.from({ length: resolvedSecondStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
        const absoluteSlotIndex = resolvedFirstStageSlotCount + slotIndex;
        const secondaryKey = `secondary-${absoluteSlotIndex}`;
        if (
          !occupiedHourlySlotIndices.has(absoluteSlotIndex) &&
          !occupiedAssessmentSlotKeys.has(secondaryKey) &&
          getPointSlotState(secondStageStartTime, slotIndex, now, SHARED_DECISION_ASSESSMENT_SLOT_OPTIONS) === 'active'
        ) {
          availableSlots.push(secondaryKey);
        }
      });
    }

    return availableSlots;
  }, [
    baseTime,
    now,
    occupiedHourlySlotIndices,
    occupiedAssessmentSlotKeys,
    resolvedFirstStageSlotCount,
    resolvedSecondStageSlotCount,
    secondStageStartTime,
    slotCount,
  ]);

  const availableActionPlanSlotKeys = React.useMemo(() => {
    if (!baseTime || slotCount === 0) {
      return [];
    }

    const availableSlots: string[] = [];

    Array.from({ length: resolvedFirstStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
      const hourlyKey = `hourly-${slotIndex}`;
      if (
        !occupiedActionPlanSlotKeys.has(hourlyKey) &&
        getPointSlotState(baseTime, slotIndex, now, SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS) === 'active'
      ) {
        availableSlots.push(hourlyKey);
      }
    });

    if (secondStageStartTime && resolvedSecondStageSlotCount > 0) {
      Array.from({ length: resolvedSecondStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
        const absoluteSlotIndex = resolvedFirstStageSlotCount + slotIndex;
        const hourlyKey = `hourly-${absoluteSlotIndex}`;
        if (
          !occupiedActionPlanSlotKeys.has(hourlyKey) &&
          getPointSlotState(secondStageStartTime, slotIndex, now, SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS) === 'active'
        ) {
          availableSlots.push(hourlyKey);
        }
      });
    }

    return availableSlots;
  }, [
    baseTime,
    now,
    occupiedActionPlanSlotKeys,
    resolvedFirstStageSlotCount,
    resolvedSecondStageSlotCount,
    secondStageStartTime,
    slotCount,
  ]);

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

  const allowedTimes = React.useMemo(() => {
    if (isEmergencyMode) {
      return getAllowedEmergencyTimes(now);
    }

    return Array.from(new Set([...assessmentAllowedTimes, ...actionPlanAllowedTimes])).sort();
  }, [actionPlanAllowedTimes, assessmentAllowedTimes, isEmergencyMode, now]);

  const isInputLocked = !isEmergencyMode && Boolean(baseTime) && allowedTimes.length === 0;
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

      if (!isEmergencyMode && baseTime && slotCount > 0 && !allowedTimes.includes(data.time)) {
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

      const cleanData: SharedDecisionMakingFormData = {
        assessment: data.assessment.trim(),
        action: typeof data.action === 'string' ? data.action : (data.action as any)?.uuid || '',
        plan: data.plan.trim(),
        time: data.time,
      };

      if (criticalActionValues.has(cleanData.action)) {
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
        {isInputLocked && baseTime && (
          <InlineNotification
            kind="warning"
            title={t('formLocked', 'Entry Window Closed')}
            subtitle={t(
              'sharedDecisionWindowLocked',
              'No active shared decision making time slot is currently available.',
            )}
            hideCloseButton
          />
        )}

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

        {groupedAutoPromptItems.length ? (
          <div className={styles.autoPromptSummary}>
            {groupedAutoPromptItems.map(([section, tokens]) => (
              <p key={section} className={styles.autoPromptSummaryRow}>
                <span>{section}: </span>
                {tokens.map((token, index) => (
                  <React.Fragment key={`${section}-${token.code}-${index}`}>
                    <span className={styles.autoPromptToken} title={token.guidance}>
                      {token.code}
                    </span>
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
            {t('autoPromptDebugOpenLabel', 'opens at')} {formatDebugTime(autoPromptDebugWindow.openAtMs)} •{' '}
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
                    !allowedTimes.length || allowedTimes.includes(value) || t('timeNotAllowed', 'Select a valid time'),
                }}
                render={({ field, fieldState }) => (
                  <div>
                    <label className={styles.fieldLabel}>{t('time', 'Time')}</label>
                    <SharedDecisionTimePickerDropdown
                      id="time-picker"
                      labelText=""
                      value={typeof field.value === 'string' ? field.value : ''}
                      onChange={field.onChange}
                      disabled={!isTimeSelectable}
                      existingTimeEntries={existingTimeEntries}
                      allowedTimes={baseTime ? allowedTimes : undefined}
                      currentTime={`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
                        2,
                        '0',
                      )}`}
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
                  <TextArea
                    id="assessment-textarea"
                    labelText={t('assessment', 'Assessment *')}
                    placeholder={t('enterAssessment', 'Enter assessment...')}
                    rows={6}
                    value={typeof field.value === 'string' ? field.value : ''}
                    onChange={(e) => field.onChange(e.target.value)}
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
