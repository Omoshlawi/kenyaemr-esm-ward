import { InlineLoading, InlineNotification } from '@carbon/react';
import { usePatient, useSession } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { usePostProcedureEncounter, DATE_FORMAT } from './post-procedure-printout.resource';
import styles from './post-procedure-printout.scss';

type PostProcedureSummaryProps = {
  visitUuid: string;
  patient: {
    uuid: string;
    openmrsId: string;
    name: string;
  };
};

const Field: FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className={styles.field}>
    <span className={styles.fieldLabel}>{label}</span>
    <span className={styles.fieldValue}>{value ?? '--'}</span>
  </div>
);

const PostProcedureSummary: FC<PostProcedureSummaryProps> = ({ visitUuid, patient: _patient }) => {
  const { t } = useTranslation();
  const session = useSession();
  const { isLoading: isLoadingPatient, patient, error: patientError } = usePatient(_patient.uuid);
  const {
    isLoading,
    error,
    encounter,
    providerName,
    surgeryDateTime,
    operativeProcedure,
    anaesthesiaType,
    patientPosition,
    incisionLocation,
    incisionType,
    closureMethod,
    findings,
    histologySpecimen,
    specimenType,
    procedureNotes,
  } = usePostProcedureEncounter(visitUuid);

  if (isLoading || isLoadingPatient) return <InlineLoading />;
  if (error || patientError) return <InlineNotification kind="error" title={error?.message ?? patientError?.message} />;
  if (!encounter)
    return (
      <InlineNotification
        kind="warning"
        title={t('noPostProcedureEncounter', 'No post procedure encounter found for this visit')}
      />
    );

  const age = patient ? `${Math.abs(dayjs(patient.birthDate).diff(dayjs(), 'years'))} ${t('years', 'Years')}` : '--';

  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <h5>{session.sessionLocation?.display}</h5>
        <h5>{t('postProcedureSummary', 'Post Procedure Summary')}</h5>
      </div>

      <div className={styles.cols3}>
        <Field label={t('name', 'Name')} value={_patient.name} />
        <Field label={t('ipNo', 'IP No')} value={_patient.openmrsId} />
        <Field label={t('age', 'Age')} value={age} />
      </div>
      <div className={styles.cols3}>
        <Field label={t('sex', 'Sex')} value={patient?.gender} />
        <Field
          label={t('encounterDate', 'Encounter Date')}
          value={encounter.encounterDatetime ? dayjs(encounter.encounterDatetime).format(DATE_FORMAT) : '--'}
        />
        <Field label={t('surgeon', 'Surgeon')} value={providerName} />
      </div>
      <div className={styles.cols2}>
        <Field
          label={t('surgeryDateTime', 'Date & Time of Surgery')}
          value={surgeryDateTime ? dayjs(surgeryDateTime).format(DATE_FORMAT) : '--'}
        />
        <Field label={t('operativeProcedure', 'Operative Procedure')} value={operativeProcedure} />
      </div>

      <div>
        <strong className={styles.txtUpper}>{t('procedureDetails', 'Procedure Details')}</strong>
        <div className={styles.cols2}>
          <Field label={t('anaesthesiaType', 'Anaesthesia Type')} value={anaesthesiaType} />
          <Field label={t('patientPosition', 'Patient Position')} value={patientPosition} />
        </div>
        <div className={styles.cols2}>
          <Field label={t('incisionLocation', 'Location of Incision')} value={incisionLocation} />
          <Field label={t('incisionType', 'Type of Incision')} value={incisionType} />
        </div>
        <div className={styles.cols1}>
          <Field label={t('closureMethod', 'Closure Method')} value={closureMethod} />
        </div>
      </div>

      <div>
        <strong className={styles.txtUpper}>{t('findings', 'Findings')}</strong>
        <p className={styles.txtTitle}>{findings ?? t('noFindings', 'No findings recorded')}</p>
      </div>

      <div>
        <strong className={styles.txtUpper}>{t('histology', 'Histology')}</strong>
        <div className={styles.cols2}>
          <Field label={t('specimenCollected', 'Specimen for Histology Collected')} value={histologySpecimen} />
          {histologySpecimen === 'Yes' && <Field label={t('specimenType', 'Type of Specimen')} value={specimenType} />}
        </div>
      </div>

      <div>
        <strong className={styles.txtUpper}>{t('procedureNotes', 'Procedure Notes')}</strong>
        <p className={styles.notesText}>{procedureNotes ?? t('noNotes', 'No procedure notes recorded')}</p>
      </div>

      <div className={styles.cols2}>
        <Field label={t('surgeon', 'Surgeon')} value={providerName} />
        <div className={styles.signatureField}>
          <span className={styles.fieldLabel}>{t('signature', 'Signature')}</span>
          <span className={styles.sigLine} />
        </div>
      </div>
      <div className={styles.cols2}>
        <Field label={t('location', 'Location')} value={session.sessionLocation?.display} />
        <Field label={t('date', 'Date')} value={dayjs().format(DATE_FORMAT)} />
      </div>
    </div>
  );
};

export default PostProcedureSummary;
