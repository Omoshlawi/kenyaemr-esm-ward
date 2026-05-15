import { ErrorState, ExtensionSlot, type FHIRResource } from '@openmrs/esm-framework';
import React, { type FC } from 'react';
import { useShowPatography } from './in-patient.resource';
import { DataTableSkeleton, InlineNotification } from '@carbon/react';
import { useTranslation } from 'react-i18next';

type PartographProps = {
  patientUuid: string;
  patient: fhir.Patient;
};
// t("partograph", "Partograph")
const Partograph: FC<PartographProps> = ({ patient, patientUuid }) => {
  const { isLoading, showPartography } = useShowPatography(patient);
  const { t } = useTranslation();
  if (isLoading) return <DataTableSkeleton />;
  if (!showPartography)
    return (
      <InlineNotification
        kind="warning"
        title={t('partograph', 'Partograph')}
        subtitle={t('partographReason', 'Can only show partograph for female patients in Labour Ward')}
      />
    );
  return <ExtensionSlot name="maternal-and-child-health-partograph-slot" state={{ patientUuid, patient }} />;
};

export default Partograph;
