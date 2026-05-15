import { Layer, Tab, TabList, TabPanel, TabPanels, Tabs, TabsSkeleton } from '@carbon/react';
import {
  type AssignedExtension,
  ErrorState,
  Extension,
  ExtensionSlot,
  type FHIRResource,
  useAssignedExtensions,
  usePatient,
  useRenderableExtensions,
} from '@openmrs/esm-framework';
import React, { type FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ComponentContext, translateFrom } from '@openmrs/esm-framework/src/internal';
import styles from './inpatient.scss';
import { moduleName } from '../constant';

type InpatientTabsProps = {
  patientUuid: string;
};
const INPATIENT_TABS_EXTENSION_SLOT = 'inpatient-dashboard-tabs-slot';
const InpatientTabs: FC<InpatientTabsProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { patient, isLoading, error } = usePatient(patientUuid);
  const state = useMemo(() => ({ patientUuid, patient }), [patientUuid, patient]);
  const assignedExtensions = useAssignedExtensions(INPATIENT_TABS_EXTENSION_SLOT);
  const extensions = useRenderableExtensions(INPATIENT_TABS_EXTENSION_SLOT);

  const sortedExtensions = useMemo<Array<AssignedExtension>>(() => {
    return [...assignedExtensions].sort(
      (a: AssignedExtension & { order?: number }, b: AssignedExtension & { order?: number }) =>
        (a.order ?? Infinity) - (b.order ?? Infinity),
    );
  }, [assignedExtensions]);
  if (isLoading) {
    return <TabsSkeleton />;
  }

  if (error) {
    return <ErrorState headerTitle={t('inPatient', 'In-Patient')} error={error} />;
  }
  return (
    <Layer>
      <Tabs>
        <TabList contained>
          {sortedExtensions.map((ext) => (
            <Tab key={ext.name}>{translateFrom(ext.moduleName, ext.meta.title, ext.meta.title)}</Tab>
          ))}
        </TabList>
        <TabPanels
          data-extension-slot-name={INPATIENT_TABS_EXTENSION_SLOT}
          data-extension-slot-module-name={moduleName}>
          {sortedExtensions.map((ext) => (
            <TabPanel key={ext.name}>
              <ComponentContext.Provider
                key={ext.id}
                value={{
                  featureName: ext.meta.featureName,
                  moduleName: ext.moduleName,
                  extension: {
                    extensionId: ext.id,
                    extensionSlotName: INPATIENT_TABS_EXTENSION_SLOT,
                    extensionSlotModuleName: ext.moduleName,
                  },
                }}>
                <Extension state={state} />
              </ComponentContext.Provider>
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </Layer>
  );
};

export default InpatientTabs;
