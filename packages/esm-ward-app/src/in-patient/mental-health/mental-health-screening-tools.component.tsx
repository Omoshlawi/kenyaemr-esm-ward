import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../../config-schema';
import FormEncountersTable from '../form-encounters/form-encounters-table.component';

const MentalHealthScreeningTools: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { mentalHealthScreeningTools } = useConfig<WardConfigObject>();
  const title = t('mentalHealthScreeningTools', 'Mental Health Screening Tools');

  return (
    <FormEncountersTable
      patientUuid={patientUuid}
      forms={mentalHealthScreeningTools.map(({ formUuid, label }) => ({ uuid: formUuid, label }))}
      headerTitle={title}
      displayText={title}
    />
  );
};

export default MentalHealthScreeningTools;
