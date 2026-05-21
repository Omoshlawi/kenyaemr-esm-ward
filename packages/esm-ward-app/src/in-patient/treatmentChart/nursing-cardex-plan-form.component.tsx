import { Form, Layer, RadioButton, RadioButtonGroup, Stack, TextArea, TextInput } from '@carbon/react';
import { formatDate, getPatientName, Workspace2 } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './nursing-cardex-plan-form.scss';

type NursingCardexPlanFormProps = {
  closeModal: () => void;
  patientUuid: string;
  patient: Record<string, unknown>;
};

const NursingCardexPlanForm: React.FC<NursingCardexPlanFormProps> = ({ patientUuid, patient }) => {
  const { t } = useTranslation();
  const today = useMemo(() => formatDate(new Date(), { mode: 'wide', time: false }), []);
  const patientName = useMemo(() => getPatientName(patient as any) || patientUuid, [patient, patientUuid]);

  return (
    <Workspace2 title={t('nursingCardexPlanForm', 'Nursing Cardex Plan Form')}>
      <div className={styles.workspaceBody}>
        <Form aria-label={t('nursingCardexPlanForm', 'Nursing Cardex Plan Form')} className={styles.form}>
          <Stack gap={6}>
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
              <h4>{t('nursingDetailedNotes', 'Nursing Detailed Notes')}</h4>
              <Stack gap={4}>
                <Layer>
                  <TextArea
                    id="nursing-notes"
                    labelText={t('notes', 'Notes')}
                    placeholder={t('notesPlaceholder', 'Enter nursing notes')}
                    rows={6}
                  />
                </Layer>

                <Layer>
                  <RadioButtonGroup
                    className={styles.radioGroup}
                    legendText={t('medicationAdministered', 'Medication Administered?')}
                    name="medication-administered">
                    <RadioButton id="medication-yes" value="yes" labelText={t('yes', 'Yes')} />
                    <RadioButton id="medication-no" value="no" labelText={t('no', 'No')} />
                  </RadioButtonGroup>
                </Layer>

                <div className={styles.formSubsection}>
                  <h5>{t('medicationGiven', 'Medication Given')}</h5>
                  <Stack gap={3}>
                    <Layer>
                      <TextInput
                        id="medication-name"
                        labelText={t('nameOfMedication', 'Name of Medication')}
                        placeholder={t('selectMedication', 'Select or type medication')}
                      />
                    </Layer>
                    <Layer>
                      <TextInput id="medication-time" labelText={t('timeTaken', 'Time Taken')} placeholder="HH:MM" />
                    </Layer>
                  </Stack>
                </div>

                <Layer>
                  <RadioButtonGroup
                    className={styles.radioGroup}
                    legendText={t('fluidsAdministered', 'Fluids Administered?')}
                    name="fluids-administered">
                    <RadioButton id="fluids-yes" value="yes" labelText={t('yes', 'Yes')} />
                    <RadioButton id="fluids-no" value="no" labelText={t('no', 'No')} />
                  </RadioButtonGroup>
                </Layer>

                <div className={styles.formSubsection}>
                  <h5>{t('fluidsGiven', 'Fluids Given')}</h5>
                  <Stack gap={3}>
                    <Layer>
                      <TextInput
                        id="fluid-name"
                        labelText={t('nameOfFluidGiven', 'Name of Fluid Given')}
                        placeholder={t('selectFluid', 'Select or type fluid')}
                      />
                    </Layer>
                    <Layer>
                      <TextInput id="fluid-time" labelText={t('timeTaken', 'Time Taken')} placeholder="HH:MM" />
                    </Layer>
                  </Stack>
                </div>
              </Stack>
            </section>
          </Stack>
        </Form>
      </div>
    </Workspace2>
  );
};

export default NursingCardexPlanForm;
