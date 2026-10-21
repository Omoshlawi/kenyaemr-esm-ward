import { Layer, Tab, TabList, TabPanel, TabPanels, Tabs, TabsSkeleton } from '@carbon/react';
import {
  type AssignedExtension,
  ErrorState,
  Extension,
  useAssignedExtensions,
  useConfig,
  usePatient,
} from '@openmrs/esm-framework';
import React, { type FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ComponentContext, translateFrom } from '@openmrs/esm-framework/src/internal';
import { moduleName } from '../constant';
import useCurrentPatientAdmissionEncounter from '../hooks/useCurrentPatientAdmissionEncounter';
import { useAdmissionLocationTags, useAdmissionRequest } from './in-patient.resource';
import type { WardConfigObject } from '../config-schema';
import dayjs from 'dayjs';

type InpatientTabsProps = {
  patientUuid: string;
};
const INPATIENT_TABS_EXTENSION_SLOT = 'inpatient-dashboard-tabs-slot';


const InpatientTabs: FC<InpatientTabsProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { admissionRequest } = useAdmissionRequest(patientUuid);
  const { patient, isLoading, error } = usePatient(patientUuid);
  const { inpatientLocationTags, bypassPartographAdmissionChecks } = useConfig<WardConfigObject>();
  const {
    admissionEncounter,
    isLoading: isLoadingAdmission,
    isPatientAdmitted,
  } = useCurrentPatientAdmissionEncounter(patientUuid);
  const { tags, isLoading: isLoadingTags } = useAdmissionLocationTags(admissionEncounter?.location?.uuid);
  const state = useMemo(
    () => ({
      patientUuid,
      patient: {
        ...patient,
        admitted: admissionRequest?.length === 0 && !!isPatientAdmitted,
        age: dayjs(patient.birthDate).isValid() ? dayjs().diff(patient.birthDate, 'years') : 0,
      },
      bypassPartographAdmissionChecks,
      admissionLocationTags: tags.map((tag) => tag.uuid),
      inpatientLocationTags,
    }),
    [
      patientUuid,
      patient,
      admissionRequest?.length,
      isPatientAdmitted,
      bypassPartographAdmissionChecks,
      tags,
      inpatientLocationTags,
    ],
  );
  const assignedExtensions = useAssignedExtensions(INPATIENT_TABS_EXTENSION_SLOT, state);

  const sortedExtensions = useMemo<Array<AssignedExtension>>(() => {
    return [...assignedExtensions].sort(
      (a: AssignedExtension & { order?: number }, b: AssignedExtension & { order?: number }) =>
        (a.order ?? Infinity) - (b.order ?? Infinity),
    );
  }, [assignedExtensions]);


  if (isLoading || isLoadingAdmission || isLoadingTags) {
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
                    extensionMeta: ext.meta,
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
