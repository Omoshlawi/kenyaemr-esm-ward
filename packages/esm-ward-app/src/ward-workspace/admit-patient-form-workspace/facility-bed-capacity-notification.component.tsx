import { InlineNotification } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useFacilityRegistry } from '../../hooks/useFacilityRegistry';

const FacilityBedCapacityNotification: React.FC = () => {
  const { t } = useTranslation();
  const { bedOccupancy, isLoading } = useFacilityRegistry();

  if (isLoading) return null;

  const totalBeds = bedOccupancy?.totalBeds;
  if (!totalBeds || totalBeds <= 0) return null;

  const bedTypes: Array<{ label: string; value?: number }> = [
    { label: t('bedTypeNormal', 'Normal'), value: bedOccupancy?.normalBeds },
    { label: t('bedTypeIcu', 'ICU'), value: bedOccupancy?.icuBeds },
    { label: t('bedTypeHdu', 'HDU'), value: bedOccupancy?.hduBeds },
    { label: t('bedTypeDialysis', 'Dialysis'), value: bedOccupancy?.dialysisBeds },
    { label: t('bedTypeCots', 'Cots'), value: bedOccupancy?.numberOfCots },
  ];

  const breakdown = bedTypes
    .filter((type) => typeof type.value === 'number' && type.value > 0)
    .map((type) => `${type.label}: ${type.value}`)
    .join(' · ');

  const subtitle = [`${t('facilityTotalBeds', 'Total beds')}: ${totalBeds}`, breakdown].filter(Boolean).join(' — ');

  return (
    <InlineNotification
      kind="info"
      lowContrast
      hideCloseButton
      title={t('facilityBedCapacityTitle', 'Facility bed capacity (per kmpdc)')}
      subtitle={subtitle}
    />
  );
};

export default FacilityBedCapacityNotification;
