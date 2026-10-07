import {
  DataTable,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  type Encounter,
  formatDatetime,
  launchWorkspace2,
  parseDate,
  useAppContext,
  useConfig,
  useEmrConfiguration,
  usePagination,
} from '@openmrs/esm-framework';
import { usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { useWardPatientSearch } from '../ward-view/ward-view-ui.store';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../config-schema';
import { type WardPatient, type WardViewContext } from '../types';
import { bedLayoutToBed, getOpenmrsId } from '../ward-view/ward-view.resource';
import { usePatientDischarge } from '../ward-workspace/kenya-emr-patient-discharge/patient-discharge.resource';
import {
  CreateWardBillAction,
  HyperLinkPatientCell,
  PatientBillStatus,
  UnAssignPatientBedAction,
} from './patient-cells';
import { EmptyState } from './table-state-components';
import styles from './ward-patient.scss';

const DischargeInPatients = () => {
  const { t } = useTranslation();
  const search = useWardPatientSearch();
  const { wardPatientGroupDetails } = useAppContext<WardViewContext>('ward-view-context') ?? {};
  const { bedLayouts, wardAdmittedPatientsWithBed, isLoading } = wardPatientGroupDetails ?? {};
  const { emrConfiguration, isLoadingEmrConfiguration } = useEmrConfiguration();
  const { handleDischarge } = usePatientDischarge();

  const config = useConfig<WardConfigObject>();
  const headers = [
    { key: 'admissionDate', header: t('admissionDate', 'Admission Date') },
    { key: 'idNumber', header: t('idNumber', 'ID Number') },
    { key: 'name', header: t('name', 'Name') },
    { key: 'gender', header: t('gender', 'Gender') },
    { key: 'age', header: t('age', 'Age') },
    { key: 'bedNumber', header: t('bedNumber', 'Bed Number') },
    { key: 'daysAdmitted', header: t('durationOnWard', 'Duration on Ward') },
    { key: 'billStatus', header: t('billStatus', 'Bill Status') },
  ];

  const patients = useMemo(() => {
    return (
      bedLayouts
        ?.map((bedLayout) => {
          const { patients } = bedLayout;
          const bed = bedLayoutToBed(bedLayout);
          const wardPatients: WardPatient[] = patients.map((patient): WardPatient => {
            const inpatientAdmission = wardAdmittedPatientsWithBed?.get(patient.uuid);
            if (inpatientAdmission) {
              const { patient, visit, currentInpatientRequest } = inpatientAdmission;
              return { patient, visit, bed, inpatientAdmission, inpatientRequest: currentInpatientRequest || null };
            } else {
              return {
                patient: patient,
                visit: null,
                bed,
                inpatientAdmission: null,
                inpatientRequest: null,
              };
            }
          });
          return wardPatients;
        })
        ?.flat() ?? []
    ).filter((pat) => {
      const ipdDischargeEncounter = pat?.visit?.encounters?.find(
        (encounter) => encounter.encounterType?.uuid === config.ipdDischargeEncounterTypeUuid,
      );
      if (!ipdDischargeEncounter) return false;
      return true;
    });
  }, [bedLayouts, wardAdmittedPatientsWithBed, config]);

  const [pageSize, setPageSize] = useState(5);
  const searchResults = useMemo(() => {
    return patients?.filter((pat) => pat?.patient?.person?.display?.toLowerCase().includes(search.toLowerCase()));
  }, [patients, search]);
  const { paginated, results, totalPages, currentPage, goTo } = usePagination(searchResults, pageSize);
  const { pageSizes } = usePaginationInfo(pageSize, totalPages, currentPage, results.length);

  const tableRows = useMemo(() => {
    return results.map((patient, index) => {
      const { encounterAssigningToCurrentInpatientLocation, visit } = patient.inpatientAdmission ?? {};

      const admissionDate = encounterAssigningToCurrentInpatientLocation?.encounterDatetime
        ? formatDatetime(parseDate(encounterAssigningToCurrentInpatientLocation!.encounterDatetime!))
        : '--';
      const daysAdmitted = encounterAssigningToCurrentInpatientLocation?.encounterDatetime
        ? Math.max(
            0,
            dayjs()
              .startOf('day')
              .diff(dayjs(encounterAssigningToCurrentInpatientLocation.encounterDatetime).startOf('day'), 'day'),
          )
        : '--';

      return {
        id: patient.patient?.uuid ?? index.toString(),
        admissionDate,
        idNumber: getOpenmrsId(patient.patient?.identifiers ?? []) ?? '--',
        name: (
          <HyperLinkPatientCell
            patientName={patient.patient?.person?.display ?? ''}
            patientUuid={patient.patient?.uuid}
          />
        ),
        gender: patient.patient?.person?.gender ?? '--',
        age: patient.patient?.person?.age ?? '--',
        bedNumber: patient.bed?.bedNumber ?? '--',
        daysAdmitted,
        billStatus: (
          <PatientBillStatus
            patientUuid={patient.patient?.uuid ?? ''}
            encounterUuid={encounterAssigningToCurrentInpatientLocation?.uuid ?? ''}
            visitUuid={visit?.uuid}
          />
        ),
      };
    });
  }, [results]);

  if (!patients.length) return <EmptyState message={t('noDischargeInpatients', 'No Discharge in patients')} />;

  return (
    <div className={styles.dataTableContainer}>
      <DataTable size="sm" rows={tableRows} headers={headers} isSortable useZebraStyles>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getTableProps,
          getCellProps,
          getTableContainerProps,
        }) => (
          <TableContainer
            title={t('dischargeInPatientsTitle', 'Patients pending discharge')}
            description={t(
              'dischargeInPatientsDescription',
              'Admitted patients marked for discharge. Settle bills to complete discharge.',
            )}
            {...getTableContainerProps()}>
            <Table {...getTableProps()} aria-label={t('dischargeIn', 'Discharge In')}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader
                      {...getHeaderProps({
                        header,
                      })}
                      key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                  <TableHeader />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const wardPatient = results.find((result) => result.patient.uuid === row.id);
                  const { encounterAssigningToCurrentInpatientLocation, visit } = wardPatient?.inpatientAdmission ?? {};
                  const daysAdmitted = encounterAssigningToCurrentInpatientLocation?.encounterDatetime
                    ? Math.max(
                        0,
                        dayjs()
                          .startOf('day')
                          .diff(
                            dayjs(encounterAssigningToCurrentInpatientLocation.encounterDatetime).startOf('day'),
                            'day',
                          ),
                      )
                    : '--';
                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell) => (
                        <TableCell {...getCellProps({ cell })} key={cell.id}>
                          {cell.value}
                        </TableCell>
                      ))}
                      <TableCell className="cds--table-column-menu">
                        {wardPatient && (
                          <OverflowMenu size={'sm'} flipped>
                            <CreateWardBillAction
                              patientUuid={wardPatient?.patient.uuid}
                              encounterUuid={encounterAssigningToCurrentInpatientLocation?.uuid ?? ''}
                              visitUuid={visit?.uuid}
                              onClick={() =>
                                launchWorkspace2('create-ward-bill-workspace', {
                                  patientUuid: wardPatient?.patient.uuid,
                                  daysAdmitted,
                                  visitUuid: visit?.uuid,
                                })
                              }
                            />
                            <OverflowMenuItem itemText={t('waivePatient', 'Waive Patient')} onClick={() => {}} />
                            <OverflowMenuItem
                              itemText={t('patientAbscondend', 'Patient Absconded')}
                              onClick={() => {}}
                            />
                            <UnAssignPatientBedAction
                              patientUuid={wardPatient.patient.uuid}
                              encounterUuid={encounterAssigningToCurrentInpatientLocation?.uuid ?? ''}
                              visitUuid={visit?.uuid}
                              loading={
                                wardPatientGroupDetails?.admissionLocationResponse?.isLoading ||
                                isLoadingEmrConfiguration
                              }
                              onClick={async () => {
                                await handleDischarge(
                                  {} as Encounter,
                                  wardPatient,
                                  emrConfiguration as Record<string, any>,
                                  wardPatient.visit,
                                  wardPatientGroupDetails?.admissionLocationResponse?.admissionLocation?.ward,
                                );
                              }}
                            />
                          </OverflowMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {paginated && !isLoading && (
              <Pagination
                page={currentPage}
                pageSize={pageSize}
                pageSizes={pageSizes}
                totalItems={(patients ?? []).length}
                onChange={({ page, pageSize }) => {
                  goTo(page);
                  setPageSize(pageSize);
                }}
              />
            )}
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

export default DischargeInPatients;
