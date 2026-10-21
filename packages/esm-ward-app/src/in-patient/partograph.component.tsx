import { ExtensionSlot } from '@openmrs/esm-framework';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';

type PartographProps = {
  patientUuid: string;
  patient: fhir.Patient;
};
// t("partograph", "Partograph")
const Partograph: FC<PartographProps> = ({ patient, patientUuid }) => {
  const { t } = useTranslation();
  return <ExtensionSlot name="maternal-and-child-health-partograph-slot" state={{ patientUuid, patient }} />;
};

export default Partograph;
