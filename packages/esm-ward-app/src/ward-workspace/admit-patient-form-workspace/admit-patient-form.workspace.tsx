import {
  Button,
  ButtonSet,
  Column,
  DatePicker,
  DatePickerInput,
  Dropdown,
  FileUploader,
  Form,
  FormGroup,
  InlineNotification,
  Row,
  Stack,
  TextInput,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAttachment,
  showSnackbar,
  useAppContext,
  useConfig,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../../config-schema';
import { useAssignedBedByPatient } from '../../hooks/useAssignedBedByPatient';
import useWardLocation from '../../hooks/useWardLocation';
import type { WardPatientWorkspaceProps, WardViewContext } from '../../types';
import { assignPatientToBed, useAdmitPatient } from '../../ward.resource';
import BedSelector from '../bed-selector.component';
import WardPatientWorkspaceBanner from '../patient-banner/patient-banner.component';
import FacilityBedCapacityNotification from './facility-bed-capacity-notification.component';
import styles from './admit-patient-form.scss';
import {
  type InapatientAdmissionFormData,
  inpatientAdmissionSchema,
  usePsychiatricWardCategories,
} from './patient-admission.resources';

/**
 * This form gets rendered when the user clicks "admit patient" in
 * the patient card in the admission requests workspace, but only when
 * the bed management module is installed. A bed must be selected so the
 * patient appears under Admitted (not Unassigned).
 */
const AdmitPatientFormWorkspace: React.FC<Workspace2DefinitionProps<WardPatientWorkspaceProps>> = ({
  workspaceProps: { wardPatient },
  closeWorkspace,
}) => {
  const { patient, inpatientRequest, visit } = wardPatient ?? {};
  const dispositionType = inpatientRequest?.dispositionType ?? 'ADMIT';
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const config = useConfig<WardConfigObject>();
  const { t } = useTranslation();
  const { location } = useWardLocation();
  const {
    isPsychiatricWard,
    isLoading: isLoadingPsychiatricWard,
    psychiatricCategoryOptions,
  } = usePsychiatricWardCategories(location?.uuid);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { admitPatient, isLoadingEmrConfiguration, errorFetchingEmrConfiguration } = useAdmitPatient();
  const [showErrorNotifications, setShowErrorNotifications] = useState(false);
  const { wardPatientGroupDetails } = useAppContext<WardViewContext>('ward-view-context') ?? {};
  const { isLoading } = wardPatientGroupDetails?.admissionLocationResponse ?? {};

  const { isLoading: isLoadingBedsAssignedToPatient } = useAssignedBedByPatient(patient.uuid);
  const beds = isLoading ? [] : (wardPatientGroupDetails?.bedLayouts ?? []);
  const hasBedsConfigured = !isLoading && beds.length > 0;
  /**
   * This workspace only opens when bed management is installed. A real bed is required so the
   * patient appears under Admitted (with bed), not Unassigned (admitted without a bed).
   */
  const admissionSchema = useMemo(() => inpatientAdmissionSchema(isPsychiatricWard, t, true), [isPsychiatricWard, t]);

  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    watch,
  } = useForm<InapatientAdmissionFormData>({
    defaultValues: { admissionDate: new Date() },
    resolver: zodResolver(admissionSchema),
  });
  const [bedIdObservable] = watch(['bedId']);
  const selectedBed = beds.find((bed) => bed.bedId === bedIdObservable && bed.bedId > 0);

  useEffect(() => {
    setHasUnsavedChanges(() => isDirty);
  }, [isDirty]);

  const onSubmit = (values: InapatientAdmissionFormData) => {
    setShowErrorNotifications(false);
    const bedSelected = beds.find((bed) => bed.bedId === values.bedId && bed.bedId > 0);
    if (!bedSelected) {
      setShowErrorNotifications(true);
      return;
    }
    setIsSubmitting(true);
    let shouldReload = false;

    admitPatient(
      patient,
      dispositionType,
      visit.uuid,
      values.psychiatricCategory
        ? [{ concept: config.psychiatricCategories.question, value: values.psychiatricCategory }]
        : [],
      values.admissionDate,
      config.admissionFormUuid,
    )
      .then(
        async (response) => {
          if (response.ok) {
            if (values.attachedFile) {
              try {
                await createAttachment(
                  patient.uuid,
                  {
                    file: values.attachedFile,
                    fileName: values.attachedFile.name,
                    fileType: values.attachedFile.type,
                    fileDescription: 'Admission attachment',
                    base64Content: '',
                  },
                  // response.data.uuid,
                );
              } catch {
                // The patient is already admitted, so a failed upload must not stop the bed assignment.
                showSnackbar({
                  kind: 'warning',
                  title: t('attachmentNotUploaded', 'Attachment not uploaded'),
                  subtitle: t(
                    'patientAdmittedButAttachmentNotUploaded',
                    'Patient admitted successfully but failed to upload the attachment',
                  ),
                });
              }
            }
            const bedResponse = await assignPatientToBed(bedSelected.bedId, patient.uuid, response.data.uuid);
            if (!bedResponse?.ok) {
              throw new Error('Bed assignment did not succeed');
            }
            shouldReload = true;
            return bedResponse;
          }
        },
        (err: any) => {
          if (err?.responseBody?.error?.fieldErrors?.encounterDatetime?.length) {
            showSnackbar({
              kind: 'error',
              title: t('errorCreatingEncounter', 'Failed to admit patient'),
              subtitle: err?.responseBody?.error?.fieldErrors?.encounterDatetime
                ?.map((e: any) => e.message)
                ?.join(', '),
            });
          } else
            showSnackbar({
              kind: 'error',
              title: t('errorCreatingEncounter', 'Failed to admit patient'),
              subtitle: err.message,
            });
        },
      )
      .then(
        (response) => {
          if (response && response?.ok) {
            showSnackbar({
              kind: 'success',
              title: t('patientAdmittedSuccessfully', 'Patient admitted successfully'),
              subtitle: t(
                'patientAdmittedSuccessfullySubtitle',
                '{{patientName}} has been successfully admitted and assigned to bed {{bedNumber}}',
                {
                  patientName: patient.person.preferredName.display,
                  bedNumber: bedSelected.bedNumber,
                },
              ),
            });
          }
        },
        () => {
          showSnackbar({
            kind: 'warning',
            title: t('patientAdmittedSuccessfully', 'Patient admitted successfully'),
            subtitle: t(
              'patientAdmittedButBedNotAssigned',
              'Patient admitted successfully but fail to assign bed to patient',
            ),
          });
        },
      )
      .finally(() => {
        setIsSubmitting(false);
        wardPatientGroupDetails?.mutate?.();
        closeWorkspace({ discardUnsavedChanges: true });
        if (shouldReload) {
          // Hard refresh so the patient shows under Admitted (with bed) immediately.
          window.location.reload();
        }
      });
  };

  const onError = useCallback((values) => {
    setShowErrorNotifications(true);
    setIsSubmitting(false);
  }, []);
  if (!wardPatientGroupDetails) return <></>;

  return (
    <Workspace2 title={t('admitPatientForm', 'Admit Patient Form')} hasUnsavedChanges={hasUnsavedChanges}>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit, onError)}>
        <Stack gap={4} className={styles.grid}>
          <WardPatientWorkspaceBanner {...{ wardPatient }} />
          <Column>
            <FacilityBedCapacityNotification />
          </Column>
          <Column>
            <Controller
              control={control}
              name="admissionDate"
              render={({ field: { onChange, value }, fieldState: { error } }) => {
                return (
                  <DatePicker
                    value={value}
                    datePickerType="single"
                    onChange={([date]) => {
                      onChange(date);
                    }}
                    className={styles.datePickerInput}>
                    <DatePickerInput
                      id="admission-date"
                      labelText={t('admissionDate', 'Admission Date')}
                      placeholder="mm/dd/yyyy"
                      invalid={!!error?.message}
                      invalidText={error?.message}
                    />
                  </DatePicker>
                );
              }}
            />
          </Column>
          <Column>
            <Controller
              control={control}
              name="bedId"
              render={({ field: { onChange, value }, fieldState: { error } }) => {
                return (
                  <BedSelector
                    beds={beds}
                    isLoadingBeds={isLoading}
                    currentPatient={patient}
                    selectedBedId={value}
                    error={error}
                    onChange={onChange}
                    allowNoBed={false}
                  />
                );
              }}
            />
          </Column>
          <Column>
            <TextInput
              id="bed-type"
              value={selectedBed?.bedType?.displayName ?? ''}
              readOnly
              labelText={t('bedType', 'Bed type')}
              placeholder={t('notConfigured', 'Bed type not configured')}
            />
          </Column>
          {isPsychiatricWard && (
            <>
              <Column>
                <Controller
                  control={control}
                  name="psychiatricCategory"
                  render={({ field, fieldState }) => (
                    <Dropdown<{ label: string; value: string }>
                      aria-label={t('category', 'Category')}
                      direction="bottom"
                      id="admission-psychiatric-category"
                      invalid={!!fieldState?.error}
                      invalidText={fieldState?.error?.message}
                      itemToString={(item) => item?.label ?? ''}
                      items={psychiatricCategoryOptions}
                      label={t('chooseCategory', 'Choose category')}
                      onChange={({ selectedItem }) => {
                        field.onChange(selectedItem?.value);
                      }}
                      size="md"
                      titleText={t('psychiatricCategory', 'Psychiatric category')}
                      type="default"
                    />
                  )}
                />
              </Column>
              <Column>
                <Controller
                  control={control}
                  name="attachedFile"
                  render={({ field }) => (
                    <FormGroup legendText={t('attachment', 'Attachment')}>
                      <FileUploader
                        labelTitle=""
                        labelDescription={t('attachmentUpload', 'Upload an attachment (PDF only)')}
                        buttonLabel={t('addFile', 'Add file')}
                        buttonKind="tertiary"
                        size="md"
                        filenameStatus="edit"
                        accept={['application/pdf']}
                        multiple={false}
                        disabled={isSubmitting}
                        onAddFiles={(_, { addedFiles }) => field.onChange(addedFiles[0])}
                        onDelete={() => field.onChange(undefined)}
                      />
                    </FormGroup>
                  )}
                />
              </Column>
            </>
          )}

          <Column>
            <div className={styles.errorNotifications}>
              {showErrorNotifications &&
                Object.entries(errors).map(([key, value]) => {
                  return (
                    <Row key={key}>
                      <Column>
                        <InlineNotification kind="error" subtitle={(value as any).message} lowContrast />
                      </Column>
                    </Row>
                  );
                })}
            </div>
          </Column>
        </Stack>

        <ButtonSet className={styles.buttonSet}>
          <Button
            className={styles.button}
            size="xl"
            kind="secondary"
            onClick={() => closeWorkspace({ discardUnsavedChanges: true })}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button
            className={styles.button}
            type="submit"
            size="xl"
            disabled={
              isSubmitting ||
              isLoadingEmrConfiguration ||
              errorFetchingEmrConfiguration ||
              isLoading ||
              isLoadingBedsAssignedToPatient ||
              isLoadingPsychiatricWard ||
              !hasBedsConfigured ||
              !selectedBed
            }>
            {!isSubmitting ? t('admit', 'Admit') : t('admitting', 'Admitting...')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default AdmitPatientFormWorkspace;
