import { InlineNotification, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useCriticalCareWardTab } from '../hooks/useCriticalCareWardTab';
import AdmittedPatients from './admitted-patients';
import AwaitingAdmissionPatients from './awaiting-admission-patients';
import DischargeInPatients from './discharge-in-patients';
import DischargePatients from './discharge-patients';

export const WARD_PATIENTS_CRITICAL_CARE_SLOT = 'ward-patients-critical-care-slot';

const CriticalCareTabPanel: React.FC<{
  locationUuid?: string;
  wardKind: string;
  label: string;
}> = ({ locationUuid, wardKind, label }) => {
  const { t } = useTranslation();
  const assigned = useAssignedExtensions(WARD_PATIENTS_CRITICAL_CARE_SLOT);

  if (!assigned.length) {
    return (
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('criticalCareModuleMissing', '{{label}} dashboard not loaded', { label })}
        subtitle={t(
          'criticalCareModuleMissingSubtitle',
          'Start @kenyaemr/esm-icu-app in the same SPA (openmrs develop --sources for both ward-app and icu-app) so the census and charts can appear here.',
        )}
      />
    );
  }

  return (
    <ExtensionSlot
      name={WARD_PATIENTS_CRITICAL_CARE_SLOT}
      state={{
        locationUuid,
        wardKind,
        label,
      }}
    />
  );
};

const WardPatientsTable = () => {
  const { t } = useTranslation();
  const { tab: criticalCareTab, locationUuid } = useCriticalCareWardTab();

  return (
    <Tabs onTabCloseRequest={() => {}}>
      <TabList scrollDebounceWait={200}>
        <Tab>{t('awaitingAdmision', 'Awaiting Admission')}</Tab>
        <Tab>{t('admitted', 'Admitted')}</Tab>
        <Tab>{t('dischargeIn', 'Discharge In')}</Tab>
        <Tab>{t('discharged', 'Discharged')}</Tab>
        {criticalCareTab ? <Tab>{t(criticalCareTab.kind, criticalCareTab.label)}</Tab> : null}
      </TabList>
      <TabPanels>
        <TabPanel>
          <AwaitingAdmissionPatients />
        </TabPanel>
        <TabPanel>
          <AdmittedPatients />
        </TabPanel>
        <TabPanel>
          <DischargeInPatients />
        </TabPanel>
        <TabPanel>
          <DischargePatients />
        </TabPanel>
        {criticalCareTab ? (
          <TabPanel>
            <CriticalCareTabPanel
              locationUuid={locationUuid}
              wardKind={criticalCareTab.kind}
              label={criticalCareTab.label}
            />
          </TabPanel>
        ) : null}
      </TabPanels>
    </Tabs>
  );
};

export default WardPatientsTable;
