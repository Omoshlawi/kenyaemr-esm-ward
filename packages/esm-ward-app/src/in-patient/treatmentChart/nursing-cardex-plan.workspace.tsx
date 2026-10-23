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
import {
  getOrderAdministrationSummary,
  saveNursingCardexEncounter,
  useActiveMedicationOrders,
  type MedicationOrder,
  type OrderOption,
} from './nursing-cardex-plan.resource';
import { buildNursingCardexEncounterPayload } from './nursing-cardex-payload-builder';
import {
  getDailyAdministrationLimit,
  getRemainingAdministrationsToday,
  getTodayAdministrationCount,
  isTreatmentChartOrderLocked,
  useNursingTreatmentSheet,
} from './nursing-treatment-sheet.resource';
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
    setError,
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

  const resolveOrderForOption = useCallback(
    (option: OrderOption, row?: AdministrationRow): MedicationOrder | undefined => {
      if (option.id) {
        const byId = medicationOrdersByUuid.get(option.id);
        if (byId) {
          return byId;
        }
      }

      const fallbackName = (row?.name ?? option.label).trim().toLowerCase();
      return fallbackName ? medicationOrdersByName.get(fallbackName) : undefined;
    },
    [medicationOrdersByName, medicationOrdersByUuid],
  );

  const getOrderDailyLimit = useCallback(
    (option: OrderOption, row?: AdministrationRow) => {
      const order = resolveOrderForOption(option, row);
      if (order?.asNeeded) {
        return Number.POSITIVE_INFINITY;
      }

      return getDailyAdministrationLimit(
        order?.frequency,
        order?.dosingInstructions,
        order?.dose,
        order?.doseUnits?.display,
      );
    },
    [resolveOrderForOption],
  );

  const isOrderOptionLocked = useCallback(
    (option: OrderOption, fieldName: 'medicationRows' | 'fluidRows', row?: AdministrationRow) =>
      isTreatmentChartOrderLocked(
        option,
        fieldName,
        administeredMedicationOrders,
        administeredFluidOrders,
        getOrderDailyLimit(option, row),
      ),
    [administeredFluidOrders, administeredMedicationOrders, getOrderDailyLimit],
  );

  const getGivenTodayCount = useCallback(
    (option: OrderOption, fieldName: 'medicationRows' | 'fluidRows') =>
      getTodayAdministrationCount(
        option,
        fieldName === 'medicationRows' ? administeredMedicationOrders : administeredFluidOrders,
      ),
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
      const countRowsForOption = (rows: AdministrationRow[], option: OrderOption) =>
        rows.filter((row) => row.orderUuid === option.id || row.name === option.label).length;
      const exceedsDailyLimit = (rows: AdministrationRow[], fieldName: 'medicationRows' | 'fluidRows') =>
        rows.some((row) => {
          const option = resolveOrderOption(row);
          const dailyLimit = getOrderDailyLimit(option, row);
          const givenToday = getGivenTodayCount(option, fieldName);
          return Number.isFinite(dailyLimit) && givenToday + countRowsForOption(rows, option) > dailyLimit;
        });

      if (values.medicationAdministered === 'yes' && values.medicationRows.length === 0) {
        const allLocked =
          medicationOrderOptions.length > 0 &&
          medicationOrderOptions.every((option) => isOrderOptionLocked(option, 'medicationRows'));
        setError('medicationRows', {
          type: 'manual',
          message: allLocked
            ? t(
                'allMedicationDosesComplete',
                "Today's doses are complete for all listed medications. Choose No if you are not giving another dose.",
              )
            : t('medicationRowRequired', 'Add at least one medication row.'),
        });
        return;
      }

      if (values.fluidsAdministered === 'yes' && values.fluidRows.length === 0) {
        const allLocked =
          medicationOrderOptions.length > 0 &&
          medicationOrderOptions.every((option) => isOrderOptionLocked(option, 'fluidRows'));
        setError('fluidRows', {
          type: 'manual',
          message: allLocked
            ? t(
                'allFluidDosesComplete',
                "Today's doses are complete for all listed fluids. Choose No if you are not giving another dose.",
              )
            : t('fluidRowRequired', 'Add at least one fluid row.'),
        });
        return;
      }

      const lockedMedicationRow =
        values.medicationRows.find((row) => isOrderOptionLocked(resolveOrderOption(row), 'medicationRows', row)) ||
        (exceedsDailyLimit(values.medicationRows, 'medicationRows') ? values.medicationRows[0] : undefined);
      const lockedFluidRow =
        values.fluidRows.find((row) => isOrderOptionLocked(resolveOrderOption(row), 'fluidRows', row)) ||
        (exceedsDailyLimit(values.fluidRows, 'fluidRows') ? values.fluidRows[0] : undefined);

      if (lockedMedicationRow || lockedFluidRow) {
        showSnackbar({
          title: t('dailyDoseExhausted', 'Daily dose complete'),
          kind: 'error',
          subtitle: t(
            'dailyDoseExhaustedDescription',
            'One or more selected items have already been given the allowed number of times today.',
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
      setError,
      setIsSubmittingEncounter,
      isOrderOptionLocked,
      getGivenTodayCount,
      getOrderDailyLimit,
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
            const matchingRowIndexes = rows.reduce<number[]>((indexes, row, index) => {
              if (row.orderUuid === option.id || row.name === option.label) {
                indexes.push(index);
              }
              return indexes;
            }, []);
            const selectedRows = matchingRowIndexes.map((index) => rows[index]);
            const selectedRow = selectedRows[0];
            const dailyLimit = getOrderDailyLimit(option, selectedRow);
            const givenToday = getGivenTodayCount(option, fieldName);
            const remainingToday = getRemainingAdministrationsToday(givenToday, selectedRows.length, dailyLimit);
            const isLocked = givenToday >= dailyLimit && Number.isFinite(dailyLimit);
            const orderSummary = getOrderAdministrationSummary(resolveOrderForOption(option, selectedRow));
            const rowClassName =
              isLocked && selectedRows.length === 0
                ? `${styles.orderCheckboxRow} ${styles.orderCheckboxRowLocked}`
                : styles.orderCheckboxRow;
            const lockedTitle = t(
              'dailyDoseComplete',
              "Today's doses are complete ({{given}} of {{limit}}). This can be given again tomorrow.",
              { given: givenToday, limit: dailyLimit },
            );

            return (
              <div key={option.id} className={rowClassName}>
                <div className={styles.orderNameCell}>
                  <Checkbox
                    id={`${idPrefix}-order-${option.id}`}
                    labelText={option.label}
                    checked={selectedRows.length > 0}
                    disabled={isLocked && selectedRows.length === 0}
                    title={isLocked && selectedRows.length === 0 ? lockedTitle : undefined}
                    onChange={(event) => {
                      if (isLocked && selectedRows.length === 0) {
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
                  {(orderSummary || Number.isFinite(dailyLimit)) && (
                    <p className={styles.doseProgressText}>
                      {orderSummary}
                      {orderSummary && Number.isFinite(dailyLimit) ? ' · ' : ''}
                      {Number.isFinite(dailyLimit)
                        ? t('dailyDoseProgress', '{{given}} of {{limit}} times today', {
                            given: givenToday + selectedRows.length,
                            limit: dailyLimit,
                          })
                        : ''}
                    </p>
                  )}
                  {selectedRows.length > 0 && Number.isFinite(dailyLimit) && remainingToday > 0 && (
                    <Button
                      className={styles.addAnotherTimeButton}
                      kind="ghost"
                      size="sm"
                      onClick={() => {
                        clearError();
                        setAdministrationRows(fieldName, [
                          ...rows,
                          { name: option.label, time: currentTimeMax, orderUuid: option.id },
                        ]);
                      }}>
                      {t('addAnotherAdministrationTime', 'Add another time ({{remaining}} remaining today)', {
                        remaining: remainingToday,
                      })}
                    </Button>
                  )}
                </div>
                {selectedRows.length > 0 && (
                  <div className={styles.selectedTimesColumn}>
                    {matchingRowIndexes.map((rowIndex, slotIndex) => (
                      <Layer key={`${option.id}-${rowIndex}`} className={styles.checkboxTimeField}>
                        {renderTimeSelector({
                          idPrefix: `${idPrefix}-${slotIndex}`,
                          row: rows[rowIndex],
                          onChange: (time) => {
                            clearError();
                            setAdministrationRows(
                              fieldName,
                              rows.map((row, index) => (index === rowIndex ? { ...row, time } : row)),
                            );
                          },
                        })}
                      </Layer>
                    ))}
                  </div>
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
