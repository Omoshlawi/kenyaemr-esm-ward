import React from 'react';
import { useTranslation } from 'react-i18next';
import { Add, ChartColumn, Table as TableIcon } from '@carbon/react/icons';
import styles from '../labour-care-guide.scss';

type SectionToolbarProps = {
  showViewToggle?: boolean;
  viewMode: 'graph' | 'table';
  onViewModeChange: (mode: 'graph' | 'table') => void;
  onAddClick?: () => void;
  isAddButtonDisabled?: boolean;
  addLabel?: string;
};

export const SectionToolbar: React.FC<SectionToolbarProps> = ({
  showViewToggle = true,
  viewMode,
  onViewModeChange,
  onAddClick,
  isAddButtonDisabled = false,
  addLabel,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.sectionToolbar}>
      {showViewToggle ? (
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.iconButton} ${viewMode === 'graph' ? styles.iconButtonActive : ''}`}
            onClick={() => onViewModeChange('graph')}>
            <ChartColumn size={16} />
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${viewMode === 'table' ? styles.iconButtonActive : ''}`}
            onClick={() => onViewModeChange('table')}>
            <TableIcon size={16} />
          </button>
        </div>
      ) : null}

      {onAddClick ? (
        <button type="button" className={styles.addButton} onClick={onAddClick} disabled={isAddButtonDisabled}>
          <span>{addLabel ?? t('add', 'Add')}</span>
          <span className={styles.addDivider} />
          <Add size={16} />
        </button>
      ) : null}
    </div>
  );
};
