import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import {
  Modal,
  Grid,
  Column,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  InlineNotification,
  MultiSelect,
  TextInput,
} from '@carbon/react';
import styles from '../partography-data-form.scss';
import { saveAdmissionDetails } from '../resources/admission-details.resource';
import { AdmissionDetailsTimePickerDropdown } from './form-scoped-time-pickers.component';
import { LCG_ADMISSION_RISK_FACTOR_CODE, LCG_LABOUR_ONSET_CODE } from '../constants/admission-form.constants';

export type AdmissionDetailsFormData = {
  labourOnset: string;
  activeLabourDiagnosisDate: string;
  riskFactors: string[];
  riskFactorOtherText: string;
  rupturedMembranes: string;
  rupturedMembranesDate: string;
  rupturedMembranesTime: string;
};

export type AdmissionDetailsFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AdmissionDetailsFormData) => void;
  patient?: {
    uuid: string;
    name: string;
    gender: string;
    age?: string | number;
    birthDate?: string;
  };
};

const defaultValues: AdmissionDetailsFormData = {
  labourOnset: '',
  activeLabourDiagnosisDate: '',
  riskFactors: [],
  riskFactorOtherText: '',
  rupturedMembranes: 'no',
  rupturedMembranesDate: '',
  rupturedMembranesTime: '',
};

const resolvePatientAge = (patient?: AdmissionDetailsFormProps['patient']): number => {
  const ageFromPatient = Number(patient?.age);
  if (Number.isFinite(ageFromPatient)) {
    return ageFromPatient;
  }

  const birthDate = patient?.birthDate;
  if (!birthDate) {
    return NaN;
  }

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return NaN;
  }

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasNotHadBirthdayYet =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (hasNotHadBirthdayYet) {
    age -= 1;
  }

  return age;
};

const AdmissionDetailsForm: React.FC<AdmissionDetailsFormProps> = ({ isOpen, onClose, onSubmit, patient }) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const { control, handleSubmit, reset, watch, clearErrors } = useForm<AdmissionDetailsFormData>({
    defaultValues,
  });

  const rupturedMembranesValue = watch('rupturedMembranes');
  const riskFactorsValue = watch('riskFactors');
  const hasOtherRiskFactor = (riskFactorsValue || []).includes(LCG_ADMISSION_RISK_FACTOR_CODE.other);
  const patientAge = React.useMemo(() => resolvePatientAge(patient), [patient]);
  const canSelectAdolescentPregnancy = Number.isFinite(patientAge) && patientAge >= 10 && patientAge <= 19;

  const riskFactorOptions = React.useMemo(
    () =>
      [
        {
          id: LCG_ADMISSION_RISK_FACTOR_CODE.chronicHypertension,
          text: t('chronicHypertension', 'Chronic hypertension'),
        },
        { id: LCG_ADMISSION_RISK_FACTOR_CODE.preEclampsia, text: t('preEclampsia', 'Pre-eclampsia') },
        { id: LCG_ADMISSION_RISK_FACTOR_CODE.advancedAge, text: t('advancedAge', "Woman's advanced age") },
        {
          id: LCG_ADMISSION_RISK_FACTOR_CODE.adolescentPregnancy,
          text: t('adolescentPregnancy', 'Adolescent pregnancy'),
        },
        { id: LCG_ADMISSION_RISK_FACTOR_CODE.multipleGestation, text: t('multipleGestation', 'Multiple gestation') },
        { id: LCG_ADMISSION_RISK_FACTOR_CODE.colonization, text: t('colonization', 'Colonization') },
        { id: LCG_ADMISSION_RISK_FACTOR_CODE.other, text: t('other', 'Other') },
        { id: LCG_ADMISSION_RISK_FACTOR_CODE.none, text: t('none', 'None') },
      ].filter(
        (option) => option.id !== LCG_ADMISSION_RISK_FACTOR_CODE.adolescentPregnancy || canSelectAdolescentPregnancy,
      ),
    [canSelectAdolescentPregnancy, t],
  );

  React.useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
      clearErrors();
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [isOpen, reset, clearErrors]);

  const handleFormSubmit = async (data: AdmissionDetailsFormData) => {
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const patientUuid = patient?.uuid;
      if (!patientUuid) {
        setSaveError(t('noPatient', 'Patient information is missing'));
        return;
      }
      const payload: AdmissionDetailsFormData = {
        ...data,
        riskFactors: canSelectAdolescentPregnancy
          ? data.riskFactors
          : (data.riskFactors || []).filter(
              (riskFactor) => riskFactor !== LCG_ADMISSION_RISK_FACTOR_CODE.adolescentPregnancy,
            ),
      };
      const result = await saveAdmissionDetails(patientUuid, payload, t);
      if (!result.success) {
        setSaveError(result.message);
        return;
      }
      setSaveSuccess(true);
      onSubmit(payload);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (error) {
      setSaveError(t('saveError', 'Failed to save data'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      modalHeading={t('admissionDetails', 'Admission Details')}
      primaryButtonText={isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
      primaryButtonDisabled={isSaving}
      secondaryButtonText={t('cancel', 'Cancel')}
      onRequestSubmit={handleSubmit(handleFormSubmit)}
      onSecondarySubmit={onClose}
      className={styles.cervixModal}
      size="md">
      {saveSuccess && (
        <InlineNotification kind="success" title={t('saveSuccess', 'Data saved successfully')} hideCloseButton />
      )}
      {saveError && (
        <InlineNotification
          kind="error"
          title={t('saveError', 'Error saving data')}
          subtitle={saveError}
          onCloseButtonClick={() => setSaveError(null)}
        />
      )}

      <Grid className={styles.formGrid} style={{ overflow: 'visible' }}>
        {/* ROW 1: Labour Onset & Diagnosis Date */}
        <Column lg={8} md={4} sm={4}>
          <div className={styles.formField}>
            <Controller
              name="labourOnset"
              control={control}
              rules={{ required: t('labourOnsetRequired', 'Labour onset is required') }}
              render={({ field, fieldState }) => (
                <Select
                  id="labour-onset"
                  labelText={t('labourOnset', 'Labour Onset *')}
                  {...field}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}>
                  <SelectItem value="" text={t('selectOption', 'Select option')} />
                  <SelectItem value={LCG_LABOUR_ONSET_CODE.spontaneous} text={t('spontaneous', 'Spontaneous')} />
                  <SelectItem value={LCG_LABOUR_ONSET_CODE.induction} text={t('induction', 'Induction')} />
                  <SelectItem
                    value={LCG_LABOUR_ONSET_CODE.preLabourCsection}
                    text={t('preLabourCsection', 'Pre-labour C-section')}
                  />
                </Select>
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={4}>
          <div className={styles.formField}>
            <Controller
              name="activeLabourDiagnosisDate"
              control={control}
              rules={{ required: t('dateRequired', 'Date is required') }}
              render={({ field, fieldState }) => (
                <DatePicker
                  datePickerType="single"
                  dateFormat="Y-m-d"
                  onChange={([date]) => field.onChange(date?.toISOString().split('T')[0])}>
                  <DatePickerInput
                    id="diagnosis-date"
                    placeholder="YYYY-MM-DD"
                    labelText={t('activeLabourDate', 'Diagnosis Date *')}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                  />
                </DatePicker>
              )}
            />
          </div>
        </Column>

        {/* ROW 2: Risk Factors & Ruptured Membranes */}
        <Column lg={8} md={4} sm={4}>
          <div className={styles.formField}>
            <Controller
              name="riskFactors"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  id="risk-factors"
                  label={t('selectRiskFactors', 'Select risk factors')}
                  titleText={t('riskFactors', 'Risk Factors')}
                  items={riskFactorOptions}
                  itemToString={(item) => item?.text || ''}
                  direction="bottom"
                  usePortal={true} // This forces dropdown to render at body level
                  portalClassName="risk-factors-portal" // Optional custom class
                  selectedItems={riskFactorOptions.filter((opt) => (field.value || []).includes(opt.id))}
                  onChange={({ selectedItems }) => {
                    const items = selectedItems ?? [];
                    const ids = items.map((item) => item.id);

                    if (ids.includes('none') && !(field.value || []).includes('none')) {
                      field.onChange(['none']);
                    } else {
                      field.onChange(ids.filter((id) => id !== 'none'));
                    }
                  }}
                />
              )}
            />
          </div>
        </Column>

        {hasOtherRiskFactor && (
          <Column lg={8} md={4} sm={4}>
            <div className={styles.formField}>
              <Controller
                name="riskFactorOtherText"
                control={control}
                render={({ field, fieldState }) => (
                  <TextInput
                    id="risk-factor-other"
                    labelText={t('specifyOtherRiskFactor', 'Specify Other')}
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value)}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                  />
                )}
              />
            </div>
          </Column>
        )}

        <Column lg={8} md={4} sm={4}>
          <div className={styles.formField}>
            <Controller
              name="rupturedMembranes"
              control={control}
              render={({ field }) => (
                <Select id="ruptured-membranes" labelText={t('rupturedMembranes', 'Ruptured Membranes')} {...field}>
                  <SelectItem value="yes" text={t('yes', 'Yes')} />
                  <SelectItem value="no" text={t('no', 'No')} />
                  <SelectItem value="unknown" text={t('unknown', 'Unknown')} />
                  <SelectItem value="intact" text={t('intact', 'Intact')} />
                </Select>
              )}
            />
          </div>
        </Column>

        {/* ROW 3: Conditional Rupture Details */}
        {rupturedMembranesValue === 'yes' && (
          <>
            <Column lg={8} md={4} sm={4}>
              <div className={styles.formField}>
                <Controller
                  name="rupturedMembranesDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      datePickerType="single"
                      dateFormat="Y-m-d"
                      onChange={([date]) => field.onChange(date?.toISOString().split('T')[0])}>
                      <DatePickerInput
                        id="rupture-date"
                        labelText={t('dateOfRupture', 'Date of Rupture')}
                        placeholder="YYYY-MM-DD"
                      />
                    </DatePicker>
                  )}
                />
              </div>
            </Column>
            <Column lg={8} md={4} sm={4}>
              <div className={styles.formField}>
                <Controller
                  name="rupturedMembranesTime"
                  control={control}
                  render={({ field, fieldState }) => (
                    <AdmissionDetailsTimePickerDropdown
                      id="rupture-time"
                      labelText={t('timeOfRupture', 'Time of Rupture')}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!fieldState.error}
                      invalidText={fieldState.error?.message}
                    />
                  )}
                />
              </div>
            </Column>
          </>
        )}
      </Grid>
    </Modal>
  );
};

export default AdmissionDetailsForm;
