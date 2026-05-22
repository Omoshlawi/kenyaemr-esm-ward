import {
  Button,
  ButtonSet,
  ComboBox,
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
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { type WardConfigObject } from '../../config-schema';
import {
  CARDEX_META_PREFIX,
  getOrderLabel,
  saveNursingCardexEncounter,
  toEncounterDatetimeFromTime,
  useActiveNursingOrders,
  type ActiveOrder,
  type OrderOption,
} from './nursing-cardex-plan.resource';
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

  const toCardexOrderMeta = useCallback(
    (order: ActiveOrder) => ({
      metadataVersion: '2.0',
      orderUuid: order.uuid,
      orderDisplay: getOrderLabel(order),
      drugUuid: order.drug?.uuid,
      drugDisplay: order.drug?.display,
      dose: order.dose,
      doseUnits: order.doseUnits?.display,
      doseUnitsUuid: order.doseUnits?.uuid,
      route: order.route?.display,
      routeUuid: order.route?.uuid,
      frequency: order.frequency?.display,
      frequencyUuid: order.frequency?.uuid,
      quantity: order.quantity,
      quantityUnits: order.quantityUnits?.display,
      quantityUnitsUuid: order.quantityUnits?.uuid,
      duration: order.duration,
      durationUnits: order.durationUnits?.display,
      durationUnitsUuid: order.durationUnits?.uuid,
      provider: order.orderer?.person?.display || order.orderer?.display,
      ordererUuid: order.orderer?.uuid,
      ordererPersonUuid: order.orderer?.person?.uuid,
      conceptUuids: {
        encounterType: NURSING_CONCEPTS.encounterType,
        form: NURSING_CONCEPTS.formUuid,
        medicationGroup: NURSING_CONCEPTS.medicationGivenGroup,
        fluidGroup: NURSING_CONCEPTS.fluidsGivenGroup,
        nameField: NURSING_CONCEPTS.nameField,
        timeField: NURSING_CONCEPTS.timeField,
      },
    }),
    [NURSING_CONCEPTS],
  );

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
        appendMedication({ name: '', time: '', orderUuid: undefined });
        return;
      }

      if (value !== 'yes') {
        replaceMedication([]);
      }
    },
    [appendMedication, clearErrors, medicationAdministered, medicationRows, replaceMedication, setValue, t],
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
        appendFluid({ name: '', time: '', orderUuid: undefined });
        return;
      }

      // Reset rows when toggled away from Yes so a new Yes starts fresh.
      if (value !== 'yes') {
        replaceFluid([]);
      }
    },
    [appendFluid, clearErrors, fluidRows, fluidsAdministered, replaceFluid, setValue, t],
  );

  const onSubmit = useCallback(
    (values: CardexFormValues) => {
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

      // Build O3-compliant observations array
      const observationPayload: Array<any> = [
        {
          concept: NURSING_CONCEPTS.nursingNotes,
          value: values.nursingNotes,
          formFieldNamespace: 'O3',
          formFieldPath: FORM_FIELD_PATHS.nursingNotes,
        },
        {
          concept: NURSING_CONCEPTS.actionTaken,
          value: values.medicationAdministered === 'yes' ? NURSING_CONCEPTS.yes : NURSING_CONCEPTS.no,
          formFieldNamespace: 'O3',
          formFieldPath: FORM_FIELD_PATHS.actionTaken,
        },
        {
          concept: NURSING_CONCEPTS.actionTaken,
          value: values.fluidsAdministered === 'yes' ? NURSING_CONCEPTS.yes : NURSING_CONCEPTS.no,
          formFieldNamespace: 'O3',
          formFieldPath: FORM_FIELD_PATHS.actionTakenFluids,
        },
      ];

      // Add medication obs groups
      if (values.medicationAdministered === 'yes') {
        values.medicationRows.forEach((row: CardexRow) => {
          if (!row.name?.trim() && !row.time?.trim()) {
            return;
          }

          const groupMembers: Array<any> = [];
          if (row.name?.trim()) {
            groupMembers.push({
              concept: NURSING_CONCEPTS.nameField,
              value: row.name.trim(),
              formFieldNamespace: 'O3',
              formFieldPath: FORM_FIELD_PATHS.medicationName,
            });
          }

          const selectedOrder =
            (row.orderUuid ? activeOrdersByUuid.get(row.orderUuid) : undefined) ||
            activeOrdersByName.get(row.name?.trim()?.toLowerCase() ?? '');
          if (selectedOrder) {
            groupMembers.push({
              concept: NURSING_CONCEPTS.nameField,
              value: `${CARDEX_META_PREFIX}${JSON.stringify(toCardexOrderMeta(selectedOrder))}`,
              formFieldNamespace: 'O3',
              formFieldPath: FORM_FIELD_PATHS.medicationMeta,
            });
          }

          const timeValue = toEncounterDatetimeFromTime(row.time);
          if (timeValue) {
            groupMembers.push({
              concept: NURSING_CONCEPTS.timeField,
              value: timeValue,
              formFieldNamespace: 'O3',
              formFieldPath: FORM_FIELD_PATHS.medicationTime,
            });
          }

          if (groupMembers.length > 0) {
            observationPayload.push({
              concept: NURSING_CONCEPTS.medicationGivenGroup,
              groupMembers,
              voided: false,
              formFieldNamespace: 'O3',
              formFieldPath: FORM_FIELD_PATHS.medicationGroup,
            });
          }
        });
      }

      // Add fluid obs groups
      if (values.fluidsAdministered === 'yes') {
        values.fluidRows.forEach((row: CardexRow) => {
          if (!row.name?.trim() && !row.time?.trim()) {
            return;
          }

          const groupMembers: Array<any> = [];
          if (row.name?.trim()) {
            groupMembers.push({
              concept: NURSING_CONCEPTS.nameField,
              value: row.name.trim(),
              formFieldNamespace: 'O3',
              formFieldPath: FORM_FIELD_PATHS.fluidName,
            });
          }

          const selectedOrder =
            (row.orderUuid ? activeOrdersByUuid.get(row.orderUuid) : undefined) ||
            activeOrdersByName.get(row.name?.trim()?.toLowerCase() ?? '');
          if (selectedOrder) {
            groupMembers.push({
              concept: NURSING_CONCEPTS.nameField,
              value: `${CARDEX_META_PREFIX}${JSON.stringify(toCardexOrderMeta(selectedOrder))}`,
              formFieldNamespace: 'O3',
              formFieldPath: FORM_FIELD_PATHS.fluidMeta,
            });
          }

          const timeValue = toEncounterDatetimeFromTime(row.time);
          if (timeValue) {
            groupMembers.push({
              concept: NURSING_CONCEPTS.timeField,
              value: timeValue,
              formFieldNamespace: 'O3',
              formFieldPath: FORM_FIELD_PATHS.fluidTime,
            });
          }

          if (groupMembers.length > 0) {
            observationPayload.push({
              concept: NURSING_CONCEPTS.fluidsGivenGroup,
              groupMembers,
              voided: false,
              formFieldNamespace: 'O3',
              formFieldPath: FORM_FIELD_PATHS.fluidGroup,
            });
          }
        });
      }

      // Build O3-compliant encounter payload
      const encounterPayload = {
        encounterProviders: [
          {
            provider: currentProvider.uuid,
            encounterRole: ENCOUNTER_ROLE_UUID,
          },
        ],
        patient: patientUuid,
        visit: currentVisit.uuid,
        location: sessionLocation.uuid,
        encounterType: NURSING_CONCEPTS.encounterType,
        form: NURSING_CONCEPTS.formUuid,
        obs: observationPayload,
        orders: [],
        diagnoses: [],
      };

      saveNursingCardexEncounter(encounterPayload)
        .then(() => {
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
        })
        .catch((error) => {
          showSnackbar({
            title: t('failedToSaveCardex', 'Failed to save cardex nursing plan'),
            kind: 'error',
            subtitle: error?.message || t('unexpectedError', 'An unexpected error occurred while saving.'),
          });
        });
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
      toCardexOrderMeta,
      closeWorkspace,
      clearErrors,
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
                <TextInput
                  id={`${idPrefix}-time-${field.id}`}
                  labelText={t('timeTaken', 'Time Taken')}
                  type="time"
                  max={currentTimeMax}
                  value={row.time}
                  onChange={(e: any) => {
                    clearError();
                    updateRow(index, { ...row, time: e.target.value });
                  }}
                />
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
                        appendMedication({ name: '', time: '', orderUuid: undefined });
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
                        appendFluid({ name: '', time: '', orderUuid: undefined });
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
              onClick={() => closeWorkspace({ discardUnsavedChanges: true })}>
              {t('cancel', 'Cancel')}
            </Button>
            <Button className={styles.button} kind="primary" type="submit">
              {t('saveAndClose', 'Save and close')}
            </Button>
          </ButtonSet>
        </Form>
      </div>
    </Workspace2>
  );
};

export default NursingCardexPlanWorkspace;
