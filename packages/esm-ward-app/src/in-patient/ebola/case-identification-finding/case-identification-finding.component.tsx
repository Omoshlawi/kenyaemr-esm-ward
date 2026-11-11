import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../../../config-schema';
import FormEncountersTable from '../../form-encounters/form-encounters-table.component';

const CaseIdentificationFinding: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { cifFormUuid } = useConfig<WardConfigObject>();

  return (
    <FormEncountersTable
      patientUuid={patientUuid}
      forms={[{ uuid: cifFormUuid }]}
      headerTitle={t('caseIdentificationFinding', 'Case Identification Finding')}
      displayText={t('cif', 'CIF')}
    />
  );
};

export default CaseIdentificationFinding;
