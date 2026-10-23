import React, { useState } from 'react';
import { useAddressHierachy } from './contact-list.resource';
import { ComboBox, InlineLoading, InlineNotification, type ComboBoxProps } from '@carbon/react';
import { useTranslation } from 'react-i18next';

type AddressHierarchyProps = Omit<ComboBoxProps<{ name: string }>, 'items' | 'onChange' | 'selectedItem'> & {
  search?: string;
  onChange?: (value?: string) => void;
};
const AddressHierarchy: React.FC<AddressHierarchyProps> = ({ search = '', onChange, value, ...props }) => {
  const [search_, setSearch] = useState<string>('');
  const { addresses, error, isLoading } = useAddressHierachy(search);
  const { t } = useTranslation();
  return (
    <div>
      <ComboBox<{ name: string }>
        {...props}
        itemToString={(item) => item?.name ?? ''}
        items={addresses.filter((add) => add.name.toLowerCase().includes(search_?.toLowerCase()))}
        onChange={({ selectedItem }) => {
          onChange?.(selectedItem?.name);
        }}
        selectedItem={addresses.find((ad) => ad.name === value)}
        onInputChange={setSearch}
      />
      {isLoading && <InlineLoading description={t('loading', 'Loading') + '....'} />}
      {error && <InlineNotification kind="error" title={t('error', 'Error')} subtitle={error?.message} />}
    </div>
  );
};

export default AddressHierarchy;
