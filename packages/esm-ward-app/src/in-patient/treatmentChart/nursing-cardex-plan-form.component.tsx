import React, { useMemo } from 'react';
import {
  Button,
  ButtonSet,
  Form,
  Layer,
  ModalBody,
  ModalFooter,
  ModalHeader,
  RadioButton,
  RadioButtonGroup,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
import { formatDate, getPatientName } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from './nursing-cardex-plan-form.scss';

type NursingCardexPlanFormProps = {
  closeModal: () => void;
  patientUuid: string;
  patient: Record<string, unknown>;
};

const NursingCardexPlanForm: React.FC<NursingCardexPlanFormProps> = ({ closeModal, patientUuid, patient }) => {
  const { t } = useTranslation();
  const today = useMemo(() => formatDate(new Date(), { mode: 'wide', time: false }), []);
  const patientName = useMemo(() => getPatientName(patient as any) || patientUuid, [patient, patientUuid]);

  return (
    <>
      <ModalHeader className={styles.modalHeader}>{t('nursingCardexPlanForm', 'Nursing Cardex Plan Form')}</ModalHeader>
      <ModalBody className={styles.modalBody}>
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
      </ModalBody>
      <ModalFooter className={styles.modalFooter}>
        <ButtonSet className={styles.buttonSet}>
          <Button kind="secondary" onClick={closeModal}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button kind="primary" onClick={closeModal}>
            {t('save', 'Save')}
          </Button>
        </ButtonSet>
      </ModalFooter>
    </>
  );
};

export default NursingCardexPlanForm;
