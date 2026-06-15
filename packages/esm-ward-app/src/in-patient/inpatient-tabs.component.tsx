import { Layer, Tab, TabList, TabPanel, TabPanels, Tabs, TabsSkeleton } from '@carbon/react';
import {
  type AssignedExtension,
  ErrorState,
  Extension,
  ExtensionSlot,
  type FHIRResource,
  useAssignedExtensions,
  useConfig,
  usePatient,
  useRenderableExtensions,
} from '@openmrs/esm-framework';
import React, { type FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ComponentContext, translateFrom } from '@openmrs/esm-framework/src/internal';
import styles from './inpatient.scss';
import { moduleName } from '../constant';
import useCurrentPatientAdmissionEncounter from '../hooks/useCurrentPatientAdmissionEncounter';
import { useAdmissionLocationTags } from './in-patient.resource';
import type { WardConfigObject } from '../config-schema';

type InpatientTabsProps = {
  patientUuid: string;
};
const INPATIENT_TABS_EXTENSION_SLOT = 'inpatient-dashboard-tabs-slot';
const LABOUR_CARE_GUIDE_EXTENSION_NAME = 'maternal-and-child-health-labour-care-guide';

const getPatientGenderValue = (patient: any): string => {
  const gender = patient?.gender;
  if (typeof gender === 'string') {
    return gender;
  }

  if (gender && typeof gender === 'object') {
    return String(gender.display ?? gender.name ?? gender.value ?? '');
  }

  return '';
};

const isFemalePatient = (patient: any): boolean => {
  const gender = getPatientGenderValue(patient).trim().toLowerCase();
  return gender === 'f' || gender === 'female' || gender.startsWith('female ');
};

const getPatientAge = (patient: any): number => {
  const ageFromPatient = Number(patient?.age);
  if (Number.isFinite(ageFromPatient)) {
    return ageFromPatient;
  }

  const birthDate = patient?.birthDate;
  if (!birthDate) {
    return NaN;
  }

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return NaN;
  }

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasNotHadBirthdayYet =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (hasNotHadBirthdayYet) {
    age -= 1;
  }

  return age;
};

const InpatientTabs: FC<InpatientTabsProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { patient, isLoading, error } = usePatient(patientUuid);
  const { inpatientLocationTags } = useConfig<WardConfigObject>();
  const {
    admissionEncounter,
    isLoading: isLoadingAdmission,
    isPatientAdmitted,
  } = useCurrentPatientAdmissionEncounter(patientUuid);
  const { tags, isLoading: isLoadingTags } = useAdmissionLocationTags(admissionEncounter?.location?.uuid);
  const state = useMemo(() => ({ patientUuid, patient }), [patientUuid, patient]);
  const assignedExtensions = useAssignedExtensions(INPATIENT_TABS_EXTENSION_SLOT);
  const extensions = useRenderableExtensions(INPATIENT_TABS_EXTENSION_SLOT);

  const sortedExtensions = useMemo<Array<AssignedExtension>>(() => {
    return [...assignedExtensions].sort(
      (a: AssignedExtension & { order?: number }, b: AssignedExtension & { order?: number }) =>
        (a.order ?? Infinity) - (b.order ?? Infinity),
    );
  }, [assignedExtensions]);

  const isAdmittedToAllowedWard = useMemo(() => {
    const allowedWardTags = [
      inpatientLocationTags?.labourWard,
      inpatientLocationTags?.antenatalWard,
      inpatientLocationTags?.maternityWard,
    ].filter(Boolean);
    return allowedWardTags.some((tagUuid) => tags.some((tag) => tag.uuid === tagUuid));
  }, [inpatientLocationTags, tags]);

  const canShowLabourCareGuideTab = useMemo(() => {
    const age = getPatientAge(patient);
    return isFemalePatient(patient) && Number.isFinite(age) && age > 9 && isPatientAdmitted && isAdmittedToAllowedWard;
  }, [patient, isPatientAdmitted, isAdmittedToAllowedWard]);

  const visibleExtensions = useMemo(
    () =>
      sortedExtensions.filter(
        (extension) => extension.name !== LABOUR_CARE_GUIDE_EXTENSION_NAME || canShowLabourCareGuideTab,
      ),
    [sortedExtensions, canShowLabourCareGuideTab],
  );

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
          {visibleExtensions.map((ext) => (
            <Tab key={ext.name}>{translateFrom(ext.moduleName, ext.meta.title, ext.meta.title)}</Tab>
          ))}
        </TabList>
        <TabPanels
          data-extension-slot-name={INPATIENT_TABS_EXTENSION_SLOT}
          data-extension-slot-module-name={moduleName}>
          {visibleExtensions.map((ext) => (
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
