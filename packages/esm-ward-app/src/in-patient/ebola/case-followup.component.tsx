import { EmptyState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

const CaseFollowUp = () => {
  const { t } = useTranslation();
  return <EmptyState headerTitle={t('followups', 'FollowUps')} displayText={t('followups', 'FollowUps')} />;
};

export default CaseFollowUp;
