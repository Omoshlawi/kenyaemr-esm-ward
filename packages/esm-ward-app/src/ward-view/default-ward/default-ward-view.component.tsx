import { useDefineAppContext } from '@openmrs/esm-framework';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckmarkFilled, EventSchedule, Home, User } from '@carbon/react/icons';
import { useWardSummaryMetrics } from '../../hooks/useSummaryMetrics';
import useWardLocation from '../../hooks/useWardLocation';
import { useWardPatientGrouping } from '../../hooks/useWardPatientGrouping';
import { type WardViewContext } from '../../types';
import WardPatientsTable from '../../ward-patients/ward-patients-table';
import { WARD_PATIENTS_TAB_INDEX } from '../../ward-patients/ward-patients-slots';
import Filters from '../linelist-wards/Filters';
import Header from '../linelist-wards/Header';
import Metrics, { type Metric } from '../linelist-wards/Metrics';
import WardViewContentWrapper from '../ward-view-content-wrapper';
import Ward from '../ward.component';
import { resetWardViewUi, updateWardViewUi } from '../ward-view-ui.store';
import DefaultWardBeds from './default-ward-beds.component';
import DefaultWardPatientCardHeader from './default-ward-patient-card-header.component';
import DefaultWardPendingPatients from './default-ward-pending-patients.component';
import DefaultWardUnassignedPatients from './default-ward-unassigned-patients.component';
import { InlineLoading } from '@carbon/react';

const DefaultWardView = () => {
  const { location, isLoadingLocation } = useWardLocation();
  const { t } = useTranslation();
  const wardPatientGroupDetails = useWardPatientGrouping();
  const summary = useWardSummaryMetrics();
  useDefineAppContext<WardViewContext>('ward-view-context', {
    wardPatientGroupDetails,
    WardPatientHeader: DefaultWardPatientCardHeader,
  });

  // Start every ward with a clean search, the first tab and the list view.
  useEffect(() => {
    resetWardViewUi();
  }, [location?.uuid]);

  const cards = useMemo<Array<Metric>>(() => {
    const openTab = (tab: number) => () => updateWardViewUi({ selectedTab: tab, view: 'list' });
    return [
      {
        label: t('awaitingAdmission', 'Awaiting Admission'),
        value: `${summary.awaitingAdmissionPatient}`,
        icon: <User size={20} />,
        tone: 'blue',
        onClick: openTab(WARD_PATIENTS_TAB_INDEX.awaitingAdmission),
      },
      {
        label: t('admitted', 'Admitted'),
        value: `${summary.admittedPatients}`,
        icon: <CheckmarkFilled size={20} />,
        tone: 'green',
        onClick: openTab(WARD_PATIENTS_TAB_INDEX.admitted),
      },
      {
        label: t('dischargeIn', 'Discharge In'),
        value: `${summary.dischargeInPatients}`,
        icon: <EventSchedule size={20} />,
        tone: 'orange',
        onClick: openTab(WARD_PATIENTS_TAB_INDEX.dischargeIn),
      },
      {
        label: t('discharged', 'Discharged'),
        value: `${summary.dischargedPatients}`,
        icon: <Home size={20} />,
        tone: 'purple',
        onClick: openTab(WARD_PATIENTS_TAB_INDEX.discharged),
      },
    ];
  }, [t, summary]);

  const wardBeds = <DefaultWardBeds />;
  const wardUnassignedPatients = <DefaultWardUnassignedPatients />;
  const wardPendingPatients = <DefaultWardPendingPatients />;

  if (isLoadingLocation) {
    return <InlineLoading status="active" description={t('loadingLocation', 'Loading location...')} />;
  }

  return (
    <>
      <Header title={location.display}>
        <Filters inline />
      </Header>
      <Metrics metrics={cards} />
      {/* <WardViewHeader {...{ wardPendingPatients }} /> */}
      <WardViewContentWrapper
        cardView={<Ward {...{ wardBeds, wardUnassignedPatients }} />}
        tableView={<WardPatientsTable />}
      />
    </>
  );
};

export default DefaultWardView;
