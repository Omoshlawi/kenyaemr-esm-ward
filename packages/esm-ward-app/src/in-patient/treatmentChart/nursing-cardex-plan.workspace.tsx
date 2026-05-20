import React, { useMemo, useState, useCallback } from 'react';
import {
  Button,
  ButtonSet,
  ComboBox,
  Form,
  Layer,
  RadioButton,
  RadioButtonGroup,
  Stack,
  TextArea,
  TextInput,
  InlineNotification,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import {
  formatDate,
  getPatientName,
  showSnackbar,
  useConfig,
  useSession,
  useVisit,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import {
  getOrderLabel,
  saveNursingCardexEncounter,
  type ActiveOrder,
  type OrderOption,
  useActiveNursingOrders,
} from './nursing-cardex-plan.resource';
import { type WardConfigObject } from '../../config-schema';
import styles from './nursing-cardex-plan.workspace.scss';

export type NursingCardexPlanWorkspaceProps = {
  patientUuid: string;
  patient: Record<string, unknown>;
};

type MedicationRow = {
  id: string;
  name: string;
  time: string;
  orderUuid?: string;
};

type FluidRow = {
  id: string;
  name: string;
  time: string;
  orderUuid?: string;
};

const CARDEX_META_PREFIX = '__CARDEX_META__:';

const toEncounterDatetimeFromTime = (time: string): string | null => {
  if (!time) {
    return null;
  }

  const [hours, minutes] = time.split(':').map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours24 = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours24}:${mins}:${secs}`;
};

const NursingCardexPlanWorkspace: React.FC<
  Workspace2DefinitionProps<NursingCardexPlanWorkspaceProps, object, object>
> = ({ closeWorkspace, workspaceProps }) => {
  const { patientUuid, patient } = workspaceProps || {};
  const { t } = useTranslation();
  const { sessionLocation, currentProvider } = useSession();
  const { currentVisit } = useVisit(patientUuid ?? '');
  const { nursingCardex } = useConfig<WardConfigObject>();
  const today = useMemo(() => formatDate(new Date(), { mode: 'wide', time: false }), []);
  const patientName = useMemo(() => getPatientName(patient as any) || patientUuid, [patient, patientUuid]);
  const currentTimeMax = useMemo(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }, []);
  const NURSING_CONCEPTS = nursingCardex.concepts;
  const FORM_FIELD_PATHS = nursingCardex.formFieldPaths;
  const ENCOUNTER_ROLE_UUID = nursingCardex.encounterRoleUuid;

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

  // Form state
  const [nursingNotes, setNursingNotes] = useState('');
  const [medicationAdministered, setMedicationAdministered] = useState('');
  const [medicationRows, setMedicationRows] = useState<MedicationRow[]>([]);
  const [fluidsAdministered, setFluidsAdministered] = useState('');
  const [fluidRows, setFluidRows] = useState<FluidRow[]>([]);

  // Validation state
  const [notesError, setNotesError] = useState('');
  const [medicationError, setMedicationError] = useState('');
  const [fluidsError, setFluidsError] = useState('');

  const handleMedicationAdministeredChange = useCallback(
    (value: string) => {
      if (value === 'no' && medicationAdministered === 'yes') {
        const hasEnteredMedicationData = medicationRows.some((row) => row.name.trim() || row.time.trim());
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

      setMedicationAdministered(value);
      setMedicationError('');

      if (value === 'yes') {
        setMedicationRows([{ id: '1', name: '', time: '', orderUuid: undefined }]);
        return;
      }

      // Reset rows when toggled away from Yes so a new Yes starts fresh.
      setMedicationRows([]);
    },
    [medicationAdministered, medicationRows, t],
  );

  const handleFluidsAdministeredChange = useCallback(
    (value: string) => {
      if (value === 'no' && fluidsAdministered === 'yes') {
        const hasEnteredFluidData = fluidRows.some((row) => row.name.trim() || row.time.trim());
        if (hasEnteredFluidData) {
          const shouldClear = window.confirm(
            t('confirmFluidClear', 'Changing to No will discard entered fluid rows. Do you want to continue?'),
          );
          if (!shouldClear) {
            return;
          }
        }
      }

      setFluidsAdministered(value);
      setFluidsError('');

      if (value === 'yes') {
        setFluidRows([{ id: '1', name: '', time: '', orderUuid: undefined }]);
        return;
      }

      // Reset rows when toggled away from Yes so a new Yes starts fresh.
      setFluidRows([]);
    },
    [fluidsAdministered, fluidRows, t],
  );

  const handleAddMedicationRow = useCallback(() => {
    setMedicationError('');
    const newId = String(Math.max(...medicationRows.map((r) => parseInt(r.id, 10)), 0) + 1);
    setMedicationRows([...medicationRows, { id: newId, name: '', time: '', orderUuid: undefined }]);
  }, [medicationRows]);

  const handleDeleteMedicationRow = useCallback(
    (rowId: string) => {
      setMedicationRows(medicationRows.filter((r) => r.id !== rowId));
    },
    [medicationRows],
  );

  const handleAddFluidRow = useCallback(() => {
    setFluidsError('');
    const newId = String(Math.max(...fluidRows.map((r) => parseInt(r.id, 10)), 0) + 1);
    setFluidRows([...fluidRows, { id: newId, name: '', time: '', orderUuid: undefined }]);
  }, [fluidRows]);

  const handleDeleteFluidRow = useCallback(
    (rowId: string) => {
      setFluidRows(fluidRows.filter((r) => r.id !== rowId));
    },
    [fluidRows],
  );

  const handleMedicationTimeChange = useCallback(
    (rowId: string, time: string) => {
      setMedicationRows(medicationRows.map((r) => (r.id === rowId ? { ...r, time } : r)));
    },
    [medicationRows],
  );

  const handleFluidTimeChange = useCallback(
    (rowId: string, time: string) => {
      setFluidRows(fluidRows.map((r) => (r.id === rowId ? { ...r, time } : r)));
    },
    [fluidRows],
  );

  const handleSave = useCallback(() => {
    // Validate nursing notes
    if (!nursingNotes.trim()) {
      setNotesError(t('notesRequired', 'Progress notes cannot be left blank'));
      return;
    }

    if (medicationAdministered === 'yes') {
      if (!medicationRows.length) {
        setMedicationError(t('medicationRowRequired', 'Add at least one medication row.'));
        return;
      }

      const hasInvalidMedicationRow = medicationRows.some((row) => !row.name.trim() || !row.time.trim());
      if (hasInvalidMedicationRow) {
        setMedicationError(t('medicationFieldsRequired', 'Medication name and time are required for each row.'));
        return;
      }
    }

    if (fluidsAdministered === 'yes') {
      if (!fluidRows.length) {
        setFluidsError(t('fluidRowRequired', 'Add at least one fluid row.'));
        return;
      }

      const hasInvalidFluidRow = fluidRows.some((row) => !row.name.trim() || !row.time.trim());
      if (hasInvalidFluidRow) {
        setFluidsError(t('fluidFieldsRequired', 'Fluid name and time are required for each row.'));
        return;
      }
    }

    if (!patientUuid) {
      showSnackbar({
        title: t('missingPatient', 'Missing patient'),
        kind: 'error',
        subtitle: t('missingPatientDescription', 'Cannot save cardex plan without patient context.'),
      });
      return;
    }

    if (!sessionLocation?.uuid) {
      showSnackbar({
        title: t('missingLocation', 'Missing location'),
        kind: 'error',
        subtitle: t('missingLocationDescription', 'Cannot save cardex plan without a session location.'),
      });
      return;
    }

    if (!currentProvider?.uuid) {
      showSnackbar({
        title: t('missingProvider', 'Missing provider'),
        kind: 'error',
        subtitle: t('missingProviderDescription', 'Cannot save cardex plan without a current provider.'),
      });
      return;
    }

    if (!currentVisit?.uuid) {
      showSnackbar({
        title: t('missingVisit', 'Missing visit'),
        kind: 'error',
        subtitle: t('missingVisitDescription', 'Cannot save cardex plan without an active visit.'),
      });
      return;
    }

    setNotesError('');
    setMedicationError('');
    setFluidsError('');

    // Build O3-compliant observations array
    const observationPayload: Array<any> = [
      {
        concept: NURSING_CONCEPTS.nursingNotes,
        value: nursingNotes,
        formFieldNamespace: 'O3',
        formFieldPath: FORM_FIELD_PATHS.nursingNotes,
      },
      {
        concept: NURSING_CONCEPTS.actionTaken,
        value: medicationAdministered === 'yes' ? NURSING_CONCEPTS.yes : NURSING_CONCEPTS.no,
        formFieldNamespace: 'O3',
        formFieldPath: FORM_FIELD_PATHS.actionTaken,
      },
      {
        concept: NURSING_CONCEPTS.actionTaken,
        value: fluidsAdministered === 'yes' ? NURSING_CONCEPTS.yes : NURSING_CONCEPTS.no,
        formFieldNamespace: 'O3',
        formFieldPath: FORM_FIELD_PATHS.actionTakenFluids,
      },
    ];

    // Add medication obs groups
    if (medicationAdministered === 'yes') {
      medicationRows.forEach((row) => {
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
          activeOrdersByName.get(row.name.trim().toLowerCase());
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
    if (fluidsAdministered === 'yes') {
      fluidRows.forEach((row) => {
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
          activeOrdersByName.get(row.name.trim().toLowerCase());
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
  }, [
    nursingNotes,
    medicationAdministered,
    medicationRows,
    fluidsAdministered,
    fluidRows,
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
    t,
  ]);

  return (
    <Workspace2 title={t('nursingCardexPlanForm', 'Nursing Cardex Plan Form')}>
      <div className={styles.workspaceShell}>
        <Form aria-label={t('nursingCardexPlanForm', 'Nursing Cardex Plan Form')} className={styles.form}>
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
                    <TextArea
                      id="nursing-notes"
                      labelText={t('clinicalActionProgressNotes', 'Clinical Action Progress Notes')}
                      helperText={t(
                        'notesHelperText',
                        'Document the assessment, complaints, treatment updates, and shift observations.',
                      )}
                      placeholder={t(
                        'notesPlaceholder',
                        'Enter structural physical evaluations, patient complaints, or general nursing shift updates',
                      )}
                      value={nursingNotes}
                      onChange={(e) => {
                        setNursingNotes(e.target.value);
                        if (e.target.value.trim()) {
                          setNotesError('');
                        }
                      }}
                      rows={8}
                      className={notesError ? styles.textAreaError : ''}
                    />
                  </Layer>
                  {notesError && (
                    <InlineNotification
                      kind="error"
                      title={t('error', 'Error')}
                      subtitle={notesError}
                      onClose={() => setNotesError('')}
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
                  {medicationAdministered === 'yes' && (
                    <div className={styles.medicationBlock}>
                      <h5>{t('medicationGiven', 'Medication Given')}</h5>
                      {medicationError && (
                        <InlineNotification
                          kind="error"
                          title={t('error', 'Error')}
                          subtitle={medicationError}
                          onClose={() => setMedicationError('')}
                        />
                      )}
                      <Stack gap={4}>
                        {medicationRows.map((row) => (
                          <Stack key={row.id} gap={3} className={styles.medicationRowStack}>
                            <Layer className={styles.medicationNameField}>
                              <ComboBox
                                id={`medication-name-${row.id}`}
                                titleText={t('nameOfMedication', '* Name of Medication')}
                                placeholder={
                                  isLoadingActiveOrders
                                    ? t('loadingMedicationOptions', 'Loading active medications...')
                                    : t('selectMedication', 'Select or type medication...')
                                }
                                items={activeOrderOptions}
                                itemToString={(item: OrderOption | null) => item?.label ?? ''}
                                selectedItem={
                                  activeOrderOptions.find((option) => option.id === row.orderUuid) ??
                                  activeOrderOptions.find((option) => option.label === row.name) ??
                                  null
                                }
                                onInputChange={(value) => {
                                  setMedicationError('');
                                  const updatedRows = medicationRows.map((r) =>
                                    r.id === row.id ? { ...r, name: String(value ?? ''), orderUuid: undefined } : r,
                                  );
                                  setMedicationRows(updatedRows);
                                }}
                                onChange={({ selectedItem }) => {
                                  setMedicationError('');
                                  const updatedRows = medicationRows.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          name: selectedItem?.label ?? r.name,
                                          orderUuid: selectedItem?.id ?? r.orderUuid,
                                        }
                                      : r,
                                  );
                                  setMedicationRows(updatedRows);
                                }}
                                disabled={isLoadingActiveOrders}
                              />
                            </Layer>
                            <Layer className={styles.medicationTimeField}>
                              <TextInput
                                id={`medication-time-${row.id}`}
                                labelText={t('timeTaken', 'Time Taken')}
                                type="time"
                                max={currentTimeMax}
                                value={row.time}
                                onChange={(e: any) => {
                                  setMedicationError('');
                                  if (e.target.value > currentTimeMax) {
                                    setMedicationError(t('futureTimeError', 'Cannot select a future time'));
                                    return;
                                  }
                                  handleMedicationTimeChange(row.id, e.target.value);
                                }}
                              />
                            </Layer>
                            <Button kind="danger" onClick={() => handleDeleteMedicationRow(row.id)}>
                              {t('remove', 'Remove')}
                            </Button>
                          </Stack>
                        ))}
                      </Stack>
                      <Button kind="tertiary" renderIcon={Add} onClick={handleAddMedicationRow}>
                        {t('addRowEntry', '+ Add')}
                      </Button>
                    </div>
                  )}

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
                  {fluidsAdministered === 'yes' && (
                    <div className={styles.fluidBlock}>
                      <h5>{t('fluidsGiven', 'Fluids Given')}</h5>
                      {fluidsError && (
                        <InlineNotification
                          kind="error"
                          title={t('error', 'Error')}
                          subtitle={fluidsError}
                          onClose={() => setFluidsError('')}
                        />
                      )}
                      <Stack gap={4}>
                        {fluidRows.map((row) => (
                          <Stack key={row.id} gap={3} className={styles.fluidRowStack}>
                            <Layer className={styles.fluidNameField}>
                              <ComboBox
                                id={`fluid-name-${row.id}`}
                                titleText={t('nameOfFluidGiven', '* Name of Fluid Given')}
                                placeholder={
                                  isLoadingActiveOrders
                                    ? t('loadingFluidOptions', 'Loading active medications...')
                                    : t('selectFluid', 'Select or type fluid...')
                                }
                                items={activeOrderOptions}
                                itemToString={(item: OrderOption | null) => item?.label ?? ''}
                                selectedItem={
                                  activeOrderOptions.find((option) => option.id === row.orderUuid) ??
                                  activeOrderOptions.find((option) => option.label === row.name) ??
                                  null
                                }
                                onInputChange={(value) => {
                                  setFluidsError('');
                                  const updatedRows = fluidRows.map((r) =>
                                    r.id === row.id ? { ...r, name: String(value ?? ''), orderUuid: undefined } : r,
                                  );
                                  setFluidRows(updatedRows);
                                }}
                                onChange={({ selectedItem }) => {
                                  setFluidsError('');
                                  const updatedRows = fluidRows.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          name: selectedItem?.label ?? r.name,
                                          orderUuid: selectedItem?.id ?? r.orderUuid,
                                        }
                                      : r,
                                  );
                                  setFluidRows(updatedRows);
                                }}
                                disabled={isLoadingActiveOrders}
                              />
                            </Layer>
                            <Layer className={styles.fluidTimeField}>
                              <TextInput
                                id={`fluid-time-${row.id}`}
                                labelText={t('timeTaken', 'Time Taken')}
                                type="time"
                                max={currentTimeMax}
                                value={row.time}
                                onChange={(e: any) => {
                                  setFluidsError('');
                                  if (e.target.value > currentTimeMax) {
                                    setFluidsError(t('futureTimeError', 'Cannot select a future time'));
                                    return;
                                  }
                                  handleFluidTimeChange(row.id, e.target.value);
                                }}
                              />
                            </Layer>
                            <Button kind="danger" onClick={() => handleDeleteFluidRow(row.id)}>
                              {t('remove', 'Remove')}
                            </Button>
                          </Stack>
                        ))}
                      </Stack>
                      <Button kind="tertiary" renderIcon={Add} onClick={handleAddFluidRow}>
                        {t('addRowEntry', '+ Add')}
                      </Button>
                    </div>
                  )}
                </Stack>
              </section>
            </Stack>
          </div>

          <ButtonSet className={styles.buttonSet}>
            <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
              {t('cancel', 'Cancel')}
            </Button>
            <Button className={styles.button} kind="primary" onClick={handleSave}>
              {t('saveAndClose', 'Save and close')}
            </Button>
          </ButtonSet>
        </Form>
      </div>
    </Workspace2>
  );
};

export default NursingCardexPlanWorkspace;
