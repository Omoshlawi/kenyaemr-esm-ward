import { Button, InlineLoading, OverflowMenuItem } from '@carbon/react';
import {
  ArrowRightIcon,
  launchWorkspace,
  launchWorkspace2,
  showSnackbar,
  useAppContext,
  useConfig,
  useFeatureFlag,
  useLayoutType,
} from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useWardLocation from '../hooks/useWardLocation';
import type { DispositionType, WardPatient, WardViewContext } from '../types';
import { useAdmitPatient } from '../ward.resource';
import { type WardConfigObject } from '../config-schema';

interface AdmitPatientButtonProps {
  wardPatient: WardPatient;

  /**
   * whether to create an admit or transfer encounter for the given patient
   */
  dispositionType: DispositionType;
  onAdmitPatientSuccess();
  disabled?: boolean;
  component?: 'btn' | 'menu';
}

const AdmitPatientButton: React.FC<AdmitPatientButtonProps> = ({
  wardPatient,
  onAdmitPatientSuccess,
  disabled,
  dispositionType,
  component = 'btn',
}) => {
  const {
    inpatientLocationTags: { pediatricWard },
  } = useConfig<WardConfigObject>();
  const { patient, visit, bed } = wardPatient ?? {};
  const { t } = useTranslation();
  const { location } = useWardLocation();
  const responsiveSize = useLayoutType() === 'tablet' ? 'lg' : 'md';
  const { wardPatientGroupDetails } = useAppContext<WardViewContext>('ward-view-context') ?? {};
  const { admitPatient, isLoadingEmrConfiguration, errorFetchingEmrConfiguration } = useAdmitPatient();
  const { isPediatricWard, isLoading: isLoadingTags } = useMemo(() => {
    const { isLoading, admissionLocation } = wardPatientGroupDetails?.admissionLocationResponse ?? {};
    return {
      isPediatricWard: !isLoading && admissionLocation?.ward?.tags?.some((tag) => tag.uuid === pediatricWard),
      isLoading,
    };
  }, [pediatricWard, wardPatientGroupDetails?.admissionLocationResponse]);

  const launchPatientAdmissionForm = () => launchWorkspace2('admit-patient-form-workspace', { wardPatient });

  const isBedManagementModuleInstalled = useFeatureFlag('bedmanagement-module');

  // If bed management module is installed and the patient is not currently assigned a bed,
  // open the next form for bed selection. If not, admit patient directly
  // (Note that it is possible, albeit an edge case, for a patient to have a bed assigned while not admitted)
  const onAdmit = () => {
    if (isPediatricWard && patient?.person?.age > 12) {
      return showSnackbar({
        kind: 'error',
        title: t('admissionError', 'Admission error'),
        subtitle: t('pediatricError', 'Patients older than 12 years cannot be admitted to the pediatric ward'),
      });
    }
    if (isBedManagementModuleInstalled && !bed) {
      launchPatientAdmissionForm();
    } else {
      admitPatient(patient, dispositionType, visit.uuid)
        .then(
          (response) => {
            if (response && response?.ok) {
              showSnackbar({
                kind: 'success',
                title: t('patientAdmittedSuccessfully', 'Patient admitted successfully'),
                subtitle: t('patientAdmittedWoBed', 'Patient admitted successfully to {{location}}', {
                  location: location?.display,
                }),
              });
            }
          },
          (err: Error) => {
            showSnackbar({
              kind: 'error',
              title: t('errorCreatingEncounter', 'Failed to admit patient'),
              subtitle: err.message,
            });
          },
        )
        .finally(() => {
          wardPatientGroupDetails?.mutate?.();
          onAdmitPatientSuccess();
        });
    }
  };

  const disabledButton = isLoadingEmrConfiguration || errorFetchingEmrConfiguration || disabled;

  if (isLoadingTags) {
    return <InlineLoading />;
  }
  if (component === 'menu') return <OverflowMenuItem itemText={t('admitPatient', 'Admit patient')} onClick={onAdmit} />;

  return (
    <Button kind="ghost" renderIcon={ArrowRightIcon} size={responsiveSize} disabled={disabledButton} onClick={onAdmit}>
      {t('admitPatient', 'Admit patient')}
    </Button>
  );
};

export default AdmitPatientButton;
