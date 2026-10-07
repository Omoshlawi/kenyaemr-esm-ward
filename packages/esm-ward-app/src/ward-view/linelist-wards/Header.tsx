import React from 'react';
import { Button } from '@carbon/react';
import { InPatientPictogram, navigate, PageHeader, PageHeaderContent, showModal } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChangeCatalog } from '@carbon/react/icons';

import styles from './linelist-wards.scss';

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, children }) => {
  const { t } = useTranslation();

  const handleSwitchWard = () => {
    const dispose = showModal('ward-switch-modal', {
      closeModal: () => dispose(),
    });
  };
  return (
    <PageHeader className={styles.pageHeader}>
      <PageHeaderContent
        className={styles.pageHeaderContent}
        title={title}
        illustration={<InPatientPictogram className={styles.pageIllustration} />}
      />
      <div className={styles.pageHeaderRight}>
        <div className={styles.pageHeaderActions}>
          <Button
            size="sm"
            kind="ghost"
            className={styles.headerLink}
            renderIcon={ArrowRight}
            onClick={() => navigate({ to: `${globalThis.spaBase}/home/ward?view=both` })}>
            {t('backToWards', 'Back to Wards')}
          </Button>
          <Button
            size="sm"
            kind="ghost"
            className={styles.headerLink}
            renderIcon={ChangeCatalog}
            onClick={handleSwitchWard}>
            {t('switchWard', 'Switch Ward')}
          </Button>
        </div>
        {children}
      </div>
    </PageHeader>
  );
};

export default Header;
