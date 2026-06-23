import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './table-state-components';
import {
  WARD_PATIENTS_ADMITTED_SLOT,
  WARD_PATIENTS_AWAITING_ADMISSION_SLOT,
  WARD_PATIENTS_DISCHARGE_IN_SLOT,
  WARD_PATIENTS_DISCHARGED_SLOT,
} from './ward-patients-slots';

const WardPatientsTabPanel: React.FC<{ slotName: string }> = ({ slotName }) => {
  const { t } = useTranslation();
  const assignedExtensions = useAssignedExtensions(slotName);

  if (!assignedExtensions.length) {
    return (
      <EmptyState message={t('noExtensionForWardPatientsTab', 'No component configured for this ward patients tab')} />
    );
  }

  return <ExtensionSlot name={slotName} />;
};

const WardPatientsTable = () => {
  const { t } = useTranslation();

  return (
    <Tabs onTabCloseRequest={() => {}}>
      <TabList scrollDebounceWait={200}>
        <Tab>{t('awaitingAdmision', 'Awaiting Admission')}</Tab>
        <Tab>{t('admitted', 'Admitted')}</Tab>
        <Tab>{t('dischargeIn', 'Discharge In')}</Tab>
        <Tab>{t('discharged', 'Discharged')}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          <WardPatientsTabPanel slotName={WARD_PATIENTS_AWAITING_ADMISSION_SLOT} />
        </TabPanel>
        <TabPanel>
          <WardPatientsTabPanel slotName={WARD_PATIENTS_ADMITTED_SLOT} />
        </TabPanel>
        <TabPanel>
          <WardPatientsTabPanel slotName={WARD_PATIENTS_DISCHARGE_IN_SLOT} />
        </TabPanel>
        <TabPanel>
          <WardPatientsTabPanel slotName={WARD_PATIENTS_DISCHARGED_SLOT} />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};

export default WardPatientsTable;
