import {
  Button,
  ButtonSet,
  Checkbox,
  Form,
  InlineNotification,
  Layer,
  RadioButton,
  RadioButtonGroup,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
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
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { type WardConfigObject } from '../../config-schema';
import { saveNursingCardexEncounter, useActiveMedicationOrders } from './nursing-cardex-plan.resource';
import { buildNursingCardexEncounterPayload } from './nursing-cardex-payload-builder';
import { isTreatmentChartOrderLocked, useNursingTreatmentSheet } from './nursing-treatment-sheet.resource';
import { useNursingCardexFormSchema, type CardexFormValues } from './use-nursing-cardex-form-schema';
import styles from './nursing-cardex-plan.workspace.scss';

export type NursingCardexPlanWorkspaceProps = {
  patientUuid: string;
  patient: Record<string, unknown>;
};

type AdministrationRow = CardexFormValues['medicationRows'][number];

const NursingCardexPlanWorkspace: React.FC<
  Workspace2DefinitionProps<NursingCardexPlanWorkspaceProps, object, object>
> = ({ closeWorkspace, workspaceProps }) => {
  const { patientUuid, patient } = workspaceProps || {};
  const { t } = useTranslation();
  const { mutate: mutateCache } = useSWRConfig();
  const { sessionLocation, currentProvider } = useSession();
  const { activeVisit } = useVisit(patientUuid ?? '');
  const visit = activeVisit;
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
  const NURSING_CONCEPTS = nursingCardex?.concepts;
  const FORM_FIELD_PATHS = nursingCardex?.formFieldPaths;
  const ENCOUNTER_ROLE_UUID = nursingCardex?.encounterRoleUuid;

  const cardexSchema = useNursingCardexFormSchema(currentTimeMax, t);

  const {
    options: medicationOrderOptions,
    byUuid: medicationOrdersByUuid,
    byName: medicationOrdersByName,
    isLoading: isLoadingMedicationOrders,
  } = useActiveMedicationOrders(patientUuid);

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
      medicationAdministered: '',
      medicationRows: [],
      fluidsAdministered: '',
      fluidRows: [],
      nursingNotes: '',
    },
  });

  const medicationAdministered = useWatch({ control, name: 'medicationAdministered' }) ?? '';
  const watchedMedicationRows = useWatch({ control, name: 'medicationRows' });
  const medicationRows = useMemo(() => watchedMedicationRows ?? [], [watchedMedicationRows]);
  const fluidsAdministered = useWatch({ control, name: 'fluidsAdministered' }) ?? '';
  const watchedFluidRows = useWatch({ control, name: 'fluidRows' });
  const fluidRows = useMemo(() => watchedFluidRows ?? [], [watchedFluidRows]);
  const nursingNotes = useWatch({ control, name: 'nursingNotes' }) ?? '';
  const [isSubmittingEncounter, setIsSubmittingEncounter] = useState(false);

  const {
    administeredMedicationOrders,
    administeredFluidOrders,
    isLoading: isLoadingTreatmentSheetHistory,
  } = useNursingTreatmentSheet(patientUuid ?? '');

  const isOrderOptionLocked = useCallback(
    (option: { id: string; label: string }, fieldName: 'medicationRows' | 'fluidRows') =>
      isTreatmentChartOrderLocked(option, fieldName, administeredMedicationOrders, administeredFluidOrders),
    [administeredFluidOrders, administeredMedicationOrders],
  );

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
      setValue('medicationAdministered', value as CardexFormValues['medicationAdministered'], {
        shouldDirty: true,
        shouldValidate: true,
      });
      clearErrors('medicationRows');

      if (value !== 'yes') {
        setValue('medicationRows', [], {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    },
    [clearErrors, setValue],
  );

  const handleFluidsAdministeredChange = useCallback(
    (value: string) => {
      setValue('fluidsAdministered', value as CardexFormValues['fluidsAdministered'], {
        shouldDirty: true,
        shouldValidate: true,
      });
      clearErrors('fluidRows');

      if (value !== 'yes') {
        setValue('fluidRows', [], {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    },
    [clearErrors, setValue],
  );

  const onSubmit = useCallback(
    async (values: CardexFormValues) => {
      if (
        !patientUuid ||
        !sessionLocation?.uuid ||
        !currentProvider?.uuid ||
        !visit?.uuid ||
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

      const resolveOrderOption = (row: AdministrationRow) => ({
        id: row.orderUuid ?? medicationOrderOptions.find((option) => option.label === row.name)?.id ?? '',
        label: row.name,
      });

      const lockedMedicationRow = values.medicationRows.find((row) =>
        isTreatmentChartOrderLocked(
          resolveOrderOption(row),
          'medicationRows',
          administeredMedicationOrders,
          administeredFluidOrders,
        ),
      );
      const lockedFluidRow = values.fluidRows.find((row) =>
        isTreatmentChartOrderLocked(
          resolveOrderOption(row),
          'fluidRows',
          administeredMedicationOrders,
          administeredFluidOrders,
        ),
      );

      if (lockedMedicationRow || lockedFluidRow) {
        showSnackbar({
          title: t('duplicateMedicationNotAllowed', 'Duplicate medication'),
          kind: 'error',
          subtitle: t(
            'duplicateMedicationNotAllowedDescription',
            'One or more selected items were already recorded in this section on the treatment sheet.',
          ),
        });
        return;
      }

      const encounterPayload = buildNursingCardexEncounterPayload({
        values,
        patientUuid,
        currentVisitUuid: visit.uuid,
        sessionLocationUuid: sessionLocation.uuid,
        currentProviderUuid: currentProvider.uuid,
        encounterRoleUuid: ENCOUNTER_ROLE_UUID,
        concepts: NURSING_CONCEPTS,
        formFieldPaths: FORM_FIELD_PATHS,
        medicationOrdersByUuid,
        medicationOrdersByName,
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
      visit?.uuid,
      medicationOrdersByUuid,
      medicationOrdersByName,
      NURSING_CONCEPTS,
      FORM_FIELD_PATHS,
      ENCOUNTER_ROLE_UUID,
      closeWorkspace,
      clearErrors,
      setIsSubmittingEncounter,
      administeredFluidOrders,
      administeredMedicationOrders,
      medicationOrderOptions,
      mutateCache,
      t,
    ],
  );

  const handleSave = handleSubmit(onSubmit);

  const setAdministrationRows = useCallback(
    (fieldName: 'medicationRows' | 'fluidRows', rows: AdministrationRow[]) => {
      setValue(fieldName, rows, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [setValue],
  );

  const renderTimeSelector = ({
    idPrefix,
    row,
    onChange,
  }: {
    idPrefix: string;
    row: AdministrationRow;
    onChange: (time: string) => void;
  }) => {
    const [rowHourCandidate, rowMinuteCandidate] = (row.time || currentTimeMax).split(':').map(Number);
    const selectedHour = Number.isNaN(rowHourCandidate) ? currentHour : rowHourCandidate;
    const selectedMinute = Number.isNaN(rowMinuteCandidate) ? currentMinute : rowMinuteCandidate;
    const maxMinute = selectedHour === currentHour ? currentMinute : 59;
    const formatTimePart = (value: number) => String(value).padStart(2, '0');

    return (
      <div className={styles.timeStepperGrid}>
        <TextInput
          id={`${idPrefix}-hour-${row.orderUuid ?? row.name}`}
          className={styles.timeNumberInput}
          type="number"
          labelText={t('hour', 'Hour')}
          min={0}
          max={currentHour}
          value={formatTimePart(selectedHour)}
          onChange={(event) => {
            const nextHour = Number(event.target.value);
            if (Number.isNaN(nextHour)) {
              return;
            }

            const boundedHour = Math.min(Math.max(nextHour, 0), currentHour);
            const boundedMinute =
              boundedHour === currentHour ? Math.min(selectedMinute, currentMinute) : selectedMinute;
            onChange(`${formatTimePart(boundedHour)}:${formatTimePart(boundedMinute)}`);
          }}
        />
        <TextInput
          id={`${idPrefix}-minute-${row.orderUuid ?? row.name}`}
          className={styles.timeNumberInput}
          type="number"
          labelText={t('minute', 'Minute')}
          min={0}
          max={maxMinute}
          value={formatTimePart(selectedMinute)}
          onChange={(event) => {
            const nextMinute = Number(event.target.value);
            if (Number.isNaN(nextMinute)) {
              return;
            }

            const boundedMinute = Math.min(Math.max(nextMinute, 0), maxMinute);
            onChange(`${formatTimePart(selectedHour)}:${formatTimePart(boundedMinute)}`);
          }}
        />
      </div>
    );
  };

  const renderAdministrationRowsBlock = ({
    blockClassName,
    title,
    errorMessage,
    clearError,
    rows,
    fieldName,
    idPrefix,
    loadingLabel,
    emptyLabel,
  }: {
    blockClassName: string;
    title: string;
    errorMessage?: string;
    clearError: () => void;
    rows: AdministrationRow[];
    fieldName: 'medicationRows' | 'fluidRows';
    idPrefix: string;
    loadingLabel: string;
    emptyLabel: string;
  }) => (
    <div className={blockClassName}>
      <h5>{title}</h5>
      {errorMessage && (
        <InlineNotification kind="error" title={t('error', 'Error')} subtitle={errorMessage} onClose={clearError} />
      )}
      {isLoadingMedicationOrders || isLoadingTreatmentSheetHistory ? (
        <p className={styles.emptyStateText}>{loadingLabel}</p>
      ) : medicationOrderOptions.length === 0 ? (
        <p className={styles.emptyStateText}>{emptyLabel}</p>
      ) : (
        <Stack gap={3}>
          {medicationOrderOptions.map((option) => {
            const selectedRowIndex = rows.findIndex((row) => row.orderUuid === option.id || row.name === option.label);
            const selectedRow = selectedRowIndex >= 0 ? rows[selectedRowIndex] : undefined;
            const isLocked = isOrderOptionLocked(option, fieldName);
            const rowClassName =
              isLocked && !selectedRow
                ? `${styles.orderCheckboxRow} ${styles.orderCheckboxRowLocked}`
                : styles.orderCheckboxRow;
            const lockedTitle = t(
              'medicationAlreadyRecorded',
              'Already recorded on the treatment sheet and cannot be selected again.',
            );

            return (
              <div key={option.id} className={rowClassName}>
                <div className={styles.orderNameCell}>
                  <Checkbox
                    id={`${idPrefix}-order-${option.id}`}
                    labelText={option.label}
                    checked={Boolean(selectedRow)}
                    disabled={isLocked && !selectedRow}
                    title={isLocked && !selectedRow ? lockedTitle : undefined}
                    onChange={(event) => {
                      if (isLocked && !selectedRow) {
                        return;
                      }

                      const checked = event.target.checked;
                      clearError();
                      if (checked) {
                        setAdministrationRows(fieldName, [
                          ...rows,
                          { name: option.label, time: currentTimeMax, orderUuid: option.id },
                        ]);
                        return;
                      }

                      setAdministrationRows(
                        fieldName,
                        rows.filter((row) => row.orderUuid !== option.id && row.name !== option.label),
                      );
                    }}
                  />
                </div>
                {selectedRow && (
                  <Layer className={styles.checkboxTimeField}>
                    {renderTimeSelector({
                      idPrefix,
                      row: selectedRow,
                      onChange: (time) => {
                        clearError();
                        setAdministrationRows(
                          fieldName,
                          rows.map((row, index) => (index === selectedRowIndex ? { ...row, time } : row)),
                        );
                      },
                    })}
                  </Layer>
                )}
              </div>
            );
          })}
        </Stack>
      )}
    </div>
  );

  return (
    <Workspace2 title={t('treatmentSheet', 'Treatment Sheet')}>
      <div className={styles.workspaceShell}>
        <Form aria-label={t('treatmentSheet', 'Treatment Sheet')} className={styles.form} onSubmit={handleSave}>
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

              <section className={styles.formSection}>
                <Stack gap={4}>
                  {/* Medication Administered Section */}
                  <Layer>
                    <RadioButtonGroup
                      className={styles.radioGroup}
                      legendText={t('wasMedicationGiven', 'Was medication given?')}
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
                      title: t('medicationGiven', 'Medication Given'),
                      errorMessage: errors.medicationRows?.message,
                      clearError: () => clearErrors('medicationRows'),
                      rows: medicationRows,
                      fieldName: 'medicationRows',
                      idPrefix: 'medication',
                      loadingLabel: t('loadingMedicationOptions', 'Loading active medications...'),
                      emptyLabel: t('noActiveMedicationOptions', 'No active medications found.'),
                    })}

                  {/* Fluids Administered Section */}
                  <Layer>
                    <RadioButtonGroup
                      className={styles.radioGroup}
                      legendText={t('wasFluidGiven', 'Was fluid given?')}
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
                      title: t('fluidsGiven', 'Fluids Given'),
                      errorMessage: errors.fluidRows?.message,
                      clearError: () => clearErrors('fluidRows'),
                      rows: fluidRows,
                      fieldName: 'fluidRows',
                      idPrefix: 'fluid',
                      loadingLabel: t('loadingFluidOptions', 'Loading active medications...'),
                      emptyLabel: t('noActiveFluidOptions', 'No active medications found.'),
                    })}
                  <Layer className={styles.notesField}>
                    <p className={styles.notesHelperText}>{t('optionalTreatmentSheetNotes', 'Notes (Optional).')}</p>
                    <TextArea
                      id="treatment-sheet-notes"
                      hideLabel
                      labelText={t('optionalTreatmentSheetNotes', 'Notes (Optional).')}
                      value={nursingNotes}
                      onChange={(event) => {
                        setValue('nursingNotes', event.target.value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      rows={4}
                      className={styles.notesTextArea}
                    />
                  </Layer>
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
