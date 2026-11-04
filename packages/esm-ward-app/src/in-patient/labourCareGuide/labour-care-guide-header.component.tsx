import React from 'react';
import { useTranslation } from 'react-i18next';
import { Add, Edit } from '@carbon/react/icons';
import { getPatientName } from '@openmrs/esm-framework';
import styles from './labour-care-guide.scss';

type LabourCareGuideHeaderProps = {
  patient: any;
  patientAge: string;
  parityDisplay: string;
  labourOnsetDisplay: string;
  displayDate: string;
  ruptureDisplay: string;
  riskFactors: string;
  gravidaValue: number;
  admissionDetailsFilled: boolean;
  canEditAdmissionDetails?: boolean;
  onAddAdmissionDetails: () => void;
  onEditAdmissionDetails?: () => void;
};

export const LabourCareGuideSummaryHeader: React.FC<LabourCareGuideHeaderProps> = ({
  patient,
  patientAge,
  parityDisplay,
  labourOnsetDisplay,
  displayDate,
  ruptureDisplay,
  riskFactors,
  gravidaValue,
  admissionDetailsFilled,
  canEditAdmissionDetails = false,
  onAddAdmissionDetails,
  onEditAdmissionDetails,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.headerRowsWrapper}>
      <div className={styles.headerRows}>
        {/* First Row */}
        <div className={styles.headerRowPrimary}>
          <div className={styles.infoItem}>
            <span className={styles.label}>{t('name', 'Name')} :</span>
            <span className={styles.value}>{patient ? getPatientName(patient) : ''}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>{t('age', 'Age')} :</span>
            <span className={styles.value}>{patientAge}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>{t('parity', 'Parity')} :</span>
            <span className={styles.value}>{parityDisplay}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>{t('labourOnset', 'Labour onset')} :</span>
            <span className={styles.value}>{labourOnsetDisplay}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>{t('activeLabourDiagnosis', 'Active Labour diagnosis')}</span>
            <span className={styles.value}>[{displayDate}]</span>
          </div>
        </div>

        {/* Second Row */}
        <div className={styles.headerRowSecondary}>
          <div className={styles.infoItem}>
            <span className={styles.label}>{t('rupturedMembranes', 'Ruptured membranes')} :</span>
            <span className={styles.value}>{ruptureDisplay}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>{t('riskFactors', 'Risk factors')} :</span>
            <span className={styles.riskFactorsValue}>{riskFactors}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>{t('gravida', 'Gravida')} :</span>
            <span className={styles.value}>{gravidaValue}</span>
          </div>
        </div>
      </div>

      {!admissionDetailsFilled ? (
        <button type="button" className={styles.headerAddButton} onClick={onAddAdmissionDetails}>
          <span>{t('add', 'Add')}</span>
          <span className={styles.addDivider} />
          <Add size={16} />
        </button>
      ) : canEditAdmissionDetails && onEditAdmissionDetails ? (
        <button
          type="button"
          className={styles.headerAddButton}
          onClick={onEditAdmissionDetails}
          title={t('editRiskFactors', 'Edit risk factors')}>
          <span>{t('edit', 'Edit')}</span>
          <span className={styles.addDivider} />
          <Edit size={16} />
        </button>
      ) : null}
    </div>
  );
};
