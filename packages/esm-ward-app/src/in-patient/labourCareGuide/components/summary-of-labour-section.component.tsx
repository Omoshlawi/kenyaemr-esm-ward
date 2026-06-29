import React from 'react';
import { useTranslation } from 'react-i18next';
import { Add } from '@carbon/react/icons';
import styles from '../labour-care-guide.scss';
import type { SummaryOfLabourFormData } from '../resources/summary-of-labour.resource';
import { formatSummaryCodedLabel } from '../resources/summary-of-labour.resource';
import {
  BABY_CONDITION_VALUES,
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
import { getBabyFieldVisibility } from '../summary-of-labour-prefill.utils';

const DELIVERY_MODE_OPTIONS = [
  { value: DELIVERY_MODE_VALUES.spontaneousVaginal, label: 'Spontaneous vaginal delivery(SVD)' },
  { value: DELIVERY_MODE_VALUES.caesareanSection, label: 'Cesarean section(CS)' },
  { value: DELIVERY_MODE_VALUES.breech, label: 'Breech delivery' },
  { value: DELIVERY_MODE_VALUES.assistedVaginal, label: 'Assisted vaginal delivery(AVD)' },
];

const YES_NO_OPTIONS = [
  { value: CODED_YES, label: 'Yes' },
  { value: CODED_NO, label: 'No' },
];

const CADRE_OPTIONS = [
  { value: CADRE_VALUES.clinicalOfficerDoctor, label: 'Clinical officer/Doctor' },
  { value: CADRE_VALUES.midwife, label: 'Midwife' },
  { value: CADRE_VALUES.nurse, label: 'Nurse' },
  { value: CADRE_VALUES.other, label: 'Other' },
];

const UTEROTONIC_OPTIONS = [
  { value: UTEROTONIC_GIVEN_VALUES.none, label: 'None' },
  { value: UTEROTONIC_GIVEN_VALUES.oxytocin, label: 'Oxytocin' },
  { value: UTEROTONIC_GIVEN_VALUES.carbetocin, label: 'Carbetocin' },
  { value: UTEROTONIC_GIVEN_VALUES.other, label: 'Other' },
];

const DEFORMITY_TYPE_OPTIONS = [
  { value: DEFORMITY_TYPE_VALUES.congenitalSyphilis, label: 'Congenital syphilis' },
  { value: DEFORMITY_TYPE_VALUES.spinaBifida, label: 'Spina bifida' },
  { value: DEFORMITY_TYPE_VALUES.hydrocephalus, label: 'Hydrocephalus' },
  { value: DEFORMITY_TYPE_VALUES.talipes, label: 'Talipes' },
  { value: DEFORMITY_TYPE_VALUES.other, label: 'Other' },
];

type SummaryOfLabourSectionProps = {
  displayData: SummaryOfLabourFormData;
  summaryFilled: boolean;
  onAddClick?: () => void;
};

const formatDateTime = (value: string) => {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const formatDisplayValue = (value: string | number | '' | undefined) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  return String(value);
};

const formatCodedDisplay = (value: string, options: Array<{ value: string; label: string }>) => {
  if (!value) {
    return null;
  }
  return formatSummaryCodedLabel(value, options) || null;
};

const SummaryField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => {
  const isEmpty = value === null || value === undefined || value === '';
  return (
    <div className={styles.summaryField}>
      <span className={styles.summaryFieldLabel}>{label}</span>
      <span
        className={isEmpty ? `${styles.summaryFieldValue} ${styles.summaryFieldValueEmpty}` : styles.summaryFieldValue}>
        {isEmpty ? '—' : value}
      </span>
    </div>
  );
};

const SummaryFieldGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={styles.summaryFieldGrid}>{children}</div>
);

const SummaryOfLabourSection: React.FC<SummaryOfLabourSectionProps> = ({ displayData, summaryFilled, onAddClick }) => {
  const { t } = useTranslation();
  const isTwin = displayData.babies.length > 1;
  const showBloodLoss = isTwin
    ? displayData.babies.some(
        (baby) => Boolean(baby.deliveryMode) && baby.deliveryMode !== DELIVERY_MODE_VALUES.caesareanSection,
      )
    : Boolean(displayData.deliveryMode) && displayData.deliveryMode !== DELIVERY_MODE_VALUES.caesareanSection;

  const renderPlacentaFields = (
    placentaComplete: string,
    placentaExpelledDateTime: string,
    placentaWeightG: number | '',
  ) => (
    <>
      <SummaryField
        label={t('placentaComplete', 'Placenta complete')}
        value={formatCodedDisplay(placentaComplete, [
          { value: PLACENTA_COMPLETE_VALUES.yes, label: 'Yes' },
          { value: PLACENTA_COMPLETE_VALUES.no, label: 'No' },
          { value: PLACENTA_COMPLETE_VALUES.babyBornBeforeArrival, label: 'Baby born before arrival' },
        ])}
      />
      <SummaryField
        label={t('placentaExpelledDateTime', 'Date and time placenta expelled')}
        value={placentaExpelledDateTime ? formatDateTime(placentaExpelledDateTime) : null}
      />
      <SummaryField label={t('placentaWeightG', 'Placenta weight (g)')} value={formatDisplayValue(placentaWeightG)} />
    </>
  );

  const renderDeliveryFields = (
    deliveryMode: string,
    durationOfLabourHours: number | '',
    deliveryDateTime: string,
    deliveryConductedBy: string,
  ) => (
    <>
      <SummaryField
        label={t('modeOfDelivery', 'Mode of delivery')}
        value={formatCodedDisplay(deliveryMode, DELIVERY_MODE_OPTIONS)}
      />
      <SummaryField
        label={t('durationOfLabourHours', 'Duration of labour (hrs)')}
        value={formatDisplayValue(durationOfLabourHours)}
      />
      <SummaryField
        label={t('dateAndTimeOfDelivery', 'Date and time of delivery')}
        value={deliveryDateTime ? formatDateTime(deliveryDateTime) : null}
      />
      <SummaryField
        label={t('deliveryConductedBy', 'Delivery conducted by')}
        value={formatDisplayValue(deliveryConductedBy)}
      />
    </>
  );

  return (
    <div className={styles.summaryOfLabourSection}>
      <div className={styles.summaryOfLabourHeader}>
        <h3 className={styles.summaryOfLabourTitle}>{t('summaryOfLabour', 'Summary of Labour')}</h3>
        {!summaryFilled && onAddClick ? (
          <button type="button" className={styles.headerAddButton} onClick={onAddClick}>
            <span>{t('add', 'Add')}</span>
            <span className={styles.addDivider} />
            <Add size={16} />
          </button>
        ) : null}
      </div>

      <div className={styles.summaryOfLabourGrid}>
        {!isTwin ? (
          <div className={styles.summaryOfLabourGroup}>
            <h4>{t('deliveryDetails', 'Delivery details')}</h4>
            <SummaryFieldGrid>
              {renderDeliveryFields(
                displayData.deliveryMode,
                displayData.durationOfLabourHours,
                displayData.deliveryDateTime,
                displayData.deliveryConductedBy,
              )}
              <SummaryField label={t('cadre', 'Cadre')} value={formatCodedDisplay(displayData.cadre, CADRE_OPTIONS)} />
              {displayData.cadre === CADRE_VALUES.other ? (
                <SummaryField
                  label={t('otherSpecify', 'Other specify')}
                  value={formatDisplayValue(displayData.cadreOtherSpecify)}
                />
              ) : null}
            </SummaryFieldGrid>
          </div>
        ) : (
          <div className={styles.summaryOfLabourGroup}>
            <h4>{t('sharedDetails', 'Shared details')}</h4>
            <SummaryFieldGrid>
              <SummaryField label={t('cadre', 'Cadre')} value={formatCodedDisplay(displayData.cadre, CADRE_OPTIONS)} />
              {displayData.cadre === CADRE_VALUES.other ? (
                <SummaryField
                  label={t('otherSpecify', 'Other specify')}
                  value={formatDisplayValue(displayData.cadreOtherSpecify)}
                />
              ) : null}
            </SummaryFieldGrid>
          </div>
        )}

        {!isTwin ? (
          <div className={styles.summaryOfLabourGroup}>
            <h4>{t('thirdStage', 'Third stage')}</h4>
            <SummaryFieldGrid>
              {renderPlacentaFields(
                displayData.placentaComplete,
                displayData.placentaExpelledDateTime,
                displayData.placentaWeightG,
              )}
              {showBloodLoss ? (
                <SummaryField
                  label={t('bloodLossMl', 'Blood loss (ml)')}
                  value={formatDisplayValue(displayData.bloodLossMl)}
                />
              ) : null}
            </SummaryFieldGrid>
            <SummaryFieldGrid>
              <SummaryField
                label={t('uterotonicGiven', 'Uterotonic given')}
                value={formatCodedDisplay(displayData.uterotonicGiven, UTEROTONIC_OPTIONS)}
              />
              {displayData.uterotonicGiven === UTEROTONIC_GIVEN_VALUES.other ? (
                <SummaryField
                  label={t('otherUterotonicSpecify', 'Other uterotonic specify')}
                  value={formatDisplayValue(displayData.uterotonicOtherSpecify)}
                />
              ) : null}
              <SummaryField
                label={t('perineumExamination', 'Perineum examination')}
                value={formatCodedDisplay(displayData.perineumExamination, [
                  { value: PERINEUM_EXAMINATION_VALUES.intact, label: 'Intact' },
                  { value: PERINEUM_EXAMINATION_VALUES.laceration, label: 'Laceration' },
                  { value: PERINEUM_EXAMINATION_VALUES.episiotomy, label: 'Episiotomy' },
                  { value: PERINEUM_EXAMINATION_VALUES.tear1stDegree, label: 'Tear 1st Degree' },
                  { value: PERINEUM_EXAMINATION_VALUES.tear2ndDegree, label: 'Tear 2nd Degree' },
                  { value: PERINEUM_EXAMINATION_VALUES.tear3rdDegree, label: 'Tear 3rd Degree' },
                  { value: PERINEUM_EXAMINATION_VALUES.tear4thDegree, label: 'Tear 4th Degree' },
                ])}
              />
              <SummaryField
                label={t('repair', 'Repair')}
                value={formatCodedDisplay(displayData.repair, YES_NO_OPTIONS)}
              />
              <SummaryField
                label={t('repairDoneBy', 'Repair done by')}
                value={formatDisplayValue(displayData.repairDoneBy)}
              />
            </SummaryFieldGrid>
          </div>
        ) : null}

        {displayData.babies.map((baby, index) => {
          const fieldVisibility = getBabyFieldVisibility(baby.condition);

          return (
            <div className={`${styles.summaryOfLabourGroup} ${styles.summaryBabyGroup}`} key={`baby-summary-${index}`}>
              {isTwin ? (
                <>
                  <h4>{t('deliveryDetailsForBaby', 'Delivery details — Baby {{index}}', { index: index + 1 })}</h4>
                  <SummaryFieldGrid>
                    {renderDeliveryFields(
                      baby.deliveryMode,
                      baby.durationOfLabourHours,
                      baby.deliveryDateTime,
                      baby.deliveryConductedBy,
                    )}
                  </SummaryFieldGrid>
                  <h4>{t('thirdStageForBaby', 'Third stage — Baby {{index}} placenta', { index: index + 1 })}</h4>
                  <SummaryFieldGrid>
                    {renderPlacentaFields(baby.placentaComplete, baby.placentaExpelledDateTime, baby.placentaWeightG)}
                  </SummaryFieldGrid>
                </>
              ) : null}
              <h4>{isTwin ? t('babyWithIndex', 'Baby {{index}}', { index: index + 1 }) : t('baby', 'Baby')}</h4>
              <SummaryFieldGrid>
                <SummaryField
                  label={t('conditionOfBaby', 'Condition of baby')}
                  value={formatCodedDisplay(baby.condition, [
                    { value: BABY_CONDITION_VALUES.liveBirth, label: 'Live birth' },
                    { value: BABY_CONDITION_VALUES.freshStillBirth, label: 'Fresh still birth' },
                    { value: BABY_CONDITION_VALUES.maceratedStillBirth, label: 'Macerated still birth' },
                  ])}
                />
                {fieldVisibility.sex ? (
                  <SummaryField
                    label={t('sex', 'Sex')}
                    value={formatCodedDisplay(baby.sex, [
                      { value: SEX_VALUES.male, label: 'Male' },
                      { value: SEX_VALUES.female, label: 'Female' },
                    ])}
                  />
                ) : null}
                {fieldVisibility.birthWeightKg ? (
                  <SummaryField
                    label={t('birthWeightKg', 'Birth weight (kg)')}
                    value={formatDisplayValue(baby.birthWeightKg)}
                  />
                ) : null}
                {fieldVisibility.birthLengthCm ? (
                  <SummaryField
                    label={t('birthLengthCm', 'Birth length (cm)')}
                    value={formatDisplayValue(baby.birthLengthCm)}
                  />
                ) : null}
                {fieldVisibility.headCircumferenceCm ? (
                  <SummaryField
                    label={t('headCircumferenceCm', 'Head circumference (cm)')}
                    value={formatDisplayValue(baby.headCircumferenceCm)}
                  />
                ) : null}
                {fieldVisibility.apgarScores ? (
                  <>
                    <SummaryField
                      label={t('apgarScoreMin', 'Apgar score (1 min)', { minute: 1 })}
                      value={formatDisplayValue(baby.apgar1Min)}
                    />
                    <SummaryField
                      label={t('apgarScoreMin', 'Apgar score (5 min)', { minute: 5 })}
                      value={formatDisplayValue(baby.apgar5Min)}
                    />
                    <SummaryField
                      label={t('apgarScoreMin', 'Apgar score (10 min)', { minute: 10 })}
                      value={formatDisplayValue(baby.apgar10Min)}
                    />
                  </>
                ) : null}
                {fieldVisibility.birthWithDeformity ? (
                  <SummaryField
                    label={t('birthWithDeformity', 'Birth with deformity')}
                    value={formatCodedDisplay(baby.birthWithDeformity, [
                      { value: DEFORMITY_YES, label: 'Yes' },
                      { value: CODED_NO, label: 'No' },
                    ])}
                  />
                ) : null}
              </SummaryFieldGrid>
              {fieldVisibility.birthWithDeformity &&
              baby.birthWithDeformity === DEFORMITY_YES &&
              (baby.deformityType || baby.deformityOtherSpecify) ? (
                <SummaryFieldGrid>
                  <SummaryField
                    label={t('typeOfBirthDeformity', 'Type of birth deformity')}
                    value={formatCodedDisplay(baby.deformityType, DEFORMITY_TYPE_OPTIONS)}
                  />
                  <SummaryField
                    label={t('otherDeformitySpecify', 'Other deformity specify')}
                    value={formatDisplayValue(baby.deformityOtherSpecify)}
                  />
                </SummaryFieldGrid>
              ) : null}
            </div>
          );
        })}

        {isTwin ? (
          <div className={styles.summaryOfLabourGroup}>
            <h4>{t('thirdStageMother', 'Third stage — mother')}</h4>
            <SummaryFieldGrid>
              {showBloodLoss ? (
                <SummaryField
                  label={t('bloodLossMl', 'Blood loss (ml)')}
                  value={formatDisplayValue(displayData.bloodLossMl)}
                />
              ) : null}
              <SummaryField
                label={t('uterotonicGiven', 'Uterotonic given')}
                value={formatCodedDisplay(displayData.uterotonicGiven, UTEROTONIC_OPTIONS)}
              />
              {displayData.uterotonicGiven === UTEROTONIC_GIVEN_VALUES.other ? (
                <SummaryField
                  label={t('otherUterotonicSpecify', 'Other uterotonic specify')}
                  value={formatDisplayValue(displayData.uterotonicOtherSpecify)}
                />
              ) : null}
              <SummaryField
                label={t('perineumExamination', 'Perineum examination')}
                value={formatCodedDisplay(displayData.perineumExamination, [
                  { value: PERINEUM_EXAMINATION_VALUES.intact, label: 'Intact' },
                  { value: PERINEUM_EXAMINATION_VALUES.laceration, label: 'Laceration' },
                  { value: PERINEUM_EXAMINATION_VALUES.episiotomy, label: 'Episiotomy' },
                  { value: PERINEUM_EXAMINATION_VALUES.tear1stDegree, label: 'Tear 1st Degree' },
                  { value: PERINEUM_EXAMINATION_VALUES.tear2ndDegree, label: 'Tear 2nd Degree' },
                  { value: PERINEUM_EXAMINATION_VALUES.tear3rdDegree, label: 'Tear 3rd Degree' },
                  { value: PERINEUM_EXAMINATION_VALUES.tear4thDegree, label: 'Tear 4th Degree' },
                ])}
              />
              <SummaryField
                label={t('repair', 'Repair')}
                value={formatCodedDisplay(displayData.repair, YES_NO_OPTIONS)}
              />
              <SummaryField
                label={t('repairDoneBy', 'Repair done by')}
                value={formatDisplayValue(displayData.repairDoneBy)}
              />
            </SummaryFieldGrid>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SummaryOfLabourSection;
