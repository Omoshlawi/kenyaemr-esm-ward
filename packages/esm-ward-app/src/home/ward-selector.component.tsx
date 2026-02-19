import React, { useState } from 'react';
import { ComboBox, InlineNotification, DropdownSkeleton, InlineLoading, Layer } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useLocationsByTag } from '../hooks/useAdmissionLocation';
import { type Location, navigate, setUserProperties, showSnackbar, useSession } from '@openmrs/esm-framework';
import styles from './ward-selector.scss';

const WardSelector = () => {
  const { t } = useTranslation();
  const { locations, isLoading, error } = useLocationsByTag('Admission Location');
  const { user } = useSession();
  const [isSaving, setIsSaving] = useState(false);

  const handleWardSelect = async ({ selectedItem }) => {
    const selectedWardUuid = selectedItem?.uuid;

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
  };

  if (error) {
    return (
      <InlineNotification
        aria-label="closes notification"
        kind="error"
        lowContrast={true}
        hideCloseButton={true}
        statusIconDescription="notification"
        subtitle={error.message}
        title={t('errorLoadingWards', 'Error loading wards')}
      />
    );
  }

  if (isLoading) {
    return <DropdownSkeleton />;
  }

  return (
    <div className={styles.wardSelector}>
      <Layer>
        <ComboBox
          id="ward-selector"
          titleText={t('selectWard', 'Select a ward')}
          placeholder={t('selectWardPlaceholder', 'Choose a ward to view')}
          items={locations}
          itemToString={(item: Location | null) => item?.display ?? ''}
          onChange={handleWardSelect}
          disabled={isLoading || isSaving}
          size="lg"
          light={false}
          downshiftProps={{ id: 'ward-selector-downshift' }}
        />
        {isSaving && (
          <InlineLoading status="active" description={t('savingDefaultWard', 'Saving your default ward...')} />
        )}
      </Layer>
    </div>
  );
};

export default WardSelector;
