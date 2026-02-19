import React, { useState } from 'react';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
import { Dashboard, CloudMonitoring } from '@carbon/react/icons';
import {
  ExtensionSlot,
  InPatientPictogram,
  navigate,
  PageHeader,
  PageHeaderContent,
  useSession,
} from '@openmrs/esm-framework';
import styles from './home-page.scss';
import { useTranslation } from 'react-i18next';
import WardsLineList from '../ward-view/linelist-wards/WardsLineList';
import WardSelector from './ward-selector.component';
import { useSearchParams } from 'react-router-dom';

const HomePageComponent = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<number>(0);
  const { user } = useSession();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');

  const defaultWardLocationUuid = user?.userProperties?.defaultWardLocationUuid;
  if (defaultWardLocationUuid && !view) {
    navigate({ to: `${globalThis.spaBase}/home/ward/${defaultWardLocationUuid}` });
  }

  const handleTabChange = ({ selectedIndex }) => {
    setActiveTab(selectedIndex);
  };

  return (
    <div className={styles.contentArea}>
      <PageHeader className={styles.pageHeader}>
        <PageHeaderContent title={t('wards', 'Wards')} illustration={<InPatientPictogram />} />
        <ExtensionSlot name="provider-banner-info-slot" />
      </PageHeader>
      <div className={styles.tabsContainer}>
        <Tabs onChange={handleTabChange}>
          <TabList contained>
            <Tab renderIcon={Dashboard}>{t('wards', 'Wards')}</Tab>
            <Tab renderIcon={CloudMonitoring}>{t('inpatientMetrics', 'Inpatient Metrics')}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>{activeTab === 0 && <WardSelector />}</TabPanel>
            <TabPanel>{activeTab === 1 && <WardsLineList />}</TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};

export default HomePageComponent;
