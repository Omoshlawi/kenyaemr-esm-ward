import {
  Button,
  ButtonSet,
  ComboBox,
  Dropdown,
  Form,
  InlineNotification,
  Layer,
  RadioButton,
  RadioButtonGroup,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatDate,
  getPatientName,
  restBaseUrl,
  showSnackbar,
  useConfig,
  useSession,
  useVisit,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { type WardConfigObject } from '../../config-schema';
import { saveNursingCardexEncounter, useActiveNursingOrders, type OrderOption } from './nursing-cardex-plan.resource';
import { buildNursingCardexEncounterPayload } from './nursing-cardex-payload-builder';
import { useNursingCardexFormSchema, type CardexFormValues, type CardexRow } from './use-nursing-cardex-form-schema';
import styles from './nursing-cardex-plan.workspace.scss';

export type NursingCardexPlanWorkspaceProps = {
  patientUuid: string;
  patient: Record<string, unknown>;
};

type MedicationRow = {
  name: string;
  time: string;
  orderUuid?: string;
};

type FluidRow = {
  name: string;
  time: string;
  orderUuid?: string;
};

type RowField = { id: string };

const NursingCardexPlanWorkspace: React.FC<
  Workspace2DefinitionProps<NursingCardexPlanWorkspaceProps, object, object>
> = ({ closeWorkspace, workspaceProps }) => {
  const { patientUuid, patient } = workspaceProps || {};
  const { t } = useTranslation();
  const { mutate: mutateCache } = useSWRConfig();
  const { sessionLocation, currentProvider } = useSession();
  const { currentVisit } = useVisit(patientUuid ?? '');
  const { nursingCardex } = useConfig<WardConfigObject>();
  const today = useMemo(() => formatDate(new Date(), { mode: 'wide', time: false }), []);
  const patientName = useMemo(() => getPatientName(patient as any) || patientUuid || '', [patient, patientUuid]);
  const currentTimeMax = useMemo(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }, []);
  const { currentHour, currentMinute } = useMemo(() => {
    const [hour, minute] = currentTimeMax.split(':').map(Number);
    return {
      currentHour: Number.isNaN(hour) ? 0 : hour,
      currentMinute: Number.isNaN(minute) ? 0 : minute,
    };
  }, [currentTimeMax]);
  const hourOptions = useMemo(() => {
    const totalHoursToShow = Math.min(currentHour + 1, 12);
    return Array.from({ length: totalHoursToShow }, (_, index) => String(currentHour - index).padStart(2, '0'));
  }, [currentHour]);
  const getMinuteOptionsForHour = useCallback(
    (hourValue: string) => {
      const selectedHour = Number(hourValue);
      const maxMinute = selectedHour === currentHour ? currentMinute : 59;
      return Array.from({ length: maxMinute + 1 }, (_, index) => String(maxMinute - index).padStart(2, '0'));
    },
    [currentHour, currentMinute],
  );
  const NURSING_CONCEPTS = nursingCardex?.concepts;
  const FORM_FIELD_PATHS = nursingCardex?.formFieldPaths;
  const ENCOUNTER_ROLE_UUID = nursingCardex?.encounterRoleUuid;

  const cardexSchema = useNursingCardexFormSchema(currentTimeMax, t);

  const {
    options: activeOrderOptions,
    byUuid: activeOrdersByUuid,
    byName: activeOrdersByName,
    isLoading: isLoadingActiveOrders,
  } = useActiveNursingOrders(patientUuid);

  const {
    control,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<CardexFormValues>({
    resolver: zodResolver(cardexSchema),
    mode: 'onChange',
    defaultValues: {
      nursingNotes: '',
      medicationAdministered: '',
      medicationRows: [],
      fluidsAdministered: '',
      fluidRows: [],
    },
  });

  const {
    fields: medicationFields,
    append: appendMedication,
    remove: removeMedication,
    replace: replaceMedication,
    update: updateMedication,
  } = useFieldArray({
    control,
    name: 'medicationRows',
  });

  const {
    fields: fluidFields,
    append: appendFluid,
    remove: removeFluid,
    replace: replaceFluid,
    update: updateFluid,
  } = useFieldArray({
    control,
    name: 'fluidRows',
  });

  const nursingNotes = useWatch({ control, name: 'nursingNotes' }) ?? '';
  const medicationAdministered = useWatch({ control, name: 'medicationAdministered' }) ?? '';
  const watchedMedicationRows = useWatch({ control, name: 'medicationRows' });
  const medicationRows = useMemo(() => watchedMedicationRows ?? [], [watchedMedicationRows]);
  const fluidsAdministered = useWatch({ control, name: 'fluidsAdministered' }) ?? '';
  const watchedFluidRows = useWatch({ control, name: 'fluidRows' });
  const fluidRows = useMemo(() => watchedFluidRows ?? [], [watchedFluidRows]);
  const [isSubmittingEncounter, setIsSubmittingEncounter] = useState(false);
  const initialRouteRef = useRef<string>(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  const initialPatientUuidRef = useRef<string | undefined>(patientUuid);
  const hasAutoClosedRef = useRef(false);

  useEffect(() => {
    if (hasAutoClosedRef.current) return;

    if (!patientUuid) {
      hasAutoClosedRef.current = true;
      closeWorkspace({ discardUnsavedChanges: true });
      return;
    }

    if (initialPatientUuidRef.current && patientUuid !== initialPatientUuidRef.current) {
      hasAutoClosedRef.current = true;
      closeWorkspace({ discardUnsavedChanges: true });
    }
  }, [closeWorkspace, patientUuid]);

  useEffect(() => {
    const closeOnRouteChange = () => {
      if (hasAutoClosedRef.current) return;

      const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentRoute !== initialRouteRef.current) {
        hasAutoClosedRef.current = true;
        closeWorkspace({ discardUnsavedChanges: true });
      }
    };

    const handleLocationChange = () => closeOnRouteChange();
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      window.dispatchEvent(new Event('locationchange'));
      return result;
    };

    window.history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      window.dispatchEvent(new Event('locationchange'));
      return result;
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('locationchange', handleLocationChange);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('locationchange', handleLocationChange);
    };
  }, [closeWorkspace]);

  const handleMedicationAdministeredChange = useCallback(
    (value: string) => {
      if (value === 'no' && medicationAdministered === 'yes') {
        const hasEnteredMedicationData = medicationRows.some((row: CardexRow) => row.name?.trim() || row.time?.trim());
        if (hasEnteredMedicationData) {
          const shouldClear = window.confirm(
            t(
              'confirmMedicationClear',
              'Changing to No will discard entered medication rows. Do you want to continue?',
            ),
          );
          if (!shouldClear) {
            return;
          }
        }
      }

      setValue('medicationAdministered', value as CardexFormValues['medicationAdministered'], {
        shouldDirty: true,
        shouldValidate: true,
      });
      clearErrors('medicationRows');

      if (value === 'yes' && medicationRows.length === 0) {
        appendMedication({ name: '', time: currentTimeMax, orderUuid: undefined });
        return;
      }

      if (value !== 'yes') {
        replaceMedication([]);
      }
    },
    [
      appendMedication,
      clearErrors,
      currentTimeMax,
      medicationAdministered,
      medicationRows,
      replaceMedication,
      setValue,
      t,
    ],
  );

  const handleFluidsAdministeredChange = useCallback(
    (value: string) => {
      if (value === 'no' && fluidsAdministered === 'yes') {
        const hasEnteredFluidData = fluidRows.some((row: CardexRow) => row.name?.trim() || row.time?.trim());
        if (hasEnteredFluidData) {
          const shouldClear = window.confirm(
            t('confirmFluidClear', 'Changing to No will discard entered fluid rows. Do you want to continue?'),
          );
          if (!shouldClear) {
            return;
          }
        }
      }

      setValue('fluidsAdministered', value as CardexFormValues['fluidsAdministered'], {
        shouldDirty: true,
        shouldValidate: true,
      });
      clearErrors('fluidRows');

      if (value === 'yes' && fluidRows.length === 0) {
        appendFluid({ name: '', time: currentTimeMax, orderUuid: undefined });
        return;
      }

      // Reset rows when toggled away from Yes so a new Yes starts fresh.
      if (value !== 'yes') {
        replaceFluid([]);
      }
    },
    [appendFluid, clearErrors, currentTimeMax, fluidRows, fluidsAdministered, replaceFluid, setValue, t],
  );

  const onSubmit = useCallback(
    async (values: CardexFormValues) => {
      if (
        !patientUuid ||
        !sessionLocation?.uuid ||
        !currentProvider?.uuid ||
        !currentVisit?.uuid ||
        !NURSING_CONCEPTS ||
        !FORM_FIELD_PATHS ||
        !ENCOUNTER_ROLE_UUID
      ) {
        showSnackbar({
          title: t('missingContext', 'Missing context'),
          kind: 'error',
          subtitle: t(
            'missingContextDescription',
            'Cannot save: patient, location, provider, active visit, or cardex config is missing.',
          ),
        });
        return;
      }

      clearErrors(['medicationRows', 'fluidRows']);

      const encounterPayload = buildNursingCardexEncounterPayload({
        values,
        patientUuid,
        currentVisitUuid: currentVisit.uuid,
        sessionLocationUuid: sessionLocation.uuid,
        currentProviderUuid: currentProvider.uuid,
        encounterRoleUuid: ENCOUNTER_ROLE_UUID,
        concepts: NURSING_CONCEPTS,
        formFieldPaths: FORM_FIELD_PATHS,
        activeOrdersByUuid,
        activeOrdersByName,
      });

      try {
        setIsSubmittingEncounter(true);
        await saveNursingCardexEncounter(encounterPayload);
        const treatmentChartKeyPrefix = `${restBaseUrl}/encounter?patient=${patientUuid}`;
        mutateCache((key) => typeof key === 'string' && key.startsWith(treatmentChartKeyPrefix), undefined, {
          revalidate: true,
        });

        showSnackbar({
          title: t('cardexSaved', 'Cardex nursing plan saved'),
          kind: 'success',
          subtitle: t('cardexSavedDescription', 'Encounter posted successfully.'),
        });
        closeWorkspace({ discardUnsavedChanges: true });
      } catch (error) {
        showSnackbar({
          title: t('failedToSaveCardex', 'Failed to save cardex nursing plan'),
          kind: 'error',
          subtitle:
            error instanceof Error ? error.message : t('unexpectedError', 'An unexpected error occurred while saving.'),
        });
      } finally {
        setIsSubmittingEncounter(false);
      }
    },
    [
      patientUuid,
      sessionLocation?.uuid,
      currentProvider?.uuid,
      currentVisit?.uuid,
      activeOrdersByUuid,
      activeOrdersByName,
      NURSING_CONCEPTS,
      FORM_FIELD_PATHS,
      ENCOUNTER_ROLE_UUID,
      closeWorkspace,
      clearErrors,
      setIsSubmittingEncounter,
      mutateCache,
      t,
    ],
  );

  const handleSave = handleSubmit(onSubmit);

  const renderAdministrationRowsBlock = ({
    blockClassName,
    rowStackClassName,
    nameFieldClassName,
    timeFieldClassName,
    title,
    errorMessage,
    clearError,
    fields,
    rows,
    idPrefix,
    nameLabel,
    loadingLabel,
    emptyLabel,
    updateRow,
    removeRow,
    addRow,
  }: {
    blockClassName: string;
    rowStackClassName: string;
    nameFieldClassName: string;
    timeFieldClassName: string;
    title: string;
    errorMessage?: string;
    clearError: () => void;
    fields: RowField[];
    rows: Array<MedicationRow | FluidRow>;
    idPrefix: string;
    nameLabel: string;
    loadingLabel: string;
    emptyLabel: string;
    updateRow: (index: number, row: MedicationRow | FluidRow) => void;
    removeRow: (index: number) => void;
    addRow: () => void;
  }) => (
    <div className={blockClassName}>
      <h5>{title}</h5>
      {errorMessage && (
        <InlineNotification kind="error" title={t('error', 'Error')} subtitle={errorMessage} onClose={clearError} />
      )}
      <Stack gap={4}>
        {fields.map((field, index) => {
          const row = rows[index] ?? { name: '', time: '', orderUuid: undefined };
          const [rowHourCandidate, rowMinuteCandidate] = (row.time || currentTimeMax).split(':');
          const selectedHour = hourOptions.includes(rowHourCandidate) ? rowHourCandidate : (hourOptions[0] ?? '00');
          const minuteOptions = getMinuteOptionsForHour(selectedHour);
          const selectedMinute = minuteOptions.includes(rowMinuteCandidate)
            ? rowMinuteCandidate
            : (minuteOptions[0] ?? '00');

          return (
            <Stack key={field.id} gap={3} className={rowStackClassName}>
              <Layer className={nameFieldClassName}>
                <ComboBox
                  id={`${idPrefix}-name-${field.id}`}
                  titleText={nameLabel}
                  placeholder={isLoadingActiveOrders ? loadingLabel : emptyLabel}
                  items={activeOrderOptions}
                  itemToString={(item: OrderOption | null) => item?.label ?? ''}
                  selectedItem={
                    activeOrderOptions.find((option) => option.id === row.orderUuid) ??
                    activeOrderOptions.find((option) => option.label === row.name) ??
                    null
                  }
                  onInputChange={(value) => {
                    clearError();
                    updateRow(index, {
                      ...row,
                      name: String(value ?? ''),
                      orderUuid: undefined,
                    });
                  }}
                  onChange={({ selectedItem }) => {
                    clearError();
                    updateRow(index, {
                      ...row,
                      name: selectedItem?.label ?? row.name,
                      orderUuid: selectedItem?.id ?? row.orderUuid,
                    });
                  }}
                  disabled={isLoadingActiveOrders}
                />
              </Layer>
              <Layer className={timeFieldClassName}>
                <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
                  <Dropdown
                    id={`${idPrefix}-hour-${field.id}`}
                    titleText={t('hour', 'Hour')}
                    label={t('selectHour', 'Select hour')}
                    items={hourOptions}
                    itemToString={(item: string | null) => item ?? ''}
                    selectedItem={selectedHour}
                    onChange={({ selectedItem }) => {
                      if (!selectedItem) {
                        return;
                      }

                      clearError();
                      const nextMinuteOptions = getMinuteOptionsForHour(selectedItem);
                      const nextMinute = nextMinuteOptions.includes(selectedMinute)
                        ? selectedMinute
                        : (nextMinuteOptions[0] ?? '00');
                      updateRow(index, { ...row, time: `${selectedItem}:${nextMinute}` });
                    }}
                  />
                  <Dropdown
                    id={`${idPrefix}-minute-${field.id}`}
                    titleText={t('minute', 'Minute')}
                    label={t('selectMinute', 'Select minute')}
                    items={minuteOptions}
                    itemToString={(item: string | null) => item ?? ''}
                    selectedItem={selectedMinute}
                    onChange={({ selectedItem }) => {
                      if (!selectedItem) {
                        return;
                      }

                      clearError();
                      updateRow(index, { ...row, time: `${selectedHour}:${selectedItem}` });
                    }}
                  />
                </div>
              </Layer>
              <Button kind="danger" onClick={() => removeRow(index)}>
                {t('remove', 'Remove')}
              </Button>
            </Stack>
          );
        })}
      </Stack>
      <Button kind="tertiary" renderIcon={Add} onClick={addRow}>
        {t('addRowEntry', '+ Add')}
      </Button>
    </div>
  );

  return (
    <Workspace2 title={t('nursingCardexPlanForm', 'Nursing Cardex Plan Form')}>
      <div className={styles.workspaceShell}>
        <Form
          aria-label={t('nursingCardexPlanForm', 'Nursing Cardex Plan Form')}
          className={styles.form}
          onSubmit={handleSave}>
          <div className={styles.formContent}>
            <Stack gap={6}>
              {/* Visit Details Section */}
              <section className={styles.formSection}>
                <h4>{t('visitDetails', 'Visit Details')}</h4>
                <div className={styles.twoColumnGrid}>
                  <Layer>
                    <TextInput id="visit-date" labelText={t('visitDate', 'Visit date')} value={today} readOnly />
                  </Layer>
                  <Layer>
                    <TextInput
                      id="patient-name"
                      labelText={t('patientName', 'Patient name')}
                      value={patientName}
                      readOnly
                    />
                  </Layer>
                </div>
              </section>

              {/* Nursing Detailed Notes Section */}
              <section className={styles.formSection}>
                <h4>{t('nursingDetailedNotes', 'Nursing Detailed Notes')}</h4>
                <Stack gap={4}>
                  <Layer className={styles.notesField}>
                    <label className={styles.notesLabel} htmlFor="nursing-notes">
                      {t('clinicalActionProgressNotes', 'Clinical Action Progress Notes')}
                    </label>
                    <p className={styles.notesHelperText}>
                      {t(
                        'notesHelperText',
                        'Document the assessment, complaints, treatment updates, and shift observations.',
                      )}
                    </p>
                    <TextArea
                      id="nursing-notes"
                      hideLabel
                      labelText={t('clinicalActionProgressNotes', 'Clinical Action Progress Notes')}
                      placeholder={t(
                        'notesPlaceholder',
                        'Enter structural physical evaluations, patient complaints, or general nursing shift updates',
                      )}
                      value={nursingNotes}
                      onChange={(e) => {
                        setValue('nursingNotes', e.target.value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      rows={8}
                      className={
                        errors.nursingNotes ? `${styles.notesTextArea} ${styles.textAreaError}` : styles.notesTextArea
                      }
                    />
                  </Layer>
                  {errors.nursingNotes?.message && (
                    <InlineNotification
                      kind="error"
                      title={t('error', 'Error')}
                      subtitle={errors.nursingNotes.message}
                      onClose={() => clearErrors('nursingNotes')}
                    />
                  )}

                  {/* Medication Administered Section */}
                  <Layer>
                    <RadioButtonGroup
                      className={styles.radioGroup}
                      legendText={t('medicationAdministered', 'Medication Administered?')}
                      name="medication-administered"
                      valueSelected={medicationAdministered}
                      onChange={(value) => handleMedicationAdministeredChange(String(value))}>
                      <RadioButton id="medication-yes" value="yes" labelText={t('yes', 'Yes')} />
                      <RadioButton id="medication-no" value="no" labelText={t('no', 'No')} />
                    </RadioButtonGroup>
                  </Layer>

                  {/* Administered Medications Group Block */}
                  {medicationAdministered === 'yes' &&
                    renderAdministrationRowsBlock({
                      blockClassName: styles.medicationBlock,
                      rowStackClassName: styles.medicationRowStack,
                      nameFieldClassName: styles.medicationNameField,
                      timeFieldClassName: styles.medicationTimeField,
                      title: t('medicationGiven', 'Medication Given'),
                      errorMessage: errors.medicationRows?.message,
                      clearError: () => clearErrors('medicationRows'),
                      fields: medicationFields,
                      rows: medicationRows,
                      idPrefix: 'medication',
                      nameLabel: t('nameOfMedication', '* Name of Medication'),
                      loadingLabel: t('loadingMedicationOptions', 'Loading active medications...'),
                      emptyLabel: t('selectMedication', 'Select or type medication...'),
                      updateRow: updateMedication,
                      removeRow: removeMedication,
                      addRow: () => {
                        clearErrors('medicationRows');
                        appendMedication({ name: '', time: currentTimeMax, orderUuid: undefined });
                      },
                    })}

                  {/* Fluids Administered Section */}
                  <Layer>
                    <RadioButtonGroup
                      className={styles.radioGroup}
                      legendText={t('fluidsAdministered', 'Fluids Administered?')}
                      name="fluids-administered"
                      valueSelected={fluidsAdministered}
                      onChange={(value) => handleFluidsAdministeredChange(String(value))}>
                      <RadioButton id="fluids-yes" value="yes" labelText={t('yes', 'Yes')} />
                      <RadioButton id="fluids-no" value="no" labelText={t('no', 'No')} />
                    </RadioButtonGroup>
                  </Layer>

                  {/* IV Fluids Group Block */}
                  {fluidsAdministered === 'yes' &&
                    renderAdministrationRowsBlock({
                      blockClassName: styles.fluidBlock,
                      rowStackClassName: styles.fluidRowStack,
                      nameFieldClassName: styles.fluidNameField,
                      timeFieldClassName: styles.fluidTimeField,
                      title: t('fluidsGiven', 'Fluids Given'),
                      errorMessage: errors.fluidRows?.message,
                      clearError: () => clearErrors('fluidRows'),
                      fields: fluidFields,
                      rows: fluidRows,
                      idPrefix: 'fluid',
                      nameLabel: t('nameOfFluidGiven', '* Name of Fluid Given'),
                      loadingLabel: t('loadingFluidOptions', 'Loading active medications...'),
                      emptyLabel: t('selectFluid', 'Select or type fluid...'),
                      updateRow: updateFluid,
                      removeRow: removeFluid,
                      addRow: () => {
                        clearErrors('fluidRows');
                        appendFluid({ name: '', time: currentTimeMax, orderUuid: undefined });
                      },
                    })}
                </Stack>
              </section>
            </Stack>
          </div>

          <ButtonSet className={styles.buttonSet}>
            <Button
              className={styles.button}
              kind="secondary"
              disabled={isSubmittingEncounter}
              onClick={() => closeWorkspace({ discardUnsavedChanges: true })}>
              {t('cancel', 'Cancel')}
            </Button>
            <Button className={styles.button} kind="primary" type="submit" disabled={isSubmittingEncounter}>
              {isSubmittingEncounter ? t('savingCardex', 'Saving...') : t('saveAndClose', 'Save and close')}
            </Button>
          </ButtonSet>
        </Form>
      </div>
    </Workspace2>
  );
};

export default NursingCardexPlanWorkspace;
