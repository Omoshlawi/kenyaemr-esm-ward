import { InlineNotification, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FOCUS_ADMITTED_TAB_EVENT,
  isCriticalCarePatientChartPath,
  useCriticalCareEmbeddedPath,
} from '../hooks/open-critical-care-chart';
import { useCriticalCareWardTab } from '../hooks/useCriticalCareWardTab';
import { EmptyState } from './table-state-components';
import {
  WARD_PATIENTS_ADMITTED_SLOT,
  WARD_PATIENTS_AWAITING_ADMISSION_SLOT,
  WARD_PATIENTS_DISCHARGE_IN_SLOT,
  WARD_PATIENTS_DISCHARGED_SLOT,
  WARD_PATIENTS_TAB_INDEX,
  WARD_PATIENTS_UNASSIGNED_SLOT,
} from './ward-patients-slots';
import { updateWardViewUi, useWardViewUi } from '../ward-view/ward-view-ui.store';

import styles from './ward-patient.scss';

export const WARD_PATIENTS_CRITICAL_CARE_SLOT = 'ward-patients-critical-care-slot';

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

const CriticalCareChartHost: React.FC<{
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
        title={t('criticalCareModuleMissing', '{{label}} chart not loaded', { label })}
        subtitle={t(
          'criticalCareModuleMissingSubtitle',
          'Start @kenyaemr/esm-icu-app in the same SPA (openmrs develop --sources for both ward-app and icu-app) so charts can open from Admitted.',
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
  const embeddedPath = useCriticalCareEmbeddedPath();
  const storedTab = useWardViewUi((state) => state.selectedTab);
  const selectedIndex = Math.min(storedTab, WARD_PATIENTS_TAB_INDEX.discharged);
  const showCriticalCareChart =
    Boolean(criticalCareTab) && isCriticalCarePatientChartPath(embeddedPath);

  useEffect(() => {
    const onFocusAdmitted = () => {
      updateWardViewUi({ selectedTab: WARD_PATIENTS_TAB_INDEX.admitted, view: 'list' });
    };
    window.addEventListener(FOCUS_ADMITTED_TAB_EVENT, onFocusAdmitted);
    return () => window.removeEventListener(FOCUS_ADMITTED_TAB_EVENT, onFocusAdmitted);
  }, []);

  if (showCriticalCareChart && criticalCareTab) {
    return (
      <div className={styles.tabContainer}>
        <CriticalCareChartHost
          locationUuid={locationUuid}
          wardKind={criticalCareTab.kind}
          label={criticalCareTab.label}
        />
      </div>
    );
  }

  return (
    <div className={styles.tabContainer}>
      <Tabs
        selectedIndex={selectedIndex}
        onChange={({ selectedIndex: index }) => updateWardViewUi({ selectedTab: index })}
        onTabCloseRequest={() => {}}>
        <TabList contained scrollDebounceWait={200} aria-label={t('wardPatients', 'Ward Patients')}>
          <Tab>{t('awaitingAdmision', 'Awaiting Admission')}</Tab>
          <Tab>{t('admitted', 'Admitted')}</Tab>
          <Tab>{t('unassigned', 'Unassigned')}</Tab>
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
            <WardPatientsTabPanel slotName={WARD_PATIENTS_UNASSIGNED_SLOT} />
          </TabPanel>
          <TabPanel>
            <WardPatientsTabPanel slotName={WARD_PATIENTS_DISCHARGE_IN_SLOT} />
          </TabPanel>
          <TabPanel>
            <WardPatientsTabPanel slotName={WARD_PATIENTS_DISCHARGED_SLOT} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default WardPatientsTable;
