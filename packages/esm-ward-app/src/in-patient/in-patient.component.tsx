import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import React from 'react';
import AdmissionRequest from './admission-request.component';
import { useTranslation } from 'react-i18next';
import InpatientDetailView from './inpatient-detail-view.component';
import { useShowPatography } from './in-patient.resource';
import { ExtensionSlot } from '@openmrs/esm-framework';

type InPatientProps = {
  patientUuid: string;
  patient: fhir.Patient;
};

const InPatient: React.FC<InPatientProps> = ({ patientUuid, patient }) => {
  const { showPartography } = useShowPatography(patient);
  const { t } = useTranslation();
  return (
    <Tabs>
      <TabList contained>
        <Tab>{t('admissionRequests', 'Admission Requests')}</Tab>
        <Tab>{t('inpatientDetails', 'Inpatient Detail')}</Tab>
        {showPartography && <Tab>{t('partograph', 'Partograph')}</Tab>}
      </TabList>
      <TabPanels>
        <TabPanel>
          <AdmissionRequest patientUuid={patientUuid} />
        </TabPanel>
        <TabPanel>
          <InpatientDetailView patientUuid={patientUuid} />
        </TabPanel>
        {showPartography && (
          <TabPanel>
            <ExtensionSlot name="maternal-and-child-health-partograph-slot" state={{ patientUuid, patient }} />
          </TabPanel>
        )}
      </TabPanels>
    </Tabs>
  );
};

export default InPatient;
