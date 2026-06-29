import React from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { Modal, Grid, Column, Select, SelectItem, TextInput, NumberInput, InlineNotification } from '@carbon/react';
import styles from '../partography-data-form.scss';
import {
  APGAR_MAX,
  APGAR_MIN,
  BABY_CONDITION_VALUES,
  BIRTH_LENGTH_MAX_CM,
  BIRTH_LENGTH_MIN_CM,
  BLOOD_LOSS_MAX_VAGINAL,
  CADRE_VALUES,
  CODED_NO,
  CODED_YES,
  DEFORMITY_TYPE_VALUES,
  DEFORMITY_YES,
  DELIVERY_MODE_VALUES,
  PERINEUM_EXAMINATION_VALUES,
  PLACENTA_COMPLETE_VALUES,
  SEX_VALUES,
  UTEROTONIC_GIVEN_VALUES,
} from '../constants/summary-of-labour.constants';
import {
  saveSummaryOfLabour,
  getMaxDatetimeLocalValue,
  isFutureDateTimeLocalValue,
  type SummaryOfLabourFormData,
} from '../resources/summary-of-labour.resource';
import { getBabyFieldVisibility } from '../summary-of-labour-prefill.utils';

export type SummaryOfLabourFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SummaryOfLabourFormData) => void;
  onDataSaved?: () => void;
  patient?: { uuid: string };
  initialValues: SummaryOfLabourFormData;
  isTwin: boolean;
};

const YES_NO_OPTIONS = [
  { value: CODED_YES, label: 'Yes' },
  { value: CODED_NO, label: 'No' },
];

const FOUR_COL = { lg: 4, md: 4, sm: 4 } as const;

type SelectFieldProps = {
  id: string;
  labelText: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  invalidText?: string;
  children: React.ReactNode;
};

const FormSelectField: React.FC<SelectFieldProps> = ({
  id,
  labelText,
  value,
  onChange,
  invalid,
  invalidText,
  children,
}) => (
  <div className={styles.formField}>
    <Select
      id={id}
      labelText={labelText}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
      invalid={invalid}
      invalidText={invalidText}>
      {children}
    </Select>
  </div>
);

const SectionHeading: React.FC<{ title: string }> = ({ title }) => (
  <Column lg={16} md={8} sm={4}>
    <h4 className={styles.sectionFormHeading}>{title}</h4>
  </Column>
);

const SummaryOfLabourForm: React.FC<SummaryOfLabourFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDataSaved,
  patient,
  initialValues,
  isTwin,
}) => {
  const { t } = useTranslation();
  const maxDateTimeLocal = getMaxDatetimeLocalValue();
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const { control, handleSubmit, reset, watch } = useForm<SummaryOfLabourFormData>({
    defaultValues: initialValues,
  });
  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      reset(initialValues);
      setSaveError(null);
      setSaveSuccess(false);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialValues, reset]);

  const deliveryMode = watch('deliveryMode');
  const perineumExamination = watch('perineumExamination');
  const repair = watch('repair');
  const cadre = watch('cadre');
  const uterotonicGiven = watch('uterotonicGiven');
  const babies = watch('babies');

  const showBloodLossField = isTwin
    ? (babies ?? []).some(
        (baby) => Boolean(baby.deliveryMode) && baby.deliveryMode !== DELIVERY_MODE_VALUES.caesareanSection,
      )
    : Boolean(deliveryMode) && deliveryMode !== DELIVERY_MODE_VALUES.caesareanSection;
  const bloodLossMax = BLOOD_LOSS_MAX_VAGINAL;
  const showRepairField =
    Boolean(perineumExamination) &&
    perineumExamination !== PERINEUM_EXAMINATION_VALUES.intact &&
    perineumExamination !== PERINEUM_EXAMINATION_VALUES.laceration;
  const showRepairDoneBy = repair === CODED_YES;
  const showUterotonicOther = uterotonicGiven === UTEROTONIC_GIVEN_VALUES.other;

  const handleFormSubmit = async (data: SummaryOfLabourFormData) => {
    if (!patient?.uuid) {
      setSaveError(t('noPatient', 'Patient information is missing'));
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await saveSummaryOfLabour(patient.uuid, data, t);
      if (!result.success) {
        setSaveError(result.message);
        return;
      }

      setSaveSuccess(true);
      onSubmit(data);
      onDataSaved?.();
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch {
      setSaveError(t('saveError', 'Failed to save data'));
    } finally {
      setIsSaving(false);
    }
  };

  const renderSelect = (
    name: FieldPath<SummaryOfLabourFormData>,
    id: string,
    labelText: string,
    options: React.ReactNode,
    rules?: object,
  ) => (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState }) => (
        <FormSelectField
          id={id}
          labelText={labelText}
          value={field.value as string}
          onChange={(nextValue) => field.onChange(nextValue)}
          invalid={!!fieldState.error}
          invalidText={fieldState.error?.message}>
          <SelectItem value="" text={t('select', 'Select...')} />
          {options}
        </FormSelectField>
      )}
    />
  );

  const renderDeliveryModeOptions = () => (
    <>
      <SelectItem
        value={DELIVERY_MODE_VALUES.spontaneousVaginal}
        text={t('svdFull', 'Spontaneous vaginal delivery(SVD)')}
      />
      <SelectItem value={DELIVERY_MODE_VALUES.caesareanSection} text={t('csFull', 'Cesarean section(CS)')} />
      <SelectItem value={DELIVERY_MODE_VALUES.breech} text={t('breechDelivery', 'Breech delivery')} />
      <SelectItem value={DELIVERY_MODE_VALUES.assistedVaginal} text={t('avdFull', 'Assisted vaginal delivery(AVD)')} />
    </>
  );

  const renderPlacentaCompleteOptions = () => (
    <>
      <SelectItem value={PLACENTA_COMPLETE_VALUES.yes} text={t('yes', 'Yes')} />
      <SelectItem value={PLACENTA_COMPLETE_VALUES.no} text={t('no', 'No')} />
      <SelectItem
        value={PLACENTA_COMPLETE_VALUES.babyBornBeforeArrival}
        text={t('babyBornBeforeArrival', 'Baby born before arrival')}
      />
    </>
  );

  const renderBabyDeliveryAndPlacentaFields = (index: number) => {
    const babyPrefix = `babies.${index}` as const;

    return (
      <>
        <SectionHeading
          title={t('deliveryDetailsForBaby', 'Delivery details — Baby {{index}}', { index: index + 1 })}
        />
        <Column {...FOUR_COL}>
          {renderSelect(
            `${babyPrefix}.deliveryMode`,
            `baby-delivery-mode-${index}`,
            t('modeOfDelivery', 'Mode of delivery *'),
            renderDeliveryModeOptions(),
            { required: t('requiredField', 'This field is required') },
          )}
        </Column>
        <Column {...FOUR_COL}>
          <div className={styles.formField}>
            <Controller
              name={`${babyPrefix}.durationOfLabourHours`}
              control={control}
              render={({ field }) => (
                <NumberInput
                  id={`baby-duration-${index}`}
                  label={t('durationOfLabourHours', 'Duration of labour (hrs)')}
                  step={1}
                  allowEmpty
                  value={field.value}
                  onChange={(_event, { value }) =>
                    field.onChange(value === '' || value === undefined ? '' : Math.round(Number(value)))
                  }
                />
              )}
            />
          </div>
        </Column>
        <Column {...FOUR_COL}>
          <div className={styles.formField}>
            <Controller
              name={`${babyPrefix}.deliveryDateTime`}
              control={control}
              rules={{ required: t('requiredField', 'This field is required') }}
              render={({ field, fieldState }) => (
                <TextInput
                  id={`baby-delivery-datetime-${index}`}
                  type="datetime-local"
                  labelText={t('dateAndTimeOfDelivery', 'Date and time of delivery *')}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value)}
                  onBlur={field.onBlur}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}
                />
              )}
            />
          </div>
        </Column>
        <Column {...FOUR_COL}>
          <div className={styles.formField}>
            <Controller
              name={`${babyPrefix}.deliveryConductedBy`}
              control={control}
              render={({ field }) => (
                <TextInput
                  id={`baby-delivery-conducted-by-${index}`}
                  labelText={t('deliveryConductedBy', 'Delivery conducted by')}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              )}
            />
          </div>
        </Column>

        <SectionHeading title={t('thirdStageForBaby', 'Third stage — Baby {{index}} placenta', { index: index + 1 })} />
        <Column {...FOUR_COL}>
          {renderSelect(
            `${babyPrefix}.placentaComplete`,
            `baby-placenta-complete-${index}`,
            t('placentaComplete', 'Placenta complete'),
            renderPlacentaCompleteOptions(),
          )}
        </Column>
        <Column {...FOUR_COL}>
          <div className={styles.formField}>
            <Controller
              name={`${babyPrefix}.placentaExpelledDateTime`}
              control={control}
              rules={{
                validate: (value) =>
                  value && isFutureDateTimeLocalValue(value)
                    ? t('futureDateTimeNotAllowed', 'Date and time cannot be in the future')
                    : true,
              }}
              render={({ field, fieldState }) => (
                <TextInput
                  id={`baby-placenta-expelled-${index}`}
                  type="datetime-local"
                  labelText={t('placentaExpelledDateTime', 'Date and time placenta expelled')}
                  max={maxDateTimeLocal}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value)}
                  onBlur={field.onBlur}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}
                />
              )}
            />
          </div>
        </Column>
        <Column {...FOUR_COL}>
          <div className={styles.formField}>
            <Controller
              name={`${babyPrefix}.placentaWeightG`}
              control={control}
              render={({ field }) => (
                <NumberInput
                  id={`baby-placenta-weight-${index}`}
                  label={t('placentaWeightG', 'Placenta weight (g)')}
                  value={field.value}
                  onChange={(_event, { value }) => field.onChange(value)}
                />
              )}
            />
          </div>
        </Column>
      </>
    );
  };

  const renderBabyFields = (index: number) => {
    const birthWithDeformity = babies?.[index]?.birthWithDeformity;
    const deformityType = babies?.[index]?.deformityType;
    const babyCondition = babies?.[index]?.condition ?? '';
    const fieldVisibility = getBabyFieldVisibility(babyCondition);
    const showDeformityType = fieldVisibility.birthWithDeformity && birthWithDeformity === DEFORMITY_YES;
    const showDeformityOther = showDeformityType && deformityType === DEFORMITY_TYPE_VALUES.other;
    const babyPrefix = `babies.${index}` as const;

    return (
      <div className={styles.summaryBabyBlock} key={`baby-form-${index}`}>
        <Grid className={styles.formGrid}>
          {isTwin ? renderBabyDeliveryAndPlacentaFields(index) : null}
          <SectionHeading
            title={isTwin ? t('babyWithIndex', 'Baby {{index}}', { index: index + 1 }) : t('baby', 'Baby')}
          />

          <Column {...FOUR_COL}>
            {renderSelect(
              `${babyPrefix}.condition`,
              `baby-condition-${index}`,
              t('conditionOfBaby', 'Condition of baby *'),
              <>
                <SelectItem value={BABY_CONDITION_VALUES.liveBirth} text={t('liveBirth', 'Live birth')} />
                <SelectItem
                  value={BABY_CONDITION_VALUES.freshStillBirth}
                  text={t('freshStillBirth', 'Fresh still birth')}
                />
                <SelectItem
                  value={BABY_CONDITION_VALUES.maceratedStillBirth}
                  text={t('maceratedStillBirth', 'Macerated still birth')}
                />
              </>,
              { required: t('requiredField', 'This field is required') },
            )}
          </Column>
          {fieldVisibility.sex ? (
            <Column {...FOUR_COL}>
              {renderSelect(
                `${babyPrefix}.sex`,
                `baby-sex-${index}`,
                t('sex', 'Sex'),
                <>
                  <SelectItem value={SEX_VALUES.male} text={t('male', 'Male')} />
                  <SelectItem value={SEX_VALUES.female} text={t('female', 'Female')} />
                </>,
              )}
            </Column>
          ) : null}
          {fieldVisibility.birthWeightKg ? (
            <Column {...FOUR_COL}>
              <div className={styles.formField}>
                <Controller
                  name={`${babyPrefix}.birthWeightKg`}
                  control={control}
                  render={({ field }) => (
                    <NumberInput
                      id={`baby-weight-${index}`}
                      label={t('birthWeightKg', 'Birth weight (kg)')}
                      value={field.value === '' || field.value === undefined ? '' : field.value}
                      onChange={(_event, { value }) => field.onChange(value)}
                    />
                  )}
                />
              </div>
            </Column>
          ) : null}
          {fieldVisibility.birthLengthCm ? (
            <Column {...FOUR_COL}>
              <div className={styles.formField}>
                <Controller
                  name={`${babyPrefix}.birthLengthCm`}
                  control={control}
                  rules={{
                    min: {
                      value: BIRTH_LENGTH_MIN_CM,
                      message: t('minValue', 'Minimum value is {{value}}', { value: BIRTH_LENGTH_MIN_CM }),
                    },
                    max: {
                      value: BIRTH_LENGTH_MAX_CM,
                      message: t('maxValue', 'Maximum value is {{value}}', { value: BIRTH_LENGTH_MAX_CM }),
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <NumberInput
                      id={`baby-length-${index}`}
                      label={t('birthLengthCm', 'Birth length (cm)')}
                      min={BIRTH_LENGTH_MIN_CM}
                      max={BIRTH_LENGTH_MAX_CM}
                      invalid={!!fieldState.error}
                      invalidText={fieldState.error?.message}
                      value={field.value}
                      onChange={(_event, { value }) => field.onChange(value)}
                    />
                  )}
                />
              </div>
            </Column>
          ) : null}

          {fieldVisibility.headCircumferenceCm ? (
            <Column {...FOUR_COL}>
              <div className={styles.formField}>
                <Controller
                  name={`${babyPrefix}.headCircumferenceCm`}
                  control={control}
                  render={({ field }) => (
                    <NumberInput
                      id={`baby-head-${index}`}
                      label={t('headCircumferenceCm', 'Head circumference (cm)')}
                      value={field.value}
                      onChange={(_event, { value }) => field.onChange(value)}
                    />
                  )}
                />
              </div>
            </Column>
          ) : null}
          {fieldVisibility.apgarScores
            ? [1, 5, 10].map((minute) => {
                const apgarFieldName =
                  minute === 1
                    ? (`${babyPrefix}.apgar1Min` as const)
                    : minute === 5
                      ? (`${babyPrefix}.apgar5Min` as const)
                      : (`${babyPrefix}.apgar10Min` as const);
                return (
                  <Column {...FOUR_COL} key={`apgar-${minute}-${index}`}>
                    <div className={styles.formField}>
                      <Controller
                        name={apgarFieldName}
                        control={control}
                        rules={{
                          min: {
                            value: APGAR_MIN,
                            message: t('minValue', 'Minimum value is {{value}}', { value: APGAR_MIN }),
                          },
                          max: {
                            value: APGAR_MAX,
                            message: t('maxValue', 'Maximum value is {{value}}', { value: APGAR_MAX }),
                          },
                        }}
                        render={({ field, fieldState }) => (
                          <NumberInput
                            id={`apgar-${minute}-${index}`}
                            label={t('apgarScoreMin', 'Apgar score ({{minute}} min)', { minute })}
                            min={APGAR_MIN}
                            max={APGAR_MAX}
                            invalid={!!fieldState.error}
                            invalidText={fieldState.error?.message}
                            value={field.value}
                            onChange={(_event, { value }) => field.onChange(value)}
                          />
                        )}
                      />
                    </div>
                  </Column>
                );
              })
            : null}

          {fieldVisibility.birthWithDeformity ? (
            <Column {...FOUR_COL}>
              {renderSelect(
                `${babyPrefix}.birthWithDeformity`,
                `deformity-${index}`,
                t('birthWithDeformity', 'Birth with deformity'),
                <>
                  <SelectItem value={DEFORMITY_YES} text={t('yes', 'Yes')} />
                  <SelectItem value={CODED_NO} text={t('no', 'No')} />
                </>,
              )}
            </Column>
          ) : null}
          {showDeformityType ? (
            <Column {...FOUR_COL}>
              {renderSelect(
                `${babyPrefix}.deformityType`,
                `deformity-type-${index}`,
                t('typeOfBirthDeformity', 'Type of birth deformity'),
                <>
                  <SelectItem
                    value={DEFORMITY_TYPE_VALUES.congenitalSyphilis}
                    text={t('congenitalSyphilis', 'Congenital syphilis')}
                  />
                  <SelectItem value={DEFORMITY_TYPE_VALUES.spinaBifida} text={t('spinaBifida', 'Spina bifida')} />
                  <SelectItem value={DEFORMITY_TYPE_VALUES.hydrocephalus} text={t('hydrocephalus', 'Hydrocephalus')} />
                  <SelectItem value={DEFORMITY_TYPE_VALUES.talipes} text={t('talipes', 'Talipes')} />
                  <SelectItem value={DEFORMITY_TYPE_VALUES.other} text={t('other', 'Other')} />
                </>,
              )}
            </Column>
          ) : null}
          {showDeformityOther ? (
            <Column lg={8} md={8} sm={4}>
              <div className={styles.formField}>
                <Controller
                  name={`${babyPrefix}.deformityOtherSpecify`}
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id={`deformity-other-${index}`}
                      labelText={t('otherDeformitySpecify', 'Other deformity specify')}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>
            </Column>
          ) : null}
        </Grid>
      </div>
    );
  };

  return (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      modalHeading={t('summaryOfLabour', 'Summary of Labour')}
      primaryButtonText={isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
      primaryButtonDisabled={isSaving}
      secondaryButtonText={t('cancel', 'Cancel')}
      onRequestSubmit={handleSubmit(handleFormSubmit)}
      onSecondarySubmit={onClose}
      className={styles.summaryOfLabourModal}
      size="lg">
      {saveSuccess ? (
        <InlineNotification kind="success" title={t('saveSuccess', 'Data saved successfully')} hideCloseButton />
      ) : null}
      {saveError ? (
        <InlineNotification
          kind="error"
          title={t('saveError', 'Error saving data')}
          subtitle={saveError}
          onCloseButtonClick={() => setSaveError(null)}
        />
      ) : null}

      <div className={styles.summaryOfLabourModalBody}>
        <Grid className={styles.formGrid}>
          {!isTwin ? <SectionHeading title={t('deliveryDetails', 'Delivery details')} /> : null}

          {!isTwin ? (
            <>
              <Column {...FOUR_COL}>
                {renderSelect(
                  'deliveryMode',
                  'delivery-mode',
                  t('modeOfDelivery', 'Mode of delivery *'),
                  renderDeliveryModeOptions(),
                  { required: t('requiredField', 'This field is required') },
                )}
              </Column>
              <Column {...FOUR_COL}>
                <div className={styles.formField}>
                  <Controller
                    name="durationOfLabourHours"
                    control={control}
                    render={({ field }) => (
                      <NumberInput
                        id="duration-of-labour"
                        label={t('durationOfLabourHours', 'Duration of labour (hrs)')}
                        step={1}
                        allowEmpty
                        value={field.value}
                        onChange={(_event, { value }) =>
                          field.onChange(value === '' || value === undefined ? '' : Math.round(Number(value)))
                        }
                      />
                    )}
                  />
                </div>
              </Column>
              <Column {...FOUR_COL}>
                <div className={styles.formField}>
                  <Controller
                    name="deliveryDateTime"
                    control={control}
                    rules={{ required: t('requiredField', 'This field is required') }}
                    render={({ field, fieldState }) => (
                      <TextInput
                        id="delivery-datetime"
                        type="datetime-local"
                        labelText={t('dateAndTimeOfDelivery', 'Date and time of delivery *')}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        invalid={!!fieldState.error}
                        invalidText={fieldState.error?.message}
                      />
                    )}
                  />
                </div>
              </Column>
              <Column {...FOUR_COL}>
                <div className={styles.formField}>
                  <Controller
                    name="deliveryConductedBy"
                    control={control}
                    render={({ field }) => (
                      <TextInput
                        id="delivery-conducted-by"
                        labelText={t('deliveryConductedBy', 'Delivery conducted by')}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    )}
                  />
                </div>
              </Column>
            </>
          ) : null}

          <Column {...FOUR_COL}>
            {renderSelect(
              'cadre',
              'cadre',
              t('cadre', 'Cadre'),
              <>
                <SelectItem
                  value={CADRE_VALUES.clinicalOfficerDoctor}
                  text={t('clinicalOfficerDoctor', 'Clinical officer/Doctor')}
                />
                <SelectItem value={CADRE_VALUES.midwife} text={t('midwife', 'Midwife')} />
                <SelectItem value={CADRE_VALUES.nurse} text={t('nurse', 'Nurse')} />
                <SelectItem value={CADRE_VALUES.other} text={t('other', 'Other')} />
              </>,
            )}
          </Column>
          {cadre === CADRE_VALUES.other ? (
            <Column {...FOUR_COL}>
              <div className={styles.formField}>
                <Controller
                  name="cadreOtherSpecify"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id="cadre-other"
                      labelText={t('otherSpecify', 'Other specify')}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>
            </Column>
          ) : null}
        </Grid>

        {isTwin ? (babies ?? []).map((_, index) => renderBabyFields(index)) : null}

        <Grid className={styles.formGrid}>
          {!isTwin ? <SectionHeading title={t('thirdStage', 'Third stage')} /> : null}

          {!isTwin ? (
            <>
              <Column {...FOUR_COL}>
                {renderSelect(
                  'placentaComplete',
                  'placenta-complete',
                  t('placentaComplete', 'Placenta complete'),
                  renderPlacentaCompleteOptions(),
                )}
              </Column>
              <Column {...FOUR_COL}>
                <div className={styles.formField}>
                  <Controller
                    name="placentaExpelledDateTime"
                    control={control}
                    rules={{
                      validate: (value) =>
                        value && isFutureDateTimeLocalValue(value)
                          ? t('futureDateTimeNotAllowed', 'Date and time cannot be in the future')
                          : true,
                    }}
                    render={({ field, fieldState }) => (
                      <TextInput
                        id="placenta-expelled-datetime"
                        type="datetime-local"
                        labelText={t('placentaExpelledDateTime', 'Date and time placenta expelled')}
                        max={maxDateTimeLocal}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        invalid={!!fieldState.error}
                        invalidText={fieldState.error?.message}
                      />
                    )}
                  />
                </div>
              </Column>
              <Column {...FOUR_COL}>
                <div className={styles.formField}>
                  <Controller
                    name="placentaWeightG"
                    control={control}
                    render={({ field }) => (
                      <NumberInput
                        id="placenta-weight"
                        label={t('placentaWeightG', 'Placenta weight (g)')}
                        value={field.value}
                        onChange={(_event, { value }) => field.onChange(value)}
                      />
                    )}
                  />
                </div>
              </Column>
            </>
          ) : null}

          {isTwin ? <SectionHeading title={t('thirdStageMother', 'Third stage — mother')} /> : null}

          {showBloodLossField ? (
            <Column {...FOUR_COL}>
              <div className={styles.formField}>
                <Controller
                  name="bloodLossMl"
                  control={control}
                  rules={{
                    min: { value: 0, message: t('minValue', 'Minimum value is {{value}}', { value: 0 }) },
                    max: {
                      value: bloodLossMax,
                      message: t('maxValue', 'Maximum value is {{value}}', { value: bloodLossMax }),
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <NumberInput
                      id="blood-loss"
                      label={t('bloodLossMl', 'Blood loss (ml)')}
                      min={0}
                      max={bloodLossMax}
                      invalid={!!fieldState.error}
                      invalidText={fieldState.error?.message}
                      helperText={t('bloodLossRangeHint', 'Allowed range: 0-{{max}} ml', { max: bloodLossMax })}
                      value={field.value}
                      onChange={(_event, { value }) => field.onChange(value)}
                    />
                  )}
                />
              </div>
            </Column>
          ) : null}

          <Column {...FOUR_COL}>
            {renderSelect(
              'uterotonicGiven',
              'uterotonic-given',
              t('uterotonicGiven', 'Uterotonic given'),
              <>
                <SelectItem value={UTEROTONIC_GIVEN_VALUES.none} text={t('none', 'None')} />
                <SelectItem value={UTEROTONIC_GIVEN_VALUES.oxytocin} text={t('oxytocin', 'Oxytocin')} />
                <SelectItem value={UTEROTONIC_GIVEN_VALUES.carbetocin} text={t('carbetocin', 'Carbetocin')} />
                <SelectItem value={UTEROTONIC_GIVEN_VALUES.other} text={t('other', 'Other')} />
              </>,
            )}
          </Column>
          {showUterotonicOther ? (
            <Column {...FOUR_COL}>
              <div className={styles.formField}>
                <Controller
                  name="uterotonicOtherSpecify"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id="uterotonic-other"
                      labelText={t('otherUterotonicSpecify', 'Other uterotonic specify')}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>
            </Column>
          ) : null}
          <Column {...FOUR_COL}>
            {renderSelect(
              'perineumExamination',
              'perineum-examination',
              t('perineumExamination', 'Perineum examination'),
              <>
                <SelectItem value={PERINEUM_EXAMINATION_VALUES.intact} text={t('intact', 'Intact')} />
                <SelectItem value={PERINEUM_EXAMINATION_VALUES.laceration} text={t('laceration', 'Laceration')} />
                <SelectItem value={PERINEUM_EXAMINATION_VALUES.episiotomy} text={t('episiotomy', 'Episiotomy')} />
                <SelectItem
                  value={PERINEUM_EXAMINATION_VALUES.tear1stDegree}
                  text={t('tear1stDegree', 'Tear 1st Degree')}
                />
                <SelectItem
                  value={PERINEUM_EXAMINATION_VALUES.tear2ndDegree}
                  text={t('tear2ndDegree', 'Tear 2nd Degree')}
                />
                <SelectItem
                  value={PERINEUM_EXAMINATION_VALUES.tear3rdDegree}
                  text={t('tear3rdDegree', 'Tear 3rd Degree')}
                />
                <SelectItem
                  value={PERINEUM_EXAMINATION_VALUES.tear4thDegree}
                  text={t('tear4thDegree', 'Tear 4th Degree')}
                />
              </>,
            )}
          </Column>
          {showRepairField ? (
            <Column {...FOUR_COL}>
              {renderSelect(
                'repair',
                'repair',
                t('repair', 'Repair'),
                YES_NO_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} text={option.label} />
                )),
              )}
            </Column>
          ) : null}
          {showRepairDoneBy ? (
            <Column {...FOUR_COL}>
              <div className={styles.formField}>
                <Controller
                  name="repairDoneBy"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id="repair-done-by"
                      labelText={t('repairDoneBy', 'Repair done by')}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>
            </Column>
          ) : null}
        </Grid>

        {!isTwin ? (babies ?? []).map((_, index) => renderBabyFields(index)) : null}
      </div>
    </Modal>
  );
};

export default SummaryOfLabourForm;
