import { InlineLoading, InlineNotification } from '@carbon/react';
import { useConfig, useEmrConfiguration, usePatient, useSession } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { type FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { WardConfigObject } from '../config-schema';
import { useVisitSummary } from '../hooks/use-patient-summary';
import { useEncounterDetails } from '../hooks/useIpdDischargeEncounter';
import { DATE_FORMART, usePatientDiagnosis, usePatientOrders } from './discharge-printout.resource';
import styles from './discharge-printouts.scss';
import FieldInput from './field-input';
import {
  ImagingSummary,
  InvestigationsSummary,
  MedicationSummary,
  ProceduresSummary,
} from './investigrations-and-procedures.components';

type DischargeSummaryProps = {
  dischargeEncounterUuid: string;
  patient: {
    uuid: string;
    openmrsId: string;
    name: string;
  };
};

const DischargeSummary: FC<DischargeSummaryProps> = ({ dischargeEncounterUuid, patient: _patient }) => {
  const { t } = useTranslation();
  const { crIdentifierTypeUuid, nationIdIdentifierTypeUuid, showCrIdentifierOnSummary } = useConfig<WardConfigObject>();
  const { encounter, error, isLoading } = useEncounterDetails(dischargeEncounterUuid);
  const { error: summaryError, isLoading: isLoadingSumary, summary } = useVisitSummary(encounter?.visit?.uuid ?? '');
  const { isLoading: isLoadingPatient, patient, error: patientError } = usePatient(_patient.uuid);
  const nationId = useMemo(() => {
    if (!patient?.identifier) return null;

    const identifier = patient.identifier.find((id) => id.type.coding?.[0]?.code === nationIdIdentifierTypeUuid);
    return identifier?.value ?? null;
  }, [patient, nationIdIdentifierTypeUuid]);
  const shifNo = useMemo(() => {
    if (!patient?.identifier) return null;

    const identifier = patient.identifier.find((id) => id.type.coding?.[0]?.code === crIdentifierTypeUuid);
    return identifier?.value ?? null;
  }, [patient, crIdentifierTypeUuid]);
  const {
    isLoading: isLoadingDiagnosis,
    error: diagnosisError,
    doctorsNoteDiagnosesDisplay,
    dischargeDiagnosesDisplay,
    consultationDiagnosesDisplay,
  } = usePatientDiagnosis(dischargeEncounterUuid);
  const session = useSession();
  const { emrConfiguration, isLoadingEmrConfiguration, errorFetchingEmrConfiguration } = useEmrConfiguration();
  const {
    isLoading: isLoadingOders,
    error: orderserror,
    complaints,
    drugReactions,
    dischargeinstructions,
    physicalExaminations,
  } = usePatientOrders(dischargeEncounterUuid);

  const admissionDate = useMemo(() => {
    const admisionEncounter = encounter?.visit?.encounters?.find(
      (e) => e.encounterType.uuid === emrConfiguration?.admissionEncounterType?.uuid,
    );
    if (!admisionEncounter || !admisionEncounter.encounterDatetime) return null;
    return admisionEncounter.encounterDatetime;
  }, [encounter, emrConfiguration]);

  const consultantName = useMemo(() => {
    const providers = encounter?.encounterProviders;
    if (!providers?.length) return null;
    const last = providers[providers.length - 1];
    const raw = last?.provider?.display ?? '';
    const parts = raw.split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ') : raw;
  }, [encounter]);

  if (
    isLoading ||
    isLoadingPatient ||
    isLoadingEmrConfiguration ||
    isLoadingDiagnosis ||
    isLoadingOders ||
    isLoadingSumary
  )
    return <InlineLoading />;

  if (error || patientError || errorFetchingEmrConfiguration || diagnosisError || orderserror || summaryError)
    return (
      <InlineNotification
        kind="error"
        title={
          error?.message ??
          patientError?.message ??
          errorFetchingEmrConfiguration?.message ??
          diagnosisError?.message ??
          orderserror?.message ??
          summaryError?.message ??
          t('errorLoadingDischargeSummary', 'Error loading discharge summary')
        }
      />
    );

  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <img
          src={
            'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bG9nb3xlbnwwfHwwfHx8MA%3D%3D'
          }
          alt="logo"
          className={styles.logo}
        />
        <div>
          <h5>{session?.sessionLocation?.display}</h5>
          <h2>{t('dischargeSummary', 'Discharge Summary')}</h2>
        </div>
      </div>
      <strong className={styles.txtUpper}>{t('patientInformation', 'Patient information')}</strong>
      <div className={styles.cols3}>
        <FieldInput name={t('patientsName', "Patient's name")} value={_patient.name} />
        <FieldInput name={t('ipNo', 'IP No')} value={_patient.openmrsId} />
        <FieldInput name={t('dateOfBirth', 'Date of Birth')} value={dayjs(patient.birthDate).format(DATE_FORMART)} />
      </div>
      <div className={showCrIdentifierOnSummary ? styles.cols4 : styles.cols3}>
        <FieldInput
          name={t('age', 'Age')}
          value={`${Math.abs(dayjs(patient.birthDate).diff(dayjs(), 'years'))} years`}
        />
        <FieldInput name={t('sex', 'Sex')} value={patient.gender} />
        <FieldInput name={t('nationId', 'Nation ID')} value={nationId} />
        {showCrIdentifierOnSummary && <FieldInput name={t('crNo', 'CR No')} value={shifNo} />}
      </div>
      <strong className={styles.txtUpper}>{t('admisionDetails', 'Admission details')}</strong>
      <div className={styles.cols2}>
        <FieldInput name={t('dateOfAdmissionAbrv', 'DOA')} value={dayjs(admissionDate).format(DATE_FORMART)} />
        <FieldInput
          name={t('dateOfDischargeAbrv', 'DOD')}
          value={dayjs(encounter?.encounterDatetime).format(DATE_FORMART)}
        />
      </div>
      <div className={styles.cols2}>
        <FieldInput
          name={t('admissionDiagnosis', 'Admission Diagnosis')}
          value={doctorsNoteDiagnosesDisplay ?? consultationDiagnosesDisplay}
        />
        <FieldInput name={t('bed', 'Bed')} value="" />
      </div>
      <div className={styles.cols2}>
        <FieldInput name={t('attendingDoctor', 'Attending Doctor')} value={consultantName ?? undefined} />
        <FieldInput name={t('ward', 'Ward')} value={encounter?.location?.display} />
      </div>

      <div>
        <strong className={styles.txtUpper}>{t('dischargeDiagnosis', 'Discharge Diagnosis')}</strong>
        <p className={styles.txtTitle}>{dischargeDiagnosesDisplay ?? t('noDiagnoses', 'No Diagnoses')}</p>
      </div>
      <div>
        <strong className={styles.txtUpper}>{t('medicalHistory', 'Medical History')}</strong>
        <p>
          {`${complaints ? 'Presented with ' + complaints + '.' : ''}${
            drugReactions
              ? t('knownDrugAllergies', 'Known drug allergies') + ': ' + drugReactions
              : t('noKnownDrugAllergies', 'No known drug allergies')
          }`}
        </p>
      </div>
      <div>
        <strong className={styles.txtUpper}>{t('physicalFindings', 'Physical Findings')}</strong>
        {physicalExaminations?.length ? (
          physicalExaminations?.map((examination, i) => (
            <p key={i} className={styles.txtTitle}>
              {examination}
            </p>
          ))
        ) : (
          <p>{t('noExaminations', 'No Examinations')}</p>
        )}
      </div>
      <div>
        <strong className={styles.txtUpper}>{t('investigations', 'Investigations')}</strong>
        <InvestigationsSummary labResults={summary?.labResults ?? []} />
        <ImagingSummary imaging={summary?.imaging ?? []} />
        <ProceduresSummary procedures={summary?.procedures ?? []} />
      </div>
      <MedicationSummary medications={summary?.medications ?? []} />

      <div>
        <strong className={styles.txtUpper}>{t('dischargeInstructions', 'Discharge Instructions')}</strong>
        <p>{dischargeinstructions ?? t('noInstructions', 'No instructions')}</p>
      </div>
      <div className={styles.cols3}>
        <FieldInput name={t('dischargingDoctor', 'Discharging Doctor')} value={consultantName} />
        <FieldInput name={t('signature', 'Signature')} />
        <FieldInput name={t('date', 'Date')} value={dayjs().format(DATE_FORMART)} />
      </div>
    </div>
  );
};

export default DischargeSummary;
