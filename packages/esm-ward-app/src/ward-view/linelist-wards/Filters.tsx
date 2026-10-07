import React from 'react';
import classNames from 'classnames';
import { DatePicker, DatePickerInput } from '@carbon/react';
import { Calendar } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import styles from './linelist-wards.scss';

type FiltersProps = {
  /** Render compactly inside the page header instead of as a standalone row. */
  inline?: boolean;
};

const Filters: React.FC<FiltersProps> = ({ inline = false }) => {
  const { t } = useTranslation();
  return (
    <div className={classNames(styles.filtersContainer, { [styles.filtersInline]: inline })}>
      <Calendar size={16} className={styles.filterIcon} aria-hidden />
      <DatePicker
        className={styles.datePicker}
        datePickerType="single"
        onChange={() => {}}
        onClose={() => {}}
        onOpen={() => {}}>
        <DatePickerInput
          id="date-picker-single"
          labelText={t('date', 'Date')}
          hideLabel
          size="sm"
          onChange={() => {}}
          placeholder="mm/dd/yyyy"
        />
      </DatePicker>
    </div>
  );
};

export default Filters;
