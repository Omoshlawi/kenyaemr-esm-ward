import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../../config-schema';
import FormEncountersTable from '../form-encounters/form-encounters-table.component';

const AdmissionNotes: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { admissionNotesFormUuid } = useConfig<WardConfigObject>();
  const title = t('admissionNotes', 'Admission Notes');

  return (
    <FormEncountersTable
      patientUuid={patientUuid}
      forms={[{ uuid: admissionNotesFormUuid }]}
      headerTitle={title}
      displayText={title}
    />
  );
};

export default AdmissionNotes;
