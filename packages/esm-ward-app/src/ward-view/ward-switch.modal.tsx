import React, { useMemo, useState } from 'react';
import {
  Button,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  RadioButton,
  RadioButtonGroup,
  RadioButtonSkeleton,
  Search,
  Tag,
} from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useLocationsByTag } from '../hooks/useAdmissionLocation';
import useWardLocation from '../hooks/useWardLocation';
import { navigate, setUserProperties, showSnackbar, useSession } from '@openmrs/esm-framework';
import styles from './materal-ward/ward-switch.scss';

interface WardSwitchModalProps {
  closeModal: () => void;
}

const WardSwitchModal: React.FC<WardSwitchModalProps> = ({ closeModal }) => {
  const { t } = useTranslation();
  const { locations, isLoading, error } = useLocationsByTag('Admission Location');
  const { location: currentWard } = useWardLocation();
  const { user } = useSession();
  const [search, setSearch] = useState('');
  const [selectedWardUuid, setSelectedWardUuid] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const wards = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...locations]
      .filter((ward) => !term || ward.display?.toLowerCase().includes(term))
      .sort((a, b) => (a.display ?? '').localeCompare(b.display ?? ''));
  }, [locations, search]);

  const handleSave = async () => {
    if (!selectedWardUuid) {
      return;
    }

    if (user?.uuid) {
      setIsSaving(true);
      try {
        await setUserProperties(user.uuid, {
          defaultWardLocationUuid: selectedWardUuid,
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

    navigate({ to: `${globalThis.spaBase}/home/ward/${selectedWardUuid}` });
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
        <Search
          size="md"
          className={styles.search}
          labelText={t('searchWards', 'Search wards')}
          placeholder={t('searchWardsPlaceholder', 'Search wards...')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={isLoading || isSaving}
        />
        <div className={styles.wardList}>
          {isLoading ? (
            <>
              <RadioButtonSkeleton />
              <RadioButtonSkeleton />
              <RadioButtonSkeleton />
            </>
          ) : wards.length ? (
            <RadioButtonGroup
              name="ward-switch-selector"
              aria-label={t('selectWard', 'Select a ward')}
              orientation="vertical"
              valueSelected={selectedWardUuid ?? ''}
              onChange={(value) => setSelectedWardUuid(String(value))}
              disabled={isSaving}>
              {wards.map((ward) => {
                const isCurrent = ward.uuid === currentWard?.uuid;
                return (
                  <RadioButton
                    key={ward.uuid}
                    id={`ward-switch-${ward.uuid}`}
                    className={styles.wardOption}
                    value={ward.uuid}
                    disabled={isCurrent}
                    labelText={
                      <span className={styles.wardOptionLabel}>
                        {ward.display}
                        {isCurrent ? (
                          <Tag size="sm" type="teal">
                            {t('currentWard', 'Current')}
                          </Tag>
                        ) : null}
                      </span>
                    }
                  />
                );
              })}
            </RadioButtonGroup>
          ) : (
            <p className={styles.emptyMessage}>{t('noWardsFound', 'No wards match your search')}</p>
          )}
        </div>
        {isSaving && (
          <InlineLoading status="active" description={t('savingDefaultWard', 'Saving your default ward...')} />
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal} disabled={isSaving}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="primary" onClick={handleSave} disabled={!selectedWardUuid || isSaving || isLoading}>
          {t('save', 'Save')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default WardSwitchModal;
