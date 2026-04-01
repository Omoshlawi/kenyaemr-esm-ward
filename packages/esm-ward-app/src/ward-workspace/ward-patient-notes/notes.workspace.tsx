import React, { useState } from 'react';
import { type WardPatientWorkspaceProps } from '../../types';
import WardPatientWorkspaceBanner from '../patient-banner/patient-banner.component';
import PatientNotesForm from './form/notes-form.component';
import PatientNotesHistory from './history/notes-container.component';
import { Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';

const WardPatientNotesWorkspace: React.FC<Workspace2DefinitionProps<WardPatientWorkspaceProps>> = (props) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const {
    workspaceProps: { wardPatient },
    closeWorkspace,
  } = props;
  const patientUuid = wardPatient?.patient?.uuid;

  return (
    <Workspace2 title="Notes" hasUnsavedChanges={hasUnsavedChanges}>
      <div>
        <WardPatientWorkspaceBanner {...{ wardPatient }} />
        <PatientNotesForm
          patientUuid={patientUuid}
          closeWorkspace={closeWorkspace}
          setHasUnsavedChanges={setHasUnsavedChanges}
        />
        <PatientNotesHistory patientUuid={patientUuid} visitUuid={wardPatient?.visit?.uuid} />
      </div>
    </Workspace2>
  );
};

export default WardPatientNotesWorkspace;
