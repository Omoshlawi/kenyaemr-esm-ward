import { InlineLoading, OverflowMenuItem } from '@carbon/react';
import {
  type Encounter,
  launchWorkspace2,
  openmrsFetch,
  type OpenmrsResource,
  restBaseUrl,
  showModal,
  useConfig,
  usePatient,
  type Visit,
} from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../config-schema';
import { type WardPatient } from '../types';

type DischargePatientActionProps = {
  wardPatient?: WardPatient;
};
const DischargePatientAction: React.FC<DischargePatientActionProps> = ({ wardPatient }) => {
  const { inpatientDischargeFormUuid } = useConfig<WardConfigObject>();
  const { clinicallyDeceadedIndicators } = useConfig<{
    clinicallyDeceadedIndicators: Array<{
      form: string;
      formUuid: string;
      questionConceptUuid: string;
      deceasedAnswerConceptUuid: string;
    }>;
  }>({ externalModuleName: '@kenyaemr/esm-morgue-app' });
  const { patient, patientUuid, isLoading } = usePatient(wardPatient?.patient?.uuid as string);
  const handleNortify = useCallback(
    async (encounter: Encounter) => {
      const indicator = clinicallyDeceadedIndicators.find(
        (indicator) => indicator.formUuid === inpatientDischargeFormUuid,
      );
      const encounters = await getVisitEncounters(wardPatient?.visit?.uuid as string);
      const obs = encounters.find((enc) => enc.form?.uuid === inpatientDischargeFormUuid)?.obs ?? [];
      const deceasedQuestion = obs?.find((obs) => obs?.concept?.uuid === indicator?.questionConceptUuid);
      const isDeceased = (deceasedQuestion?.value as OpenmrsResource)?.uuid === indicator?.deceasedAnswerConceptUuid;
      if (isDeceased) {
        const dispose = showModal('patient-clinically-marked-deceased-modal', {
          onClose: () => dispose(),
          patient,
          patientUuid,
        });
      }
    },
    [clinicallyDeceadedIndicators, inpatientDischargeFormUuid, patient, patientUuid, wardPatient?.visit?.uuid],
  );

  const { t } = useTranslation();
  if (isLoading) {
    return <InlineLoading />;
  }

  return (
    <OverflowMenuItem
      itemText={t('discharge', 'Discharge')}
      onClick={() => {
        launchWorkspace2('patient-discharge-workspace', {
          wardPatient: wardPatient,
          patientUuid: wardPatient?.patient.uuid,
          formUuid: inpatientDischargeFormUuid,
          dischargePatientOnSuccesfullSubmission: false,
          onPostResponse: handleNortify,
        });
      }}
    />
  );
};

export default DischargePatientAction;

export const getVisitEncounters = async (visitUuid: string) => {
  const rep = `custom:(encounters:(form:(uuid,display),obs:(uuid,display,value,concept:(uuid,display))))`;
  const url = `${restBaseUrl}/visit/${visitUuid}?v=${rep}`;
  const res = await openmrsFetch<Visit>(url);
  return res.data?.encounters ?? [];
};
