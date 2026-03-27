import { getPatientName, launchWorkspaceGroup } from '@openmrs/esm-framework';
import React, { type ReactNode } from 'react';
import { type WardPatient } from '../types';
import styles from './ward-patient-card.scss';

interface Props {
  children: ReactNode;
  wardPatient: WardPatient;
}

const WardPatientCard: React.FC<Props> = ({ children, wardPatient }) => {
  const { patient } = wardPatient;

  return (
    <div className={styles.wardPatientCard}>
      {children}
      <button
        className={styles.wardPatientCardButton}
        onClick={() => {
          launchWorkspaceGroup('ward-patient', {
            state: {
              wardPatient,
              patient,
              patientUuid: patient.uuid,
            },
            onWorkspaceGroupLaunch: () => {},
          });
        }}>
        {/* Name will not be displayed; just there for a11y */}
        {getPatientName(patient.person)}
      </button>
    </div>
  );
};

export default WardPatientCard;
