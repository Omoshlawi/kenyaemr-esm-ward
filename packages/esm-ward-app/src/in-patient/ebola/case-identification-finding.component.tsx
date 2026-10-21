import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { EmptyState, usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../../config-schema';

const CaseIdentificationFinding: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { visitContext, mutateVisitContext, patient } = usePatientChartStore(patientUuid);
  const { cifFormUuid } = useConfig<WardConfigObject>();
  const handleLaunchForm = () => {
    launchWorkspace2(
      'patient-form-entry-workspace',
      {
        form: { uuid: cifFormUuid },
        encounterUuid: '',
      },
      {},
      {
        patient,
        patientUuid,
        visitContext,
        mutateVisitContext,
      },
    );
  };

  const { t } = useTranslation();
  return (
    <EmptyState
      headerTitle={t('caseIdentificationFinding', 'Case Identification Finding')}
      displayText={t('cif', 'CIF')}
      launchForm={handleLaunchForm}
    />
  );
};

export default CaseIdentificationFinding;
