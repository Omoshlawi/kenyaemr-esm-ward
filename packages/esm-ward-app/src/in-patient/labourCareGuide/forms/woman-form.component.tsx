import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { Modal, Grid, Column, Select, SelectItem, NumberInput, InlineNotification } from '@carbon/react';
import { WomanTimePickerDropdown } from './form-scoped-time-pickers.component';
import styles from '../partography-data-form.scss';
import {
  LCG_WOMAN_INTERVAL_MINUTES,
  LCG_WOMAN_SECOND_STAGE_INTERVAL_MINUTES,
  LCG_TIME_INCREMENT_MINUTES,
} from '../types';
import { useLcgFormClock } from '../hooks/use-lcg-form-clock';
import {
  getAllowedEmergencyTimes,
  getAllowedPointTimesForSlots,
  getAllowedTimesForSlots,
  formatHHMM,
  getForwardMinutesDelta,
  getSlotState,
  getStageAwareSlotIndexForTime,
  parseHHMMToMinutes,
} from '../time-slot-utils';

type WomanFormData = {
  time: string;
  pulse: string;
  systolicBp: string;
  diastolicBp: string;
  temperature: string;
  protein: string;
  acetone: string;
};

type WomanFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WomanFormData) => void | Promise<void>;
  onDataSaved?: () => void;
  existingTimeEntries?: Array<{ hour: number; time: string }>;
  baseTime?: string;
  slotCount?: number;
  firstStageSlotCount?: number;
  secondStageSlotCount?: number;
  secondStageStartTime?: string;
  lastObservationTime?: string;
  intervalMinutes?: number;
  patient?: {
    uuid: string;
    name: string;
    gender: string;
    age: string;
  };
  isEmergencyMode?: boolean;
  emergencyReason?: string;
};

const WOMAN_FIELD_RANGES = {
  pulse: { min: 0, max: 300, step: 1 },
  systolicBp: { min: 0, max: 320, step: 1 },
  diastolicBp: { min: 0, max: 200, step: 1 },
  temperature: { min: 25.0, max: 45.0, step: 0.1 },
} as const;

const WOMAN_SECOND_STAGE_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_WOMAN_SECOND_STAGE_INTERVAL_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_WOMAN_SECOND_STAGE_INTERVAL_MINUTES - 1,
};

const WomanForm: React.FC<WomanFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDataSaved,
  existingTimeEntries = [],
  baseTime,
  slotCount = 0,
  firstStageSlotCount = 0,
  secondStageSlotCount = 0,
  secondStageStartTime,
  lastObservationTime,
  intervalMinutes = LCG_WOMAN_INTERVAL_MINUTES,
  patient,
  isEmergencyMode = false,
  emergencyReason,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const now = useLcgFormClock(isOpen);

  const { control, handleSubmit, reset, setError, clearErrors, watch } = useForm<WomanFormData>({
    defaultValues: {
      time: '',
      pulse: '',
      systolicBp: '',
      diastolicBp: '',
      temperature: '',
      protein: '',
      acetone: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({
        time: formatHHMM(new Date()),
        pulse: '',
        systolicBp: '',
        diastolicBp: '',
        temperature: '',
        protein: '',
        acetone: '',
      });
      clearErrors();
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [isOpen, reset, clearErrors]);

  const selectedTime = watch('time');

  const nowHHMM = formatHHMM(now);

  const isSecondStageActive = React.useMemo(() => {
    if (!baseTime || !secondStageStartTime || firstStageSlotCount <= 0 || secondStageSlotCount <= 0) {
      return false;
    }

    const secondStageStartFromBase = getForwardMinutesDelta(baseTime, secondStageStartTime);
    const nowFromBase = getForwardMinutesDelta(baseTime, nowHHMM);

    if (secondStageStartFromBase === null || nowFromBase === null) {
      return false;
    }

    const secondStageSpanMinutes = secondStageSlotCount * LCG_WOMAN_SECOND_STAGE_INTERVAL_MINUTES;
    return nowFromBase >= secondStageStartFromBase && nowFromBase < secondStageStartFromBase + secondStageSpanMinutes;
  }, [baseTime, firstStageSlotCount, nowHHMM, secondStageSlotCount, secondStageStartTime]);

  const womanFilledSlotIndices = React.useMemo(() => {
    if (!baseTime || firstStageSlotCount <= 0) {
      return [] as number[];
    }
    const filled = new Set<number>();
    existingTimeEntries.forEach((entry) => {
      if (!entry.time) return;
      const slotIndex = getStageAwareSlotIndexForTime(baseTime, entry.time, firstStageSlotCount, 0);
      if (slotIndex !== null && slotIndex >= 0 && slotIndex < firstStageSlotCount) {
        filled.add(slotIndex);
      }
    });
    return Array.from(filled).sort((a, b) => a - b);
  }, [baseTime, existingTimeEntries, firstStageSlotCount]);

  const womanIntervalSlots = React.useMemo(
    () => Math.max(1, Math.round(LCG_WOMAN_INTERVAL_MINUTES / LCG_TIME_INCREMENT_MINUTES)),
    [],
  );

  const womanCurrentSlotIndex = React.useMemo(() => {
    if (!baseTime || firstStageSlotCount <= 0) {
      return null;
    }
    return getStageAwareSlotIndexForTime(baseTime, nowHHMM, firstStageSlotCount, 0);
  }, [baseTime, firstStageSlotCount, nowHHMM]);

  const womanCandidateSlotIndex = React.useMemo(() => {
    if (womanCurrentSlotIndex === null || firstStageSlotCount <= 0) {
      return null;
    }
    if (womanFilledSlotIndices.length === 0) {
      return Math.min(womanCurrentSlotIndex, firstStageSlotCount - 1);
    }
    const latestFilled = Math.max(...womanFilledSlotIndices);
    const nextDue = latestFilled + womanIntervalSlots;
    const candidate = womanCurrentSlotIndex < nextDue ? nextDue : womanCurrentSlotIndex;
    if (candidate < 0 || candidate >= firstStageSlotCount) {
      return null;
    }
    return candidate;
  }, [firstStageSlotCount, womanCurrentSlotIndex, womanFilledSlotIndices, womanIntervalSlots]);

  const availableWomanFirstStageSlotIndices = React.useMemo(() => {
    if (!baseTime || womanCurrentSlotIndex === null || firstStageSlotCount <= 0) {
      return [] as number[];
    }

    // Multi-entry: keep the currently active slot open even after a prior submission in the same window.
    if (getSlotState(baseTime, womanCurrentSlotIndex, now) === 'active') {
      return [womanCurrentSlotIndex];
    }

    if (womanCandidateSlotIndex === null || womanCurrentSlotIndex < womanCandidateSlotIndex) {
      return [] as number[];
    }

    return [womanCandidateSlotIndex];
  }, [baseTime, firstStageSlotCount, now, womanCandidateSlotIndex, womanCurrentSlotIndex]);

  const slotAllowedTimes = React.useMemo(() => {
    if (isEmergencyMode) {
      return getAllowedEmergencyTimes(now);
    }

    const times = new Set<string>();

    if (baseTime && availableWomanFirstStageSlotIndices.length > 0) {
      getAllowedTimesForSlots(baseTime, availableWomanFirstStageSlotIndices, now).forEach((time) => times.add(time));
    }

    if (isSecondStageActive && secondStageStartTime) {
      const elapsed = getForwardMinutesDelta(secondStageStartTime, nowHHMM);
      if (elapsed !== null && elapsed >= 0) {
        const slotIdx = Math.floor(elapsed / LCG_WOMAN_SECOND_STAGE_INTERVAL_MINUTES);

        getAllowedPointTimesForSlots(secondStageStartTime, [slotIdx], WOMAN_SECOND_STAGE_SLOT_OPTIONS, now).forEach(
          (time) => times.add(time),
        );
      }
    }

    return Array.from(times).sort();
  }, [
    availableWomanFirstStageSlotIndices,
    baseTime,
    isEmergencyMode,
    isSecondStageActive,
    now,
    nowHHMM,
    secondStageStartTime,
  ]);

  const displayAllowedTimes = React.useMemo(() => {
    if (slotAllowedTimes.length > 0) {
      return slotAllowedTimes;
    }
    return nowHHMM ? [nowHHMM] : [];
  }, [nowHHMM, slotAllowedTimes]);

  const areFieldsEnabled =
    (isEmergencyMode || slotAllowedTimes.length > 0 || displayAllowedTimes.length > 0) && Boolean(selectedTime);

  const handleFormSubmit = async (data: WomanFormData) => {
    clearErrors();
    setSaveError(null);
    setSaveSuccess(false);

    if (!data.time) {
      setError('time', { type: 'manual', message: t('timeRequired', 'Time is required') });
      return;
    }

    if (
      !isEmergencyMode &&
      baseTime &&
      slotCount > 0 &&
      !slotAllowedTimes.includes(data.time) &&
      !displayAllowedTimes.includes(data.time)
    ) {
      setError('time', {
        type: 'manual',
        message: t('timeNotAllowed', 'Select a valid time slot'),
      });
      return;
    }

    const validateRange = (
      field: keyof Pick<WomanFormData, 'pulse' | 'systolicBp' | 'diastolicBp' | 'temperature'>,
      label: string,
      min: number,
      max: number,
    ) => {
      const raw = data[field];
      if (!raw) {
        return true;
      }

      const value = Number(raw);
      if (!Number.isFinite(value) || value < min || value > max) {
        setError(field, {
          type: 'manual',
          message: t('fieldRangeError', `${label} must be between ${min} and ${max}`),
        });
        return false;
      }

      return true;
    };

    const isPulseValid = validateRange(
      'pulse',
      t('pulse', 'Pulse'),
      WOMAN_FIELD_RANGES.pulse.min,
      WOMAN_FIELD_RANGES.pulse.max,
    );
    const isSystolicValid = validateRange(
      'systolicBp',
      t('systolicBp', 'Systolic BP'),
      WOMAN_FIELD_RANGES.systolicBp.min,
      WOMAN_FIELD_RANGES.systolicBp.max,
    );
    const isDiastolicValid = validateRange(
      'diastolicBp',
      t('diastolicBp', 'Diastolic BP'),
      WOMAN_FIELD_RANGES.diastolicBp.min,
      WOMAN_FIELD_RANGES.diastolicBp.max,
    );
    const isTemperatureValid = validateRange(
      'temperature',
      t('temperature', 'Temperature'),
      WOMAN_FIELD_RANGES.temperature.min,
      WOMAN_FIELD_RANGES.temperature.max,
    );

    if (!isPulseValid || !isSystolicValid || !isDiastolicValid || !isTemperatureValid) {
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(data);

      setSaveSuccess(true);
      if (onDataSaved) {
        onDataSaved();
      }
      reset();
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message ? error.message : t('saveError', 'Failed to save data');
      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    reset();
    clearErrors();
    onClose();
  };

  const proteinOptions = [
    { value: 'P-', label: 'P-' },
    { value: 'P+', label: 'P+' },
    { value: 'P++', label: 'P++' },
    { value: 'P+++', label: 'P+++' },
    { value: 'ND', label: 'ND' },
  ];

  const acetoneOptions = [
    { value: 'A', label: 'A' },
    { value: 'A+', label: 'A+' },
    { value: 'A++', label: 'A++' },
    { value: 'A+++', label: 'A+++' },
    { value: 'ND', label: 'ND' },
  ];

  return (
    <Modal
      open={isOpen}
      onRequestClose={handleClose}
      modalHeading={t('womanWellBeingData', 'Woman Well Being Data')}
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
          subtitle={t('womanDataSaved', 'Woman well-being data has been saved')}
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

      <Grid className={styles.formGrid}>
        <Column lg={12} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="time"
              control={control}
              render={({ field, fieldState }) => (
                <div>
                  <label className={styles.fieldLabel}>{t('time', 'Time')}</label>
                  <WomanTimePickerDropdown
                    id="time-picker"
                    labelText=""
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!baseTime}
                    existingTimeEntries={existingTimeEntries}
                    allowedTimes={baseTime ? displayAllowedTimes : undefined}
                    disablePastTimes={!isEmergencyMode}
                    currentTime={nowHHMM}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                  />
                </div>
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="pulse"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="pulse"
                  label={t('pulse', 'Pulse')}
                  min={WOMAN_FIELD_RANGES.pulse.min}
                  max={WOMAN_FIELD_RANGES.pulse.max}
                  step={WOMAN_FIELD_RANGES.pulse.step}
                  allowEmpty
                  disabled={!areFieldsEnabled}
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
                  invalidText={t(
                    'pulseRange',
                    `Pulse must be between ${WOMAN_FIELD_RANGES.pulse.min} and ${WOMAN_FIELD_RANGES.pulse.max}`,
                  )}
                />
              )}
            />
          </div>
        </Column>

        <Column lg={4} md={2} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="systolicBp"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="systolic-bp"
                  label={t('systolicBp', 'Systolic BP')}
                  min={WOMAN_FIELD_RANGES.systolicBp.min}
                  max={WOMAN_FIELD_RANGES.systolicBp.max}
                  step={WOMAN_FIELD_RANGES.systolicBp.step}
                  allowEmpty
                  disabled={!areFieldsEnabled}
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
                  invalidText={t(
                    'systolicRange',
                    `Systolic BP must be between ${WOMAN_FIELD_RANGES.systolicBp.min} and ${WOMAN_FIELD_RANGES.systolicBp.max}`,
                  )}
                />
              )}
            />
          </div>
        </Column>

        <Column lg={4} md={2} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="diastolicBp"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="diastolic-bp"
                  label={t('diastolicBp', 'Diastolic BP')}
                  min={WOMAN_FIELD_RANGES.diastolicBp.min}
                  max={WOMAN_FIELD_RANGES.diastolicBp.max}
                  step={WOMAN_FIELD_RANGES.diastolicBp.step}
                  allowEmpty
                  disabled={!areFieldsEnabled}
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
                  invalidText={t(
                    'diastolicRange',
                    `Diastolic BP must be between ${WOMAN_FIELD_RANGES.diastolicBp.min} and ${WOMAN_FIELD_RANGES.diastolicBp.max}`,
                  )}
                />
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="temperature"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="temperature"
                  label={t('temperature', 'Temperature')}
                  min={WOMAN_FIELD_RANGES.temperature.min}
                  max={WOMAN_FIELD_RANGES.temperature.max}
                  step={WOMAN_FIELD_RANGES.temperature.step}
                  allowEmpty
                  disabled={!areFieldsEnabled}
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
                  invalidText={t(
                    'temperatureRange',
                    `Temperature must be between ${WOMAN_FIELD_RANGES.temperature.min} and ${WOMAN_FIELD_RANGES.temperature.max}`,
                  )}
                />
              )}
            />
          </div>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <h4 className={styles.fieldLabel} style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
            {t('urineTest', 'Urine Test')}
          </h4>
        </Column>

        <Column lg={8} md={4} sm={4}>
          <div className={styles.formField}>
            <Controller
              name="protein"
              control={control}
              render={({ field }) => (
                <Select
                  id="protein"
                  labelText={t('protein', 'Protein')}
                  disabled={!areFieldsEnabled}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}>
                  <SelectItem value="" text={t('selectOption', 'Select')} />
                  {proteinOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} text={opt.label} />
                  ))}
                </Select>
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={4}>
          <div className={styles.formField}>
            <Controller
              name="acetone"
              control={control}
              render={({ field }) => (
                <Select
                  id="acetone"
                  labelText={t('acetone', 'Acetone')}
                  disabled={!areFieldsEnabled}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}>
                  <SelectItem value="" text={t('selectOption', 'Select')} />
                  {acetoneOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} text={opt.label} />
                  ))}
                </Select>
              )}
            />
          </div>
        </Column>
      </Grid>
    </Modal>
  );
};

export default WomanForm;
