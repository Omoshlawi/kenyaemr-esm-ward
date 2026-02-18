import React, { useState } from 'react';
import {
  Button,
  ComboBox,
  InlineNotification,
  DropdownSkeleton,
  InlineLoading,
  Layer,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useLocationsByTag } from '../hooks/useAdmissionLocation';
import { type Location, navigate, setUserProperties, showSnackbar, useSession } from '@openmrs/esm-framework';
import styles from './materal-ward/ward-switch.scss';

interface WardSwitchModalProps {
  closeModal: () => void;
}

const WardSwitchModal: React.FC<WardSwitchModalProps> = ({ closeModal }) => {
  const { t } = useTranslation();
  const { locations, isLoading, error } = useLocationsByTag('Admission Location');
  const { user } = useSession();
  const [selectedWard, setSelectedWard] = useState<Location | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedWard?.uuid) {
      return;
    }

    if (user?.uuid) {
      setIsSaving(true);
      try {
        await setUserProperties(user.uuid, {
          defaultWardLocationUuid: selectedWard.uuid,
        });
      } catch {
        showSnackbar({
          title: t('errorSettingDefaultWard', 'Error setting default ward view'),
          subtitle: t(
            'errorMessageForSettingDefaultWard',
            'Proceed to selected ward view, your preference has not been set, you can try again',
          ),
          isLowContrast: true,
          kind: 'info',
        });
      } finally {
        setIsSaving(false);
      }
    }

    navigate({ to: `${globalThis.spaBase}/home/ward/${selectedWard.uuid}` });
    closeModal();
  };

  const handleCancel = () => {
    closeModal();
  };

  return (
    <div>
      <ModalHeader className={styles.headerTitle} closeModal={closeModal}>
        {t('switchWard', 'Switch ward')}
      </ModalHeader>
      <ModalBody className={styles.wardSwitchModal}>
        {error && (
          <InlineNotification
            aria-label="closes notification"
            kind="error"
            lowContrast={true}
            hideCloseButton={true}
            statusIconDescription="notification"
            subtitle={error.message}
            title={t('errorLoadingWards', 'Error loading wards')}
          />
        )}
        <p className={styles.subtitle}>
          {t('switchWardPrompt', 'Do you want to switch the ward you are currently viewing?')}
        </p>
        {isLoading ? (
          <DropdownSkeleton />
        ) : (
          <Layer>
            <div style={{ width: '100%' }}>
              <ComboBox
                id="ward-switch-selector"
                titleText={t('selectWard', 'Select a ward')}
                placeholder={t('selectWardPlaceholder', 'Choose a ward to view')}
                items={locations}
                itemToString={(item: Location | null) => item?.display ?? ''}
                onChange={({ selectedItem }) => setSelectedWard(selectedItem)}
                disabled={isLoading || isSaving}
                size="md"
                light={true}
                downshiftProps={{ id: 'ward-switch-selector-downshift' }}
              />
            </div>
          </Layer>
        )}
        {isSaving && (
          <InlineLoading status="active" description={t('savingDefaultWard', 'Saving your default ward...')} />
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={handleCancel} disabled={isSaving}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="primary" onClick={handleSave} disabled={!selectedWard || isSaving || isLoading}>
          {t('save', 'Save')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default WardSwitchModal;
