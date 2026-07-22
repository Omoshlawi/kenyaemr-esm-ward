import { DataTableSkeleton, InlineLoading, Layer, Tile } from '@carbon/react';
import { Alarm, Calendar, Location } from '@carbon/react/icons';
import {
  CardHeader,
  EmptyCardIllustration,
  ErrorState,
  ExtensionSlot,
  formatDatetime,
  HospitalBedIcon,
  parseDate,
  useConfig,
  usePatient,
} from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../config-schema';
import { useAdmissionLocation } from '../hooks/useAdmissionLocation';
import useCurrentPatientAdmissionEncounter from '../hooks/useCurrentPatientAdmissionEncounter';
import InpatientForms from './inpatient-forms.component';
import styles from './inpatient.scss';
import { timeAgo } from './time-ago';

type InpatientDetailViewProps = {
  patientUuid: string;
};

// t('inpatientDetails', 'Inpatient Detail') - Required for tab title translation
const InpatientDetailView: FC<InpatientDetailViewProps> = ({ patientUuid }) => {
  const { isLoading: isLoadingPatient, patient, error } = usePatient(patientUuid);
  const {
    isLoading: isLoadingAdmissionEncounter,
    error: errorAdmissionEncounter,
    currentVisit,
  } = useCurrentPatientAdmissionEncounter(patientUuid);
  const { inPatientVisitTypeUuid } = useConfig<WardConfigObject>();
  const { t } = useTranslation();
  if (isLoadingAdmissionEncounter || isLoadingPatient) {
    return <DataTableSkeleton />;
  }

  if (error || errorAdmissionEncounter) {
    return (
      <ErrorState error={error ?? errorAdmissionEncounter} headerTitle={t('inpatientdetails', 'Inpatient Details')} />
    );
  }

  if (!currentVisit || currentVisit?.visitType?.uuid !== inPatientVisitTypeUuid) {
    return (
      <Layer>
        <CardHeader title={t('inpatientdetails', 'Inpatient Details')}>
          <></>
        </CardHeader>
        <Tile className={styles.patientNotAdmitted}>
          <EmptyCardIllustration />
          <p>{t('noActiveVisit', 'This Patient Not currently admitted to ward')}</p>
        </Tile>
      </Layer>
    );
  }

  return (
    <div>
      <PatientAdmitted patientUuid={patientUuid} patient={patient} />
    </div>
  );
};

export default InpatientDetailView;

const PatientAdmitted: FC<{
  patientUuid: string;
  patient: fhir.Patient;
}> = ({ patient, patientUuid }) => {
  const { i18n } = useTranslation();
  const { admissionEncounter, isPatientAdmitted } = useCurrentPatientAdmissionEncounter(patientUuid);
  const { t } = useTranslation();

  const { dateOfAdmission, daysSinceAdmission } = useMemo(() => {
    const dateOfAdmission = admissionEncounter?.encounterDatetime
      ? parseDate(admissionEncounter.encounterDatetime)
      : null;

    if (!dateOfAdmission) {
      return {
        dateOfAdmission: null,
        daysSinceAdmission: 0,
      };
    }

    const admissionDate = dayjs(dateOfAdmission).startOf('day');
    const today = dayjs().startOf('day');

    const differenceInDays = today.diff(admissionDate, 'day');

    return {
      dateOfAdmission,
      daysSinceAdmission: Math.max(0, differenceInDays),
    };
  }, [admissionEncounter?.encounterDatetime]);
  const { isLoading, admissionLocation, error } = useAdmissionLocation(undefined, admissionEncounter?.location?.uuid);
  const bedLayout = useMemo(() => {
    return admissionLocation?.bedLayouts?.find((layout) => layout.patients?.some((pat) => pat?.uuid === patientUuid));
  }, [admissionLocation, patientUuid]);

  if (!isPatientAdmitted) {
    return (
      <Layer>
        <CardHeader title={t('admissionDetails', 'Admission Details')}>
          <></>
        </CardHeader>
        <Tile className={styles.patientNotAdmitted}>
          <EmptyCardIllustration />
          <p>{t('patientNotAdmitted', 'This Patient Not currently admitted to ward')}</p>;
        </Tile>
      </Layer>
    );
  }
  return (
    <Layer>
      <CardHeader title={t('admissionDetail', 'Admission Details')}>
        <InpatientForms patientUuid={patientUuid} patient={patient} />
      </CardHeader>
      <div className={styles.detailsContainer}>
        <Tile className={styles.detailTile}>
          <Calendar size={20} className={styles.tileIcon} />
          <p className={styles.tileLabel}>{t('dateOfAdmission', 'Date of Admission')}</p>
          <p className={styles.tileValue}>{dateOfAdmission ? formatDatetime(dateOfAdmission) : '--'}</p>
        </Tile>
        <Tile className={styles.detailTile}>
          <Alarm size={20} className={styles.tileIcon} />
          <p className={styles.tileLabel}>{t('daysInWard', 'Days in ward')}</p>
          <p className={styles.tileValue}>{daysSinceAdmission}</p>
          <p className={styles.titleValueSubTitle}>
            {daysSinceAdmission === 0 &&
              ` ${t('durationSinceAdmission', 'Duration since admission')} ( ${timeAgo(admissionEncounter?.encounterDatetime, i18n.resolvedLanguage ?? i18n.language)} )`}
          </p>
        </Tile>
        <Tile className={styles.detailTile}>
          <Location size={20} className={styles.tileIcon} />
          <p className={styles.tileLabel}>{t('ward', 'Ward')}</p>
          <p className={styles.tileValue}>{admissionEncounter?.location?.display ?? '--'}</p>
        </Tile>
        <Tile className={styles.detailTile}>
          {isLoading ? (
            <InlineLoading />
          ) : (
            <>
              <HospitalBedIcon size={20} className={styles.tileIcon} />
              <p className={styles.tileLabel}>{t('bed', 'Bed')}</p>
              <p className={styles.tileValue}>{bedLayout?.bedNumber ?? '--'}</p>
            </>
          )}
        </Tile>
      </div>
      <ExtensionSlot name="inpatient-obs-slot" state={{ patientUuid }} />
    </Layer>
  );
};
