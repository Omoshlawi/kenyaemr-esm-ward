import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Select, SelectItem, TextArea, Checkbox, TextInput } from '@carbon/react';
import type { LcgEmergencySectionKey } from '../types';

type EmergencyEntryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (payload: { section: LcgEmergencySectionKey; reason: string }) => void;
};

const sectionOptions: Array<{ value: LcgEmergencySectionKey; label: string }> = [
  { value: 'supportive-care', label: 'Supportive care' },
  { value: 'baby', label: 'Baby' },
  { value: 'woman', label: 'Woman' },
  { value: 'labour-progress', label: 'Labour progress' },
  { value: 'medication', label: 'Medication' },
  { value: 'shared-decision-making', label: 'Shared decision-making' },
];

const EmergencyEntryModal: React.FC<EmergencyEntryModalProps> = ({ isOpen, onClose, onContinue }) => {
  const { t } = useTranslation();
  const [section, setSection] = React.useState<LcgEmergencySectionKey | ''>('');
  const [reason, setReason] = React.useState('');
  const [consentChecked, setConsentChecked] = React.useState(false);
  const [confirmPhrase, setConfirmPhrase] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSection('');
    setReason('');
    setConsentChecked(false);
    setConfirmPhrase('');
  }, [isOpen]);

  const isSubmitDisabled =
    !section || !reason.trim() || !consentChecked || confirmPhrase.trim().toUpperCase() !== 'CONFIRM';

  return (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      modalHeading={t('emergencyEntry', 'Emergency entry override')}
      primaryButtonText={t('continue', 'Continue')}
      primaryButtonDisabled={isSubmitDisabled}
      secondaryButtonText={t('cancel', 'Cancel')}
      onRequestSubmit={() => {
        if (!section || !reason.trim()) {
          return;
        }

        onContinue({ section, reason: reason.trim() });
      }}
      onSecondarySubmit={onClose}
      size="md">
      <p>
        {t(
          'emergencyEntryWarning',
          'Use only when urgently needed. Emergency entries bypass the normal slot lock, but only allow current/future times.',
        )}
      </p>

      <div style={{ marginTop: '1rem' }}>
        <Select
          id="emergency-section"
          labelText={t('section', 'Section')}
          value={section}
          onChange={(event) => setSection((event.target as HTMLSelectElement).value as LcgEmergencySectionKey)}>
          <SelectItem value="" text={t('selectSection', 'Select section')} />
          {sectionOptions.map((option) => (
            <SelectItem key={option.value} value={option.value} text={t(option.value, option.label)} />
          ))}
        </Select>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <TextArea
          id="emergency-reason"
          labelText={t('reason', 'Reason')}
          value={reason}
          rows={4}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Checkbox
          id="emergency-consent"
          checked={consentChecked}
          labelText={t(
            'emergencyConsent',
            'I confirm this is an emergency override and understand this entry will be marked emergency in table history.',
          )}
          onChange={(_, data) => setConsentChecked(Boolean(data.checked))}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <TextInput
          id="emergency-confirm-phrase"
          labelText={t('emergencyConfirmPhrase', 'Type CONFIRM to authorize emergency override')}
          placeholder="CONFIRM"
          value={confirmPhrase}
          onChange={(event) => setConfirmPhrase((event.target as HTMLInputElement).value)}
          invalid={confirmPhrase.trim().length > 0 && confirmPhrase.trim().toUpperCase() !== 'CONFIRM'}
          invalidText={t('confirmPhraseInvalid', 'Type exactly "CONFIRM" to proceed')}
        />
      </div>
    </Modal>
  );
};

export default EmergencyEntryModal;
