import { ComboButton, MenuItem } from '@carbon/react';
import { evaluateAsBoolean, launchWorkspace, launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { type FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../config-schema';
import useCurrentPatientAdmissionEncounter from '../hooks/useCurrentPatientAdmissionEncounter';
import { useAdmissionLocationTags } from './in-patient.resource';
import { usePatientChartStore } from '@openmrs/esm-patient-common-lib/src';
import styles from './inpatient.scss';

type InpatientFormsProps = {
  patientUuid: string;
  patient: fhir.Patient;
};

const InpatientForms: FC<InpatientFormsProps> = ({ patientUuid, patient }) => {
  const { t } = useTranslation();
  const { visitContext, mutateVisitContext } = usePatientChartStore(patientUuid);
  const { admissionEncounter, isLoading, error, currentVisit, isPatientAdmitted } =
    useCurrentPatientAdmissionEncounter(patientUuid);
  const {
    error: tagsError,
    isLoading: isloadingTags,
    tags,
  } = useAdmissionLocationTags(admissionEncounter?.location?.uuid);

  const { inPatientForms } = useConfig<WardConfigObject>();
  const filteredForms = useMemo(
    () =>
      inPatientForms.filter((form) => {
        const age = dayjs().diff(dayjs(patient.birthDate), 'year');
        const ageInDays = dayjs().diff(dayjs(patient.birthDate), 'day');
        const ageInMonths = dayjs().diff(dayjs(patient.birthDate), 'month');
        const gender = patient.gender;

        const shouldHideBasedOnExpression = form.hideExpression
          ? evaluateAsBoolean(form.hideExpression, { age, gender, ageInDays, ageInMonths })
          : false;

        const shouldHideBasedOnTags = form.tags?.length
          ? !form.tags.some((tag) => tags.some((t) => t.uuid === tag.uuid))
          : false;

        return !shouldHideBasedOnExpression && !shouldHideBasedOnTags;
      }),
    [inPatientForms, patient.birthDate, patient.gender, tags],
  );

  const handleLaunchForm = (form: { label: string; uuid: string }) => {
    launchWorkspace2(
      'patient-form-entry-workspace',
      {
        form: { uuid: form.uuid },
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

  if (!isPatientAdmitted) {
    return null;
  }

  if (isloadingTags || isLoading) return null;

  return (
    <ComboButton size="sm" label={t('inPatientForms', 'In-Patient Forms')} menuAlignment="bottom-end">
      <div className={styles.scrollableMenu}>
        {filteredForms.map((form) => (
          <MenuItem key={form.uuid} onClick={() => handleLaunchForm(form)} label={form.label} />
        ))}
      </div>
    </ComboButton>
  );
};

export default InpatientForms;
