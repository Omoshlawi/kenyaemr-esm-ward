import React from 'react';
import { InlineNotification, Modal, RadioButton, RadioButtonGroup, Search, Stack, TextArea } from '@carbon/react';
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
      size="md">
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
        ) : (
          <RadioButtonGroup
            legendText={t('selectCorrectPatient', 'Select correct patient')}
            name="lcg-correction-target-patient"
            valueSelected={selectedPatientUuid}
            onChange={(value) => setSelectedPatientUuid(String(value))}>
            {filteredPatients.map((patient) => (
              <RadioButton
                key={patient.uuid}
                id={`lcg-correction-patient-${patient.uuid}`}
                labelText={`${patient.displayName}${patient.identifier ? ` (${patient.identifier})` : ''}${
                  patient.age ? ` • ${patient.age}` : ''
                }`}
                value={patient.uuid}
              />
            ))}
          </RadioButtonGroup>
        )}

        <TextArea
          id="lcg-correction-transfer-notes"
          labelText={t('transferNotesOptional', 'Transfer notes (optional)')}
          value={transferNotes}
          onChange={(event) => setTransferNotes(event.target.value)}
          rows={3}
        />
      </Stack>
    </Modal>
  );
};

export default LcgSessionCorrectionWizard;
