import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { Modal, Grid, Column, InlineNotification, TextInput } from '@carbon/react';
import { saveLabourTimeSetData, useLabourTimeSetData } from '../resources/labour-time-set-select-setup.resource';
import { isEncounterAfterSessionReset } from '../labour-care-guide.utils';

type LabourTimeSetDataInput = {
  hour: number;
  time: string;
};
import styles from '../partography-data-form.scss';

type TimeFormData = {
  time: string;
};

type TimeFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { hour: number; time: string }) => void;
  onDataSaved?: () => void;
  existingTimeEntries?: Array<{ hour: number; time: string }>;
  patient?: {
    uuid: string;
    name: string;
    gender: string;
    age: string;
  };
  sessionResetAfterMs?: number | null;
};

const TimeForm: React.FC<TimeFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDataSaved,
  existingTimeEntries = [],
  patient,
  sessionResetAfterMs = null,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const formatHHMM = React.useCallback((date: Date) => {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }, []);

  const { labourTimeSetData, mutate: mutateTimeEntries } = useLabourTimeSetData(patient?.uuid ?? '', isOpen);
  const activeLabourTimeSetData = React.useMemo(
    () =>
      labourTimeSetData.filter((entry) => isEncounterAfterSessionReset(entry.encounterDatetime, sessionResetAfterMs)),
    [labourTimeSetData, sessionResetAfterMs],
  );
  const isTimeAlreadySet = (existingTimeEntries?.length ?? 0) > 0 || activeLabourTimeSetData.length > 0;
  const savedBaseTime = React.useMemo(() => {
    if (activeLabourTimeSetData.length > 0) {
      const earliest = [...activeLabourTimeSetData].sort(
        (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
      )[0];

      return earliest?.time ?? '';
    }

    if (!existingTimeEntries || existingTimeEntries.length === 0) {
      return '';
    }

    return existingTimeEntries[0]?.time ?? '';
  }, [existingTimeEntries, activeLabourTimeSetData]);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<TimeFormData>({
    defaultValues: {
      time: '',
    },
  });

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const getDisplayTime = () => (isTimeAlreadySet && savedBaseTime ? savedBaseTime : formatHHMM(new Date()));

    reset({
      time: getDisplayTime(),
    });
    clearErrors();
    setSaveError(null);
    setSaveSuccess(false);

    if (isTimeAlreadySet) {
      return;
    }

    let intervalId: number | undefined;
    const syncDisplayTime = () => {
      setValue('time', formatHHMM(new Date()), { shouldDirty: false, shouldTouch: false });
    };

    const timeoutId = window.setTimeout(
      () => {
        syncDisplayTime();
        intervalId = window.setInterval(syncDisplayTime, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [isOpen, reset, clearErrors, isTimeAlreadySet, savedBaseTime, formatHHMM, setValue]);

  const handleFormSubmit = async (data: TimeFormData) => {
    clearErrors();
    setSaveError(null);
    setSaveSuccess(false);

    if (isTimeAlreadySet) {
      setSaveError(t('timeAlreadySet', 'Time can only be set once'));
      return;
    }

    const currentTime = formatHHMM(new Date());
    if (data.time !== currentTime) {
      setValue('time', currentTime, { shouldDirty: false, shouldTouch: false });
    }

    if (patient?.uuid) {
      setIsSaving(true);
      try {
        const result = await saveLabourTimeSetData(
          patient.uuid,
          {
            hour: 0,
            time: currentTime,
          } as LabourTimeSetDataInput,
          t,
        );

        if (result.success) {
          await mutateTimeEntries();
          setSaveSuccess(true);
          if (onDataSaved) {
            onDataSaved();
          }
          onSubmit({
            hour: 0,
            time: currentTime,
          });
          reset();
          setTimeout(() => {
            setSaveSuccess(false);
            onClose();
          }, 1500);
        } else {
          setSaveError(result.message || t('saveError', 'Failed to save data'));
        }
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : t('saveError', 'Failed to save data'));
      } finally {
        setIsSaving(false);
      }
    } else {
      onSubmit({
        hour: 0,
        time: currentTime,
      });
      reset();
    }
  };

  const handleClose = () => {
    reset();
    clearErrors();
    setSaveError(null);
    setSaveSuccess(false);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onRequestClose={handleClose}
      modalHeading={t('timeInformation', 'Time Information')}
      primaryButtonText={isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
      primaryButtonDisabled={isSaving || isTimeAlreadySet}
      secondaryButtonText={t('cancel', 'Cancel')}
      onRequestSubmit={handleSubmit(handleFormSubmit)}
      onSecondarySubmit={handleClose}
      className={styles.cervixModal}
      size="md">
      {saveSuccess && (
        <InlineNotification
          kind="success"
          title={t('saveSuccess', 'Data saved successfully')}
          subtitle={t('timeDataSaved', 'Time information has been saved')}
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
        <Column lg={12} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="time"
              control={control}
              render={({ field, fieldState }) => (
                <div>
                  <label className={styles.fieldLabel}>{t('time', 'Time')}</label>
                  <TextInput
                    id="time-current"
                    labelText=""
                    value={field.value}
                    readOnly
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                    onChange={() => undefined}
                  />
                </div>
              )}
            />
          </div>
        </Column>
      </Grid>
    </Modal>
  );
};

export default TimeForm;
