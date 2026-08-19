import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineLoading, InlineNotification } from '@carbon/react';
import {
  ExtensionSlot,
  usePatient,
  useVisit,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';

export type MaternityInpatientFormWorkspaceProps = {
  formUuid: string;
  encounterUuid?: string;
  patientUuid: string;
  mutateForm?: () => void;
};

const MaternityInpatientFormWorkspace: React.FC<Workspace2DefinitionProps<MaternityInpatientFormWorkspaceProps>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { formUuid, encounterUuid = '', patientUuid, mutateForm } = workspaceProps ?? {};
  const { patient, isLoading: isLoadingPatient, error: patientError } = usePatient(patientUuid);
  const { activeVisit } = useVisit(patientUuid);

  const state = useMemo(
    () => ({
      view: 'form',
      formUuid,
      visitUuid: activeVisit?.uuid ?? null,
      visitTypeUuid: activeVisit?.visitType?.uuid ?? null,
      patientUuid: patientUuid ?? null,
      patient,
      encounterUuid,
      closeWorkspaceWithSavedChanges: () => {
        mutateForm?.();
        return closeWorkspace({ discardUnsavedChanges: true });
      },
      closeWorkspace,
      promptBeforeClosing: (isDirty: () => boolean) => setHasUnsavedChanges(isDirty()),
      setHasUnsavedChanges,
      additionalProps: {
        mode: encounterUuid ? 'edit' : 'enter',
      },
    }),
    [formUuid, activeVisit, patientUuid, patient, encounterUuid, closeWorkspace, mutateForm],
  );

  if (isLoadingPatient) {
    return <InlineLoading description={t('loading', 'Loading')} iconDescription={t('loading', 'Loading data...')} />;
  }

  if (patientError) {
    return (
      <InlineNotification
        kind="error"
        subtitle={t('errorLoadingPatientWorkspace', 'Error loading patient workspace {{errorMessage}}', {
          errorMessage: patientError?.message,
        })}
        title={t('error', 'Error')}
      />
    );
  }

  return (
    <Workspace2 title={t('maternityInpatientForm', 'Maternity Inpatient Form')} hasUnsavedChanges={hasUnsavedChanges}>
      {patient && <ExtensionSlot name="form-widget-slot" state={state} />}
    </Workspace2>
  );
};

export default MaternityInpatientFormWorkspace;
