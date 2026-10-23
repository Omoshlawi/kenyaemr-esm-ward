import React, { useState } from 'react';
import { useRelationshipTypes } from './contact-list.resource';
import { ComboBox, InlineLoading, InlineNotification, type ComboBoxProps } from '@carbon/react';
import { type RelationshipType } from './contact-list.types';
import { useTranslation } from 'react-i18next';
type RelationshipTypeInputProps = Omit<ComboBoxProps<RelationshipType>, 'items' | 'onChange' | 'selectedItem'> & {
  onChange?: (value?: string) => void;
};
const RelationshipTypeInput: React.FC<RelationshipTypeInputProps> = ({ onChange, value, ...props }) => {
  const [search_, setSearch] = useState<string>('');
  const { error, isLoading, relationshipTypes } = useRelationshipTypes();
  const { t } = useTranslation();
  return (
    <div>
      <ComboBox<RelationshipType>
        {...props}
        itemToString={(item) => item?.displayBIsToA ?? ''}
        items={relationshipTypes.filter((add) => add.displayBIsToA.toLowerCase().includes(search_?.toLowerCase()))}
        onChange={({ selectedItem }) => {
          onChange?.(selectedItem?.uuid);
        }}
        selectedItem={relationshipTypes.find((ad) => ad.uuid === value)}
        onInputChange={setSearch}
      />
      {isLoading && <InlineLoading description={t('loading', 'Loading') + '....'} />}
      {error && <InlineNotification kind="error" title={t('error', 'Error')} subtitle={error?.message} />}
    </div>
  );
};

export default RelationshipTypeInput;
