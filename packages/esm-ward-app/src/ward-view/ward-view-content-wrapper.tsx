import { ContentSwitcher, Search, Switch } from '@carbon/react';
import { Grid, List, UserMultiple } from '@carbon/react/icons';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { WARD_PATIENTS_TAB_INDEX } from '../ward-patients/ward-patients-slots';
import { updateWardViewUi, useWardViewUi } from './ward-view-ui.store';
import styles from './ward-view.scss';

type WardViewContentWrapperProps = {
  cardView: React.ReactNode;
  tableView: React.ReactNode;
};
const WardViewContentWrapper: FC<WardViewContentWrapperProps> = ({ cardView, tableView }) => {
  const { t } = useTranslation();
  const view = useWardViewUi((state) => state.view);
  const search = useWardViewUi((state) => state.search);
  const selectedTab = useWardViewUi((state) => state.selectedTab);
  // The search filters the patient tables, so it only applies to the list view's patient tabs.
  const showSearch = view === 'list' && selectedTab <= WARD_PATIENTS_TAB_INDEX.discharged;

  return (
    <section className={styles.wrapperContainer}>
      <div className={styles.wrapperHeader}>
        <h2 className={styles.wrapperTitle}>
          <UserMultiple size={20} className={styles.wrapperTitleIcon} aria-hidden />
          {t('wardPatients', 'Ward Patients')}
        </h2>
        <div className={styles.wrapperActions}>
          {showSearch ? (
            <Search
              size="md"
              className={styles.search}
              labelText={t('searchPatient', 'Search patient')}
              placeholder={t('searchPatientPlaceholder', 'Search patient...')}
              value={search}
              onChange={(event) => updateWardViewUi({ search: event.target.value })}
            />
          ) : null}
          <ContentSwitcher
            onChange={({ index }) => updateWardViewUi({ view: index === 1 ? 'cards' : 'list' })}
            className={styles.switcher}
            selectedIndex={view === 'cards' ? 1 : 0}
            size="md">
            <Switch name="list">
              <span className={styles.switchLabel}>
                <List size={16} aria-hidden />
                {t('listView', 'List')}
              </span>
            </Switch>
            <Switch name="cards">
              <span className={styles.switchLabel}>
                <Grid size={16} aria-hidden />
                {t('cardView', 'Card')}
              </span>
            </Switch>
          </ContentSwitcher>
        </div>
      </div>
      <div className={styles.wrapperBody}>{view === 'cards' ? cardView : tableView}</div>
    </section>
  );
};

export default WardViewContentWrapper;
