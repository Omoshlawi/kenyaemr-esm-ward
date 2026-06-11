import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { Modal, Grid, Column, Select, SelectItem, NumberInput, InlineNotification } from '@carbon/react';
import { ContractionsTimePickerDropdown } from './form-scoped-time-pickers.component';
import styles from '../partography-data-form.scss';

type ContractionsFormData = {
  hour: string;
  time: string;
  contractionsPer10Mins: string;
  durationOfContractions: string;
};

type ContractionsFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ContractionsFormData) => void;
  onDataSaved?: () => void;
  existingTimeEntries?: Array<{ hour: number; time: string }>;
  patient?: {
    uuid: string;
    name: string;
    gender: string;
    age: string;
  };
};

const ContractionsForm: React.FC<ContractionsFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDataSaved,
  existingTimeEntries = [],
  patient,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ContractionsFormData>({
    defaultValues: {
      hour: '',
      time: '',
      contractionsPer10Mins: '',
      durationOfContractions: '',
    },
  });

  // Reset form when it opens
  React.useEffect(() => {
    if (isOpen) {
      reset({
        hour: '',
        time: '',
        contractionsPer10Mins: '',
        durationOfContractions: '',
      });
      clearErrors();
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [isOpen, reset, clearErrors]);

  const generateHourOptions = () => {
    const options = [];
    options.push({ value: '0', label: '0hr' });
    for (let i = 1; i <= 48; i++) {
      const value = (i * 0.5).toString();
      const label = i % 2 === 0 ? `${i / 2}hr` : `${i * 0.5}hr`;
      options.push({ value, label });
    }
    return options;
  };

  const latestHour = React.useMemo(() => {
    if (!existingTimeEntries || existingTimeEntries.length === 0) {
      return null;
    }
    const hours = existingTimeEntries.map((e) => {
      const hourNum = typeof e.hour === 'number' ? e.hour : parseFloat(e.hour);
      return isNaN(hourNum) ? 0 : hourNum;
    });
    return Math.max(...hours);
  }, [existingTimeEntries]);

  const hourOptionsWithDisabled = React.useMemo(() => {
    return generateHourOptions().map((option) => {
      const hourValue = parseFloat(option.value);
      const isDisabled = latestHour !== null && hourValue <= latestHour + 0.001;
      return {
        ...option,
        disabled: isDisabled,
        displayLabel: isDisabled ? `${option.label} (used)` : option.label,
      };
    });
  }, [latestHour]);

  const handleFormSubmit = async (data: ContractionsFormData) => {
    clearErrors();
    setSaveError(null);
    setSaveSuccess(false);

    if (!data.hour) {
      setError('hour', { type: 'manual', message: t('hourRequired', 'Please select a valid hour') });
      return;
    }

    if (!data.time) {
      setError('time', { type: 'manual', message: t('timeRequired', 'Time is required') });
      return;
    }

    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSaveSuccess(true);
      if (onDataSaved) {
        onDataSaved();
      }
      onSubmit(data);
      reset();
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      setSaveError(t('saveError', 'Failed to save data'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    reset();
    clearErrors();
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onRequestClose={handleClose}
      modalHeading={t('contractionsData', 'Labour Progress: Contractions')}
      primaryButtonText={isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
      primaryButtonDisabled={isSaving}
      secondaryButtonText={t('cancel', 'Cancel')}
      onRequestSubmit={handleSubmit(handleFormSubmit)}
      onSecondarySubmit={handleClose}
      className={styles.cervixModal}
      size="md">
      {saveSuccess && (
        <InlineNotification
          kind="success"
          title={t('saveSuccess', 'Data saved successfully')}
          subtitle={t('contractionsDataSaved', 'Contractions data has been saved')}
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

      <Grid className={styles.formGrid}>
        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="hour"
              control={control}
              render={({ field, fieldState }) => (
                <Select
                  id="hour-select"
                  labelText={t('hour', 'Hour *')}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}>
                  <SelectItem value="" text={t('selectHour', 'Select hour')} />
                  {hourOptionsWithDisabled.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.disabled ? '' : option.value}
                      text={option.displayLabel}
                      disabled={option.disabled}
                    />
                  ))}
                </Select>
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="time"
              control={control}
              render={({ field, fieldState }) => (
                <div>
                  <label className={styles.fieldLabel}>{t('time', 'Time')}</label>
                  <ContractionsTimePickerDropdown
                    id="time-picker"
                    labelText=""
                    value={field.value}
                    onChange={field.onChange}
                    existingTimeEntries={existingTimeEntries}
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
              name="contractionsPer10Mins"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="contractions-per-10-mins"
                  label={t('contractionsPer10Mins', 'Contractions per 10 mins')}
                  helperText={t('numericalOnly', 'Numerical entry')}
                  min={0}
                  max={10}
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
              name="durationOfContractions"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="duration-of-contractions"
                  label={t('durationOfContractions', 'Duration of contractions (seconds)')}
                  helperText={t('numericalOnly', 'Numerical entry')}
                  min={0}
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
                />
              )}
            />
          </div>
        </Column>
      </Grid>
    </Modal>
  );
};

export default ContractionsForm;
