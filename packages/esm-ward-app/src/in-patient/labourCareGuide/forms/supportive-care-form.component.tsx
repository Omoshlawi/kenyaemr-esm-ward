import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { Modal, Grid, Column, Select, SelectItem, InlineNotification } from '@carbon/react';
import { SupportiveCareTimePickerDropdown } from './form-scoped-time-pickers.component';
import styles from '../partography-data-form.scss';
import { saveSupportiveCareData, SUPPORTIVE_CARE_OPTIONS } from '../resources/supportive-care.resource';
import {
  getAllowedEmergencyTimes,
  getSlotIndexForTime,
  getSlotState,
  getAllowedTimesForSlots,
  getStageAwareSlotIndexForTime,
} from '../time-slot-utils';

export type SupportiveCareFormData = {
  time: string;
  companion: string;
  painRelief: string;
  oralFluid: string;
  posture: string;
};

export type SupportiveCareFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SupportiveCareFormData) => void;
  onDataSaved?: () => void;
  existingTimeEntries?: Array<{ hour: number; time: string }>;
  baseTime?: string;
  slotCount?: number;
  firstStageSlotCount?: number;
  secondStageSlotCount?: number;
  secondStageStartTime?: string;
  patient?: {
    uuid: string;
    name: string;
    gender: string;
    age: string;
  };
  isEmergencyMode?: boolean;
  emergencyReason?: string;
};

const SupportiveCareForm: React.FC<SupportiveCareFormProps> = ({
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
  patient,
  isEmergencyMode = false,
  emergencyReason,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());

  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<SupportiveCareFormData>({
    defaultValues: { time: '', companion: '', painRelief: '', oralFluid: '', posture: '' },
  });

  const selectedTime = watch('time');

  React.useEffect(() => {
    if (!isOpen) return;
    setNow(new Date());
    const intervalId = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(intervalId);
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen) {
      reset({ time: '', companion: '', painRelief: '', oralFluid: '', posture: '' });
      clearErrors();
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [isOpen, reset, clearErrors]);

  const occupiedSlotIndices = React.useMemo(() => {
    const occupied = new Set<number>();
    if (!baseTime || slotCount === 0) return occupied;
    existingTimeEntries.forEach((entry) => {
      const idx =
        getStageAwareSlotIndexForTime(
          baseTime,
          entry.time,
          firstStageSlotCount || slotCount,
          secondStageSlotCount,
          secondStageStartTime,
        ) ?? getSlotIndexForTime(baseTime, entry.time, slotCount);
      if (idx !== null) occupied.add(idx);
    });
    return occupied;
  }, [baseTime, existingTimeEntries, firstStageSlotCount, secondStageSlotCount, secondStageStartTime, slotCount]);

  const availableSlotIndices = React.useMemo(() => {
    if (!baseTime || slotCount === 0) return [];

    if (secondStageStartTime && secondStageSlotCount > 0 && firstStageSlotCount > 0) {
      const currentSlotIndex = getStageAwareSlotIndexForTime(
        baseTime,
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        firstStageSlotCount,
        secondStageSlotCount,
        secondStageStartTime,
      );

      if (currentSlotIndex !== null && currentSlotIndex >= firstStageSlotCount) {
        const relativeSecondStageIndex = currentSlotIndex - firstStageSlotCount;
        return occupiedSlotIndices.has(currentSlotIndex) ? [] : [relativeSecondStageIndex];
      }
    }

    return Array.from({ length: slotCount }, (_, i) => i).filter((idx) => {
      const isOccupied = occupiedSlotIndices.has(idx);
      if (isOccupied) return false;

      return getSlotState(baseTime, idx, now) === 'active';
    });
  }, [baseTime, firstStageSlotCount, now, occupiedSlotIndices, secondStageSlotCount, secondStageStartTime, slotCount]);

  const allowedTimes = React.useMemo(() => {
    if (isEmergencyMode) {
      return getAllowedEmergencyTimes(now);
    }

    if (secondStageStartTime && secondStageSlotCount > 0 && firstStageSlotCount > 0) {
      const currentSlotIndex = getStageAwareSlotIndexForTime(
        baseTime ?? '',
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        firstStageSlotCount,
        secondStageSlotCount,
        secondStageStartTime,
      );

      if (currentSlotIndex !== null && currentSlotIndex >= firstStageSlotCount) {
        const relativeSecondStageIndex = currentSlotIndex - firstStageSlotCount;
        if (occupiedSlotIndices.has(currentSlotIndex)) {
          return [];
        }

        return getAllowedTimesForSlots(secondStageStartTime, [relativeSecondStageIndex], now);
      }
    }

    if (baseTime && availableSlotIndices.length > 0) {
      return getAllowedTimesForSlots(baseTime, availableSlotIndices, now);
    }
    return [];
  }, [
    availableSlotIndices,
    baseTime,
    firstStageSlotCount,
    isEmergencyMode,
    now,
    occupiedSlotIndices,
    secondStageSlotCount,
    secondStageStartTime,
  ]);

  const isBaseLocked = !isEmergencyMode && (!baseTime || allowedTimes.length === 0);
  const areFieldsEnabled = !isBaseLocked && !!selectedTime;

  const selectedSlotIsOccupied = React.useMemo(() => {
    if (!isEmergencyMode || !selectedTime || !baseTime) return false;
    const idx =
      getStageAwareSlotIndexForTime(
        baseTime,
        selectedTime,
        firstStageSlotCount || slotCount,
        secondStageSlotCount,
        secondStageStartTime,
      ) ?? getSlotIndexForTime(baseTime, selectedTime, slotCount);
    return idx !== null && occupiedSlotIndices.has(idx);
  }, [
    baseTime,
    firstStageSlotCount,
    isEmergencyMode,
    occupiedSlotIndices,
    secondStageSlotCount,
    secondStageStartTime,
    selectedTime,
    slotCount,
  ]);

  const handleFormSubmit = async (data: SupportiveCareFormData) => {
    clearErrors();
    setSaveError(null);

    const slotIndex = getSlotIndexForTime(baseTime!, data.time, slotCount);
    const stageAwareSlotIndex =
      secondStageStartTime && secondStageSlotCount > 0
        ? getStageAwareSlotIndexForTime(
            baseTime!,
            data.time,
            firstStageSlotCount || slotCount,
            secondStageSlotCount,
            secondStageStartTime,
          )
        : slotIndex;
    if (
      !isEmergencyMode &&
      (stageAwareSlotIndex === null ||
        occupiedSlotIndices.has(stageAwareSlotIndex) ||
        getSlotState(
          secondStageStartTime && secondStageSlotCount > 0 && stageAwareSlotIndex >= firstStageSlotCount
            ? secondStageStartTime!
            : baseTime!,
          secondStageStartTime && secondStageSlotCount > 0 && stageAwareSlotIndex >= firstStageSlotCount
            ? stageAwareSlotIndex - firstStageSlotCount
            : stageAwareSlotIndex,
          now,
        ) !== 'active')
    ) {
      setError('time', {
        type: 'manual',
        message: t('slotUnavailable', 'This time slot is either already filled or the entry window has closed.'),
      });
      return;
    }

    const fields: Array<keyof SupportiveCareFormData> = ['companion', 'painRelief', 'oralFluid', 'posture'];
    let hasFieldErrors = false;
    fields.forEach((f) => {
      if (!data[f]) {
        setError(f, { type: 'manual', message: t('required', 'Required') });
        hasFieldErrors = true;
      }
    });

    if (hasFieldErrors) return;

    setIsSaving(true);
    try {
      if (!patient?.uuid) throw new Error('Patient UUID missing');
      const result = await saveSupportiveCareData(patient.uuid, data, t, undefined, undefined, {
        emergencyReason: isEmergencyMode ? emergencyReason : undefined,
      });

      if (!result.success) {
        setSaveError(result.message);
        return;
      }

      setSaveSuccess(true);
      if (onDataSaved) onDataSaved();
      onSubmit(data);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setSaveError(t('saveError', 'Error saving data'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      modalHeading={t('supportiveCareData', 'Supportive Care Data')}
      primaryButtonText={isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
      primaryButtonDisabled={isSaving || !areFieldsEnabled}
      secondaryButtonText={t('cancel', 'Cancel')}
      onRequestSubmit={handleSubmit(handleFormSubmit)}
      onSecondarySubmit={onClose}
      size="md">
      {saveSuccess && <InlineNotification kind="success" title={t('saved', 'Data saved')} hideCloseButton />}
      {saveError && (
        <InlineNotification
          kind="error"
          title={t('error', 'Error')}
          subtitle={saveError}
          onCloseButtonClick={() => setSaveError(null)}
        />
      )}

      {isBaseLocked && baseTime && (
        <InlineNotification
          kind="warning"
          title={t('formLocked', 'Entry Window Closed')}
          subtitle={t('lockedMsg', 'No slots available. Data can only be entered at the exact slot time.')}
          hideCloseButton
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

      {selectedSlotIsOccupied && (
        <InlineNotification
          kind="warning"
          title={t('slotOccupied', 'Time slot already has data')}
          subtitle={t(
            'slotOccupiedMsg',
            'This time slot already contains an entry. The emergency override will record data alongside the existing entry.',
          )}
          hideCloseButton
        />
      )}

      <Grid className={styles.formGrid}>
        <Column lg={12} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="time"
              control={control}
              render={({ field, fieldState }) => (
                <div>
                  <label className={styles.fieldLabel}>{t('time', 'Time')}</label>
                  <SupportiveCareTimePickerDropdown
                    id="supportive-time-picker"
                    value={field.value}
                    onChange={field.onChange}
                    allowedTimes={allowedTimes}
                    currentTime={`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
                      2,
                      '0',
                    )}`}
                    disabled={isBaseLocked}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                    labelText=""
                  />
                </div>
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="companion"
              control={control}
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  id="comp-sel"
                  labelText={t('companion', 'Companion')}
                  disabled={!areFieldsEnabled}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}>
                  <SelectItem value="" text={t('select', 'Select')} />
                  {SUPPORTIVE_CARE_OPTIONS.YES_NO_DECLINED.map((o) => (
                    <SelectItem key={o.value} value={o.value} text={t(o.labelKey, o.defaultLabel)} />
                  ))}
                </Select>
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="painRelief"
              control={control}
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  id="pain-sel"
                  labelText={t('painRelief', 'Pain Relief')}
                  disabled={!areFieldsEnabled}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}>
                  <SelectItem value="" text={t('select', 'Select')} />
                  {SUPPORTIVE_CARE_OPTIONS.YES_NO_DECLINED.map((o) => (
                    <SelectItem key={o.value} value={o.value} text={t(o.labelKey, o.defaultLabel)} />
                  ))}
                </Select>
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="oralFluid"
              control={control}
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  id="oral-sel"
                  labelText={t('oralFluid', 'Oral Fluid')}
                  disabled={!areFieldsEnabled}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}>
                  <SelectItem value="" text={t('select', 'Select')} />
                  {SUPPORTIVE_CARE_OPTIONS.YES_NO_DECLINED.map((o) => (
                    <SelectItem key={o.value} value={o.value} text={t(o.labelKey, o.defaultLabel)} />
                  ))}
                </Select>
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="posture"
              control={control}
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  id="post-sel"
                  labelText={t('posture', 'Posture')}
                  disabled={!areFieldsEnabled}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}>
                  <SelectItem value="" text={t('select', 'Select')} />
                  {SUPPORTIVE_CARE_OPTIONS.POSTURE.map((o) => (
                    <SelectItem key={o.value} value={o.value} text={t(o.labelKey, o.defaultLabel)} />
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

export default SupportiveCareForm;
