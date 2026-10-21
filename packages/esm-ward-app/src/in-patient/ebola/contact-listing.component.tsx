import { EmptyState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

const ContactListing = () => {
  const { t } = useTranslation();
  return <EmptyState headerTitle={t('contactListing', 'Contact Listing')} displayText={t('contacts', 'Contacts')} />;
};

export default ContactListing;
