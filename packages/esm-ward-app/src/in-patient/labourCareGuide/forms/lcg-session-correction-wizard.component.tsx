import React from 'react';
import { InlineNotification, Modal, Search, Stack, TextArea } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { getPatientName } from '@openmrs/esm-framework';
import styles from '../labour-care-guide.scss';
import {
  executeWrongPatientSessionTransfer,
  formatTerminationReasonLabel,
  useLcgEligibleCorrectionPatients,
  type LcgSessionTerminationState,
} from '../resources/lcg-session-correction.resource';
import { markLcgSessionTransferredAway, saveLcgCorrectionAuditForPatient } from '../storage/lcg-local-storage';

type LcgSessionCorrectionWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  sourcePatientUuid: string;
  sourcePatient: any;
  termination: LcgSessionTerminationState;
  admissionLocationUuid?: string;
  onTransferComplete?: (targetPatientUuid: string) => void;
};

const formatPatientGender = (gender?: string) => {
  if (!gender) {
    return null;
  }

  const normalized = gender.toLowerCase();
  if (normalized === 'f' || normalized.startsWith('female')) {
    return 'Female';
  }
  if (normalized === 'm' || normalized.startsWith('male')) {
    return 'Male';
  }

  return gender;
};

const LcgSessionCorrectionWizard: React.FC<LcgSessionCorrectionWizardProps> = ({
  isOpen,
  onClose,
  sourcePatientUuid,
  sourcePatient,
  termination,
  admissionLocationUuid,
  onTransferComplete,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedPatientUuid, setSelectedPatientUuid] = React.useState('');
  const [transferNotes, setTransferNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const { patients, isLoading } = useLcgEligibleCorrectionPatients(sourcePatientUuid, admissionLocationUuid, isOpen);

  React.useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedPatientUuid('');
      setTransferNotes('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const filteredPatients = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return patients;
    }

    return patients.filter(
      (patient) =>
        patient.displayName.toLowerCase().includes(normalizedSearch) ||
        patient.identifier.toLowerCase().includes(normalizedSearch),
    );
  }, [patients, searchTerm]);

  const handleTransfer = async () => {
    if (!selectedPatientUuid) {
      setErrorMessage(t('lcgCorrectionSelectPatient', 'Select the correct patient to continue'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const sourcePatientDisplay = sourcePatient ? getPatientName(sourcePatient) : sourcePatientUuid;
    const result = await executeWrongPatientSessionTransfer(
      sourcePatientUuid,
      selectedPatientUuid,
      termination,
      sourcePatientDisplay,
      t,
      transferNotes,
    );

    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    setSuccessMessage(
      t('lcgCorrectionTransferSuccessDetail', 'Transferred {{count}} encounters to the selected patient.', {
        count: result.transferredCount ?? 0,
      }),
    );

    markLcgSessionTransferredAway(sourcePatientUuid, selectedPatientUuid);
    saveLcgCorrectionAuditForPatient(selectedPatientUuid, {
      encounterUuid: '',
      encounterDatetime: termination.encounterDatetime,
      sourcePatientUuid,
      sourcePatientDisplay: sourcePatientDisplay,
      sourceTerminateEncounterUuid: termination.encounterUuid,
      terminationReason: formatTerminationReasonLabel(termination, t),
      terminatedAt: termination.encounterDatetime,
      transferNotes: transferNotes.trim() || undefined,
    });

    if (onTransferComplete) {
      onTransferComplete(selectedPatientUuid);
    }
  };

  const terminationSummary = formatTerminationReasonLabel(termination, t);
  const terminatedAtDisplay = new Date(termination.encounterDatetime).toLocaleString();

  return (
    <Modal
      open={isOpen}
      modalHeading={t('lcgCorrectionWizardTitle', 'Correct LCG session')}
      primaryButtonText={
        isSubmitting ? t('transferring', 'Transferring...') : t('transferSessionData', 'Transfer session data')
      }
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={isSubmitting || !selectedPatientUuid}
      onRequestClose={onClose}
      onRequestSubmit={handleTransfer}
      onSecondarySubmit={onClose}
      className={styles.correctionWizardModal}
      size="lg">
      <div className={styles.correctionWizardModalBody}>
        <Stack gap={5}>
          <InlineNotification
            kind="warning"
            hideCloseButton
            lowContrast
            title={t('lcgSessionTerminatedBanner', 'Session terminated')}
            subtitle={`${t('lcgTerminationReasonLabel', 'Reason')}: ${terminationSummary} • ${t('lcgTerminationTimeLabel', 'Time')}: ${terminatedAtDisplay}`}
          />

          {errorMessage ? (
            <InlineNotification kind="error" title={t('error', 'Error')} subtitle={errorMessage} hideCloseButton />
          ) : null}

          {successMessage ? (
            <InlineNotification
              kind="success"
              title={t('success', 'Success')}
              subtitle={successMessage}
              hideCloseButton
            />
          ) : null}

          <p className={styles.correctionWizardHelp}>
            {t(
              'lcgCorrectionWizardHelp',
              'Select the admitted patient who should receive this labour session. Clinical data will move to that chart and this chart will be cleared.',
            )}
          </p>

          <Search
            id="lcg-correction-patient-search"
            labelText={t('searchPatients', 'Search patients')}
            placeholder={t('searchByNameOrId', 'Search by name or OpenMRS ID')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            size="md"
          />

          {isLoading ? <p>{t('loading', 'Loading...')}</p> : null}

          {!isLoading && filteredPatients.length === 0 ? (
            <InlineNotification
              kind="info"
              hideCloseButton
              lowContrast
              title={t('lcgCorrectionNoPatients', 'No eligible admitted patients found')}
              subtitle={t(
                'lcgCorrectionNoPatientsDetail',
                'Only female patients older than 9 years admitted to this ward are listed.',
              )}
            />
          ) : !isLoading ? (
            <fieldset className={styles.correctionPatientFieldset}>
              <legend className={styles.correctionPatientLegend}>
                {t('selectCorrectPatient', 'Select correct patient')}
                <span className={styles.correctionPatientCount}>
                  {t('lcgCorrectionPatientCount', '{{count}} patients', { count: filteredPatients.length })}
                </span>
              </legend>
              <div className={styles.correctionPatientList}>
                {filteredPatients.map((patient) => {
                  const metaParts = [
                    patient.identifier ? `${t('openMrsId', 'ID')}: ${patient.identifier}` : null,
                    formatPatientGender(patient.gender),
                    patient.age !== undefined && patient.age !== null && patient.age !== ''
                      ? t('patientAgeYears', '{{age}} yrs', { age: patient.age })
                      : null,
                  ].filter(Boolean);

                  return (
                    <label
                      key={patient.uuid}
                      className={`${styles.correctionPatientOption}${
                        selectedPatientUuid === patient.uuid ? ` ${styles.correctionPatientOptionSelected}` : ''
                      }`}
                      htmlFor={`lcg-correction-patient-${patient.uuid}`}>
                      <input
                        type="radio"
                        id={`lcg-correction-patient-${patient.uuid}`}
                        name="lcg-correction-target-patient"
                        value={patient.uuid}
                        checked={selectedPatientUuid === patient.uuid}
                        onChange={() => setSelectedPatientUuid(patient.uuid)}
                        className={styles.correctionPatientRadio}
                      />
                      <div className={styles.correctionPatientDetails}>
                        <span className={styles.correctionPatientName}>{patient.displayName}</span>
                        {metaParts.length ? (
                          <span className={styles.correctionPatientMeta}>{metaParts.join(' • ')}</span>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <TextArea
            id="lcg-correction-transfer-notes"
            labelText={t('transferNotesOptional', 'Transfer notes (optional)')}
            value={transferNotes}
            onChange={(event) => setTransferNotes(event.target.value)}
            rows={3}
          />
        </Stack>
      </div>
    </Modal>
  );
};

export default LcgSessionCorrectionWizard;
