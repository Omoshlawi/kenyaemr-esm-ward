import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineLoading, InlineNotification } from '@carbon/react';
import {
  type Encounter,
  ExtensionSlot,
  useEmrConfiguration,
  usePatient,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { usePatientDischarge } from './patient-discharge.resource';
import { type WardPatient } from '../../types';

type PatientDischargeWorkspaceProps = {
  readonly patientUuid: string;
  readonly wardPatient: WardPatient;
  readonly formUuid: string;
  readonly dischargePatientOnSuccesfullSubmission?: boolean;
};

const PatientDischargeWorkspace: React.FC<Workspace2DefinitionProps<PatientDischargeWorkspaceProps>> = (props) => {
  const { t } = useTranslation();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const {
    workspaceProps: { patientUuid, wardPatient, formUuid, dischargePatientOnSuccesfullSubmission = true },
    closeWorkspace,
  } = props;
  const { visit: currentVisit } = wardPatient ?? {};
  const { patient, isLoading: isLoadingPatient, error: patientError } = usePatient(patientUuid);
  const { emrConfiguration, isLoadingEmrConfiguration, errorFetchingEmrConfiguration } = useEmrConfiguration();

  const { handleDischarge } = usePatientDischarge();

  const state = useMemo<Record<string, unknown>>(
    () => ({
      view: 'form',
      formUuid,
      visitUuid: currentVisit?.uuid ?? null,
      visitTypeUuid: currentVisit?.visitType?.uuid ?? null,
      patientUuid: patientUuid ?? null,
      patient,
      encounterUuid: '',
      closeWorkspaceWithSavedChanges: () => closeWorkspace({ discardUnsavedChanges: true }),
      closeWorkspace,
      promptBeforeClosing: (func) => setHasUnsavedChanges(func()),
      handlePostResponse: (encounter: Encounter) => {
        if (dischargePatientOnSuccesfullSubmission)
          handleDischarge(encounter, wardPatient, emrConfiguration as Record<string, unknown>, currentVisit);
      },
    }),
    [
      patientUuid,
      currentVisit,
      patient,
      closeWorkspace,
      setHasUnsavedChanges,
      emrConfiguration,
      handleDischarge,
      dischargePatientOnSuccesfullSubmission,
      formUuid,
      wardPatient,
    ],
  );

  const isLoading = isLoadingPatient || isLoadingEmrConfiguration;
  const error = patientError || errorFetchingEmrConfiguration;

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Loading')} iconDescription={t('loading', 'Loading data...')} />;
  }

  if (error) {
    return (
      <InlineNotification
        aria-label={t('error', 'Error')}
        kind="error"
        onClose={() => {}}
        onCloseButtonClick={() => {}}
        statusIconDescription="notification"
        subtitle={t('errorLoadingPatientWorkspace', 'Error loading patient workspace {{errorMessage}}', {
          errorMessage: error?.message,
        })}
        title={t('error', 'Error')}
      />
    );
  }

  return (
    <Workspace2 title={t('discharge', 'Discharge')} hasUnsavedChanges={hasUnsavedChanges}>
      <div>
        {/* <pre>{JSON.stringify(currentVisit, null, 2)}</pre> */}
        {patient && <ExtensionSlot name="form-widget-slot" state={state} />}
      </div>
    </Workspace2>
  );
};

export default PatientDischargeWorkspace;
