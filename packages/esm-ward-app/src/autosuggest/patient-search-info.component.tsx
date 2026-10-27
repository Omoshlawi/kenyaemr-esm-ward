import { Tag, Tile } from '@carbon/react';
import { type Patient, PatientPhoto, useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../config-schema';
import styles from './patient-search-info.scss';

type PatientSearchInfoProps = {
  patient: Patient;
};

const PatientSearchInfo: React.FC<PatientSearchInfoProps> = ({ patient }) => {
  const { t } = useTranslation();
  const { openmrsIDUuid } = useConfig<WardConfigObject>();
  const openmrsId = patient.identifiers.find(
    (identifier) => identifier.identifierType?.uuid === openmrsIDUuid || identifier.preferred,
  )?.identifier;

  return (
    <Tile className={styles.patientInfo}>
      <div className={styles.patientAvatar} role="img">
        <PatientPhoto patientUuid={patient.uuid} patientName={patient.person.display} />
      </div>
      <div className={styles.patientDetails}>
        <h2 className={styles.patientName}>{patient.person.display}</h2>
        <div className={styles.demographics}>
          {patient?.person?.gender} <span className={styles.middot}>&middot;</span> {patient?.person?.age}
          <span className={styles.middot}>&middot;</span>
          {openmrsId ? (
            <Tag>
              {t('openMrsId', 'ID')}: {openmrsId}
            </Tag>
          ) : null}
        </div>
      </div>
    </Tile>
  );
};

export default PatientSearchInfo;
