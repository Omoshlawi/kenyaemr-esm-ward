import { InlineLoading, OverflowMenuItem, Tag } from '@carbon/react';
import {
  ConfigurableLink,
  formatDatetime,
  parseDate,
  useConfig,
  useEmrConfiguration,
  usePatient,
} from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { type FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../config-schema';
import { useEncounterDetails } from '../hooks/useIpdDischargeEncounter';
import { usePatientBills } from '../ward-workspace/kenya-emr-patient-discharge/patient-discharge.resource';
import styles from './patient-cells.scss';

type CellProps = {
  patientUuid: string;
};

export const PatientAgeCell: FC<CellProps> = ({ patientUuid }) => {
  const { isLoading, patient, error } = usePatient(patientUuid);
  const age = useMemo(() => {
    if (!patient?.birthDate) return '--';
    return dayjs().diff(dayjs(patient.birthDate), 'years');
  }, [patient?.birthDate]);
  if (isLoading) return <InlineLoading />;
  if (error) return <p>--</p>;
  return <div>{age}</div>;
};

export const HyperLinkPatientCell: FC<CellProps & { patientName: string }> = ({ patientUuid, patientName }) => {
  const patientChartUrl = '${openmrsSpaBase}/patient/${patientUuid}/chart/Patient Summary';
  return (
    <ConfigurableLink to={patientChartUrl} templateParams={{ patientUuid }} className={styles.patientLink}>
      {patientName}
    </ConfigurableLink>
  );
};

export const PatientGenderCell: FC<CellProps> = ({ patientUuid }) => {
  const { isLoading, patient, error } = usePatient(patientUuid);

  if (isLoading) return <InlineLoading />;
  if (error) return <p>--</p>;
  return <div>{patient.gender}</div>;
};

type PatientAdmissionCellProps = CellProps & {
  encounterUuid: string;
  visitUuid?: string;
};

export const PatientAdmissionDateCell: FC<PatientAdmissionCellProps> = ({ encounterUuid }) => {
  const { encounter, error, isLoading } = useEncounterDetails(encounterUuid);
  const { emrConfiguration } = useEmrConfiguration();

  const admissionDate = useMemo(() => {
    const admisionEncounter = encounter?.visit?.encounters?.find(
      (e) =>
        e.encounterType.uuid === emrConfiguration?.admissionEncounterType?.uuid ||
        e.encounterType.uuid === emrConfiguration?.transferWithinHospitalEncounterType?.uuid,
    );
    if (!admisionEncounter || !admisionEncounter.encounterDatetime) return '--';
    return formatDatetime(parseDate(admisionEncounter.encounterDatetime));
  }, [encounter, emrConfiguration]);
  if (isLoading) return <InlineLoading />;
  if (error) return <p>--</p>;

  return <span>{admissionDate}</span>;
};

export const PatientDayInWardCell: FC<PatientAdmissionCellProps> = ({ encounterUuid }) => {
  const { encounter, error, isLoading } = useEncounterDetails(encounterUuid);
  const { emrConfiguration } = useEmrConfiguration();

  const daysInWard = useMemo(() => {
    const admisionEncounter = encounter?.visit?.encounters?.find(
      (e) =>
        e.encounterType.uuid === emrConfiguration?.admissionEncounterType?.uuid ||
        e.encounterType.uuid === emrConfiguration?.transferWithinHospitalEncounterType?.uuid,
    );
    if (!admisionEncounter || !admisionEncounter.encounterDatetime) return '--';
    const dischargeEncounter = encounter?.visit?.encounters?.find((e) => e.uuid === encounterUuid);
    if (!dischargeEncounter || !dischargeEncounter.encounterDatetime) return '--';

    const admissionDate = dayjs(admisionEncounter.encounterDatetime).startOf('day');
    const dischargeDate = dischargeEncounter.encounterDatetime
      ? dayjs(dischargeEncounter.encounterDatetime).startOf('day')
      : dayjs().startOf('day');
    const daysAdmitted =
      admissionDate.isValid() && dischargeDate.isValid()
        ? Math.abs(dischargeDate.diff(admissionDate, 'days')) + 0
        : '--';
    return daysAdmitted;
  }, [encounter, encounterUuid, emrConfiguration]);
  if (isLoading) return <InlineLoading />;
  if (error) return <p>--</p>;

  return <p>{daysInWard}</p>;
};
const useAdmissionBillingDetails = (encounterUuid: string) => {
  const { encounter, error, isLoading } = useEncounterDetails(encounterUuid);
  const config = useConfig<WardConfigObject>();

  const admissionDate = useMemo(() => {
    if (!encounter?.encounterDatetime) return null;
    const date = dayjs(encounter.encounterDatetime);
    return date.isValid() ? date.startOf('day') : null;
  }, [encounter]);

  const ipdDischargeEncounter = useMemo(() => {
    if (!encounter?.visit?.encounters || !config?.ipdDischargeEncounterTypeUuid) return null;
    return encounter.visit.encounters.find((e) => e.encounterType?.uuid === config.ipdDischargeEncounterTypeUuid);
  }, [encounter, config]);

  const endDate = useMemo(() => {
    if (ipdDischargeEncounter?.encounterDatetime) {
      const date = dayjs(ipdDischargeEncounter.encounterDatetime);
      if (date.isValid()) return date.endOf('day');
    }
    return dayjs().endOf('day');
  }, [ipdDischargeEncounter]);

  const daysInWard = useMemo(() => {
    if (!admissionDate) return 0;
    const endDay = endDate.startOf('day');
    return Math.abs(endDay.diff(admissionDate, 'days')) + 0;
  }, [admissionDate, endDate]);

  return { encounter, error, isLoading, daysInWard };
};

export const PatientBillStatus: FC<PatientAdmissionCellProps> = ({ patientUuid, encounterUuid, visitUuid = '' }) => {
  const { error, isLoading, daysInWard } = useAdmissionBillingDetails(encounterUuid);
  const { t } = useTranslation();

  const {
    isLoading: isLoadingBills,
    error: billsError,
    bills,
    pendingBills,
    isValidating,
    dailyBedFeeSettled,
  } = usePatientBills(visitUuid, patientUuid);

  if (isLoading || isLoadingBills || isValidating) return <InlineLoading />;
  if (error || billsError) return <p>--</p>;
  if (bills.length === 0) return <Tag type="red">{t('billsNotRaised', 'Bills Not Raised')}</Tag>;
  if (pendingBills.length > 0) return <Tag type="red">{t('pendingBills', 'Pending Bills')}</Tag>;
  if (!dailyBedFeeSettled(daysInWard))
    return <Tag type="red">{t('dailyBedFeeUnmatching', 'Daily bed fee and days in ward not matching')}</Tag>;
  return <Tag type="green">{t('billsSettled', 'Bills Settled')}</Tag>;
};

type UnAssignPatientBedActionProps = PatientAdmissionCellProps & {
  onClick?: () => void;
  loading?: boolean;
};

export const UnAssignPatientBedAction: FC<UnAssignPatientBedActionProps> = ({
  encounterUuid,
  patientUuid,
  visitUuid = '',
  onClick,
  loading,
}) => {
  const { error, isLoading, daysInWard } = useAdmissionBillingDetails(encounterUuid);
  const { t } = useTranslation();

  const {
    isLoading: isLoadingBills,
    error: billsError,
    bills,
    pendingBills,
    dailyBedFeeSettled,
  } = usePatientBills(visitUuid, patientUuid);

  if (isLoading || isLoadingBills || loading) return <InlineLoading />;
  if (error || billsError) return null;
  if (bills.length === 0) return null;
  if (pendingBills.length > 0) return null;
  if (!dailyBedFeeSettled(daysInWard)) return null;
  return <OverflowMenuItem itemText={t('unAssignBed', 'Un Assign bed')} onClick={onClick} />;
};

type CreateWardBillActionProps = PatientAdmissionCellProps & {
  onClick?: () => void;
};

/**
 * "Create Ward Bill" overflow item. Kept enabled only when a bill would
 * actually be actionable:
 *   - no bill has been raised yet, OR
 *   - some bills exist but the daily bed fee is still short of the days in
 *     ward (i.e. more line items are needed).
 * It's disabled when there are pending (unsettled) bills or when the bills
 * are already fully settled.
 */
export const CreateWardBillAction: FC<CreateWardBillActionProps> = ({
  encounterUuid,
  patientUuid,
  visitUuid = '',
  onClick,
}) => {
  const { t } = useTranslation();
  const { isLoading, daysInWard } = useAdmissionBillingDetails(encounterUuid);
  const {
    isLoading: isLoadingBills,
    bills,
    pendingBills,
    dailyBedFeeSettled,
  } = usePatientBills(visitUuid, patientUuid);

  const disabled = useMemo(() => {
    if (isLoading || isLoadingBills) return true;
    // No bills yet → user should be able to raise one.
    if (bills.length === 0) return false;
    // Any pending (unsettled) bill blocks new bill creation.
    if (pendingBills.length > 0) return true;
    // Bills exist and are settled, but daily bed fee still trails the stay →
    // allow topping up.
    if (!dailyBedFeeSettled(daysInWard)) return false;
    // Everything is settled → nothing to raise.
    return true;
  }, [isLoading, isLoadingBills, bills, pendingBills, dailyBedFeeSettled, daysInWard]);

  return <OverflowMenuItem itemText={t('createWardBill', 'Create Ward Bill')} onClick={onClick} disabled={disabled} />;
};
