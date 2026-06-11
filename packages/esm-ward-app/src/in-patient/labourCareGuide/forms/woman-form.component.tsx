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
import {
  getAllowedEmergencyTimes,
  getAllowedPointTimesForSlots,
  getAllowedTimesForSlots,
  formatHHMM,
  getForwardMinutesDelta,
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
  pulse: { min: 20, max: 300, step: 1 },
  systolicBp: { min: 40, max: 320, step: 1 },
  diastolicBp: { min: 30, max: 200, step: 1 },
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
  const [now, setNow] = React.useState(() => new Date());

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
        time: '',
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

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setNow(new Date());
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen]);

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
    if (!baseTime || firstStageSlotCount <= 0 || isSecondStageActive) {
      return null;
    }
    return getStageAwareSlotIndexForTime(baseTime, nowHHMM, firstStageSlotCount, 0);
  }, [baseTime, firstStageSlotCount, isSecondStageActive, nowHHMM]);

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

  const womanOccupiedSlotIndices = React.useMemo(
    () => new Set<number>(womanFilledSlotIndices),
    [womanFilledSlotIndices],
  );

  const availableWomanFirstStageSlotIndices = React.useMemo(() => {
    if (!baseTime || womanCandidateSlotIndex === null || womanCurrentSlotIndex === null) {
      return [] as number[];
    }
    if (womanCurrentSlotIndex < womanCandidateSlotIndex) {
      return [] as number[];
    }
    if (womanOccupiedSlotIndices.has(womanCandidateSlotIndex)) {
      return [] as number[];
    }
    return [womanCandidateSlotIndex];
  }, [baseTime, womanCandidateSlotIndex, womanCurrentSlotIndex, womanOccupiedSlotIndices]);

  const womanSecondStageOccupiedSlots = React.useMemo(() => {
    if (!isSecondStageActive || !secondStageStartTime) {
      return new Set<number>();
    }
    const occupied = new Set<number>();
    existingTimeEntries.forEach((entry) => {
      if (!entry.time) return;
      const elapsed = getForwardMinutesDelta(secondStageStartTime, entry.time);
      if (elapsed === null || elapsed < 0) return;
      occupied.add(Math.floor(elapsed / LCG_WOMAN_SECOND_STAGE_INTERVAL_MINUTES));
    });
    return occupied;
  }, [existingTimeEntries, isSecondStageActive, secondStageStartTime]);

  const allowedTimes = React.useMemo(() => {
    if (isEmergencyMode) {
      return getAllowedEmergencyTimes(now);
    }

    if (isSecondStageActive && secondStageStartTime) {
      const elapsed = getForwardMinutesDelta(secondStageStartTime, nowHHMM);
      if (elapsed === null || elapsed < 0) {
        return [];
      }

      const slotIdx = Math.floor(elapsed / LCG_WOMAN_SECOND_STAGE_INTERVAL_MINUTES);

      if (womanSecondStageOccupiedSlots.has(slotIdx)) {
        return [];
      }

      return getAllowedPointTimesForSlots(secondStageStartTime, [slotIdx], WOMAN_SECOND_STAGE_SLOT_OPTIONS, now);
    }

    if (!baseTime || availableWomanFirstStageSlotIndices.length === 0) {
      return [];
    }

    return getAllowedTimesForSlots(baseTime, availableWomanFirstStageSlotIndices, now);
  }, [
    availableWomanFirstStageSlotIndices,
    baseTime,
    isSecondStageActive,
    nowHHMM,
    now,
    secondStageStartTime,
    womanSecondStageOccupiedSlots,
    isEmergencyMode,
  ]);

  const isWindowLocked = !isEmergencyMode && Boolean(baseTime) && allowedTimes.length === 0;
  const isTimeSelectable = !isWindowLocked;
  const areFieldsEnabled = isTimeSelectable && Boolean(selectedTime);

  const handleFormSubmit = async (data: WomanFormData) => {
    clearErrors();
    setSaveError(null);
    setSaveSuccess(false);

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
      primaryButtonDisabled={isSaving || isWindowLocked || !selectedTime}
      secondaryButtonText={t('cancel', 'Cancel')}
      onRequestSubmit={handleSubmit(handleFormSubmit)}
      onSecondarySubmit={handleClose}
      className={styles.cervixModal}
      size="md">
      {isWindowLocked && baseTime && (
        <InlineNotification
          kind="warning"
          title={t('formLocked', 'Entry Window Closed')}
          subtitle={t('womanWindowLocked', 'No active WOMAN time slot is currently available.')}
          hideCloseButton
        />
      )}

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
                  disabled={!areFieldsEnabled}
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
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
                  disabled={!areFieldsEnabled}
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
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
                  disabled={!areFieldsEnabled}
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
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
                  disabled={!areFieldsEnabled}
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
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
