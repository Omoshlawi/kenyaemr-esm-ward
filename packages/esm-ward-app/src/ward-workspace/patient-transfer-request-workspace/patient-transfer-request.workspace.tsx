import React from 'react';
import { type WardPatientWorkspaceProps } from '../../types';
import WardPatientWorkspaceBanner from '../patient-banner/patient-banner.component';
import PatientAdmitOrTransferForm from '../patient-transfer-bed-swap/patient-admit-or-transfer-request-form.component';
import styles from './patient-transfer-request.scss';
import { Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

interface PatientTransferRequestWorkspaceProps extends WardPatientWorkspaceProps {}

/**
 * This workspace is launched when the "Transfer elsewhere" / "Admit elsewhere"
 * button on a pending request patient card is clicked on
 */
const PatientTransferRequestWorkspace: React.FC<Workspace2DefinitionProps<PatientTransferRequestWorkspaceProps>> = (
  props,
) => {
  const { t } = useTranslation();
  const { workspaceProps, closeWorkspace } = props;
  const { wardPatient } = workspaceProps;

  return (
    <Workspace2 title={t('transferRequest', 'Transfer request')}>
      <div className={styles.patientTransferRequestWorkspace}>
        <WardPatientWorkspaceBanner {...{ wardPatient }} />
        <PatientAdmitOrTransferForm {...props} />
      </div>
    </Workspace2>
  );
};

export default PatientTransferRequestWorkspace;
