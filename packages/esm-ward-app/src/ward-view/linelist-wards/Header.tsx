import React from 'react';
import { Button } from '@carbon/react';
import { InPatientPictogram, navigate, PageHeader, PageHeaderContent, showModal } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { ChangeCatalog, Return } from '@carbon/react/icons';

import styles from './linelist-wards.scss';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const { t } = useTranslation();

  const handleSwitchWard = () => {
    const dispose = showModal('ward-switch-modal', {
      closeModal: () => dispose(),
    });
  };
  return (
    <PageHeader className={styles.pageHeader}>
      <PageHeaderContent title={title} illustration={<InPatientPictogram />} />
      <div className={styles.pageHeaderActions}>
        <Button
          size="sm"
          kind="ghost"
          renderIcon={Return}
          onClick={() => navigate({ to: `${globalThis.spaBase}/home/ward?view=both` })}>
          {t('backToWards', 'Back to Wards')}
        </Button>
        <Button size="sm" renderIcon={ChangeCatalog} kind="ghost" onClick={handleSwitchWard}>
          {t('switchWard', 'Switch Ward')}
        </Button>
      </div>
    </PageHeader>
  );
};

export default Header;
