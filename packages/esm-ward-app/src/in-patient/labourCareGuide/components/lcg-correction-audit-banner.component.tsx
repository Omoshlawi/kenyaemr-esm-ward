import React from 'react';
import { InlineNotification } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import {
  formatCorrectionAuditSubtitle,
  type LcgCorrectionAuditRecord,
} from '../resources/lcg-session-correction.resource';
import styles from '../labour-care-guide.scss';

type LcgCorrectionAuditBannerProps = {
  auditRecord?: LcgCorrectionAuditRecord | null;
  variant?: 'chart' | 'sdm' | 'form';
};

export const LcgCorrectionAuditBanner: React.FC<LcgCorrectionAuditBannerProps> = ({ auditRecord, variant = 'sdm' }) => {
  const { t } = useTranslation();

  if (!auditRecord) {
    return null;
  }

  const subtitle = formatCorrectionAuditSubtitle(auditRecord);
  const title =
    variant === 'chart'
      ? t('lcgAuditChartTitle', 'Session corrected — data transferred from wrong chart')
      : t('lcgAuditSdmTitle', 'Shared Decision Making — transferred session audit');

  const bannerClassName =
    variant === 'form'
      ? styles.correctionAuditBannerForm
      : variant === 'chart'
        ? styles.correctionAuditBannerChart
        : styles.correctionAuditBanner;

  return (
    <div className={bannerClassName}>
      <InlineNotification kind="warning" lowContrast hideCloseButton title={title} subtitle={subtitle} />
    </div>
  );
};

export default LcgCorrectionAuditBanner;
