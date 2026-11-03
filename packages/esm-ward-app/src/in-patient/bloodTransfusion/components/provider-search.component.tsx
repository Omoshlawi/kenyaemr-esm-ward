import React, { useEffect, useState } from 'react';
import { InlineLoading, TextInput } from '@carbon/react';
import { useDebounce } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { type ProviderOption, useProviderSearch } from '../resources/provider.resource';
import styles from './provider-search.scss';

type ProviderSearchProps = {
  id: string;
  labelText: React.ReactNode;
  /** Name of the selected provider. */
  value: string | undefined;
  /** Called with `undefined` once the text no longer matches a picked provider. */
  onChange: (provider: ProviderOption | undefined) => void;
  disabled?: boolean;
  invalid?: boolean;
  invalidText?: string;
  minChars?: number;
};

const ProviderSearch: React.FC<ProviderSearchProps> = ({
  id,
  labelText,
  value,
  onChange,
  disabled = false,
  invalid = false,
  invalidText,
  minChars = 3,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const { providers, isLoading } = useProviderSearch(open ? debouncedQuery : '', minChars);

  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  const handleChange = (text: string) => {
    setQuery(text);
    setOpen(text.trim().length >= minChars);
    if (value && text !== value) {
      onChange(undefined);
    }
  };

  const select = (provider: ProviderOption) => {
    onChange(provider);
    setQuery(provider.display);
    setOpen(false);
  };

  const tooShort = !disabled && query.length > 0 && query.trim().length < minChars && !value;

  return (
    <div className={styles.wrapper}>
      <TextInput
        id={id}
        size="sm"
        autoComplete="off"
        labelText={labelText}
        placeholder={t('searchProviderMinChars', 'Type at least {{count}} letters to search providers', {
          count: minChars,
        })}
        value={query}
        disabled={disabled}
        invalid={invalid}
        invalidText={invalidText}
        helperText={
          tooShort
            ? t('minimumCharacters', 'Type at least {{count}} characters to search', { count: minChars })
            : undefined
        }
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setOpen(!value && query.trim().length >= minChars)}
        onBlur={() => globalThis.setTimeout(() => setOpen(false), 150)}
      />
      {open ? (
        <div className={styles.results} role="listbox" aria-label={t('providers', 'Providers')}>
          {isLoading || debouncedQuery !== query ? (
            <div className={styles.status}>
              <InlineLoading description={t('searching', 'Searching...')} />
            </div>
          ) : providers.length ? (
            providers.map((provider) => (
              <button
                key={provider.uuid}
                type="button"
                role="option"
                aria-selected={provider.display === value}
                className={styles.option}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(provider)}>
                {provider.display}
              </button>
            ))
          ) : (
            <div className={styles.status}>{t('noProvidersFound', 'No providers found')}</div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ProviderSearch;
