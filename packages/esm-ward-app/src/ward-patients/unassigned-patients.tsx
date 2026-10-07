import {
  DataTable,
  DataTableSkeleton,
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
  formatDatetime,
  launchWorkspace2,
  parseDate,
  useAppContext,
  useConfig,
  usePagination,
} from '@openmrs/esm-framework';
import { usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { useWardPatientSearch } from '../ward-view/ward-view-ui.store';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../config-schema';
import { type WardPatient, type WardViewContext } from '../types';
import { getOpenmrsId } from '../ward-view/ward-view.resource';
import { HyperLinkPatientCell } from './patient-cells';
import { EmptyState } from './table-state-components';

import styles from './unassigned-patient.scss';

/**
 * Renders a table of patients that are admitted to the current ward but
 * have not been assigned to any bed.
 */
const UnassignedPatients = () => {
  const search = useWardPatientSearch();
  const { wardPatientGroupDetails } = useAppContext<WardViewContext>('ward-view-context') ?? {};
  const { wardUnassignedPatientsList, isLoading } = wardPatientGroupDetails ?? {};
  const { t } = useTranslation();
  const config = useConfig<WardConfigObject>();

  const headers = [
    { key: 'admissionDate', header: t('admissionDate', 'Admission Date') },
    { key: 'idNumber', header: t('idNumber', 'ID Number') },
    { key: 'name', header: t('name', 'Name') },
    { key: 'gender', header: t('gender', 'Gender') },
    { key: 'age', header: t('age', 'Age') },
    { key: 'daysAdmitted', header: t('daysInWard', 'Days In Ward') },
  ];

  const patients = useMemo(() => {
    return (
      wardUnassignedPatientsList?.map((inpatientAdmission): WardPatient => ({
        patient: inpatientAdmission.patient,
        visit: inpatientAdmission.visit,
        bed: null,
        inpatientAdmission,
        inpatientRequest: inpatientAdmission.currentInpatientRequest ?? null,
      })) ?? []
    );
  }, [wardUnassignedPatientsList]);

  const [pageSize, setPageSize] = useState(5);
  const searchResults = useMemo(() => {
    return patients?.filter((pat) => pat?.patient?.person?.display?.toLowerCase().includes(search.toLowerCase()));
  }, [patients, search]);
  const { paginated, results, totalPages, currentPage, goTo } = usePagination(searchResults, pageSize);
  const { pageSizes } = usePaginationInfo(pageSize, totalPages, currentPage, results.length);

  const tableRows = useMemo(() => {
    return results.map((patient, index) => {
      const { encounterAssigningToCurrentInpatientLocation } = patient.inpatientAdmission ?? {};
      const encounterDate = encounterAssigningToCurrentInpatientLocation?.encounterDatetime;
      const admissionDate = encounterDate ? formatDatetime(parseDate(encounterDate)) : '--';
      const daysAdmitted =
        encounterDate && dayjs(encounterDate).isValid()
          ? Math.abs(dayjs().startOf('day').diff(dayjs(encounterDate).startOf('day'), 'days'))
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
        daysAdmitted,
      };
    });
  }, [results]);

  if (isLoading) return <DataTableSkeleton />;
  if (!patients.length)
    return (
      <EmptyState
        message={t('noUnassignedPatientsInCurrentWard', 'No patients admitted without a bed in the current ward')}
      />
    );

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
            title={t('unassignedPatientsTitle', 'Admitted patients awaiting bed assignment')}
            description={t(
              'unassignedPatientsDescription',
              'Admitted patients without a bed. Assign one to complete admission.',
            )}
            {...getTableContainerProps()}>
            <Table {...getTableProps()} aria-label={t('unassignedPatients', 'Unassigned patients')}>
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
                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell) => (
                        <TableCell {...getCellProps({ cell })} key={cell.id}>
                          {cell.value}
                        </TableCell>
                      ))}
                      <TableCell className="cds--table-column-menu">
                        <OverflowMenu size="sm" flipped>
                          <OverflowMenuItem
                            itemText={t('assignBed', 'Assign bed')}
                            onClick={() =>
                              launchWorkspace2('patient-bed-swap-form', {
                                workspaceTitle: t('assignBed', 'Assign bed'),
                                wardPatient: wardPatient,
                                withContentSwitcher: false,
                                defaultTransfersection: 'bed-swap',
                              })
                            }
                          />
                          <OverflowMenuItem
                            itemText={t('interWardTransfer', 'Interward Trasfer')}
                            onClick={() =>
                              launchWorkspace2('patient-admit-or-transfer-request-form', {
                                workspaceTitle: 'Trasfer',
                                wardPatient: wardPatient,
                                withContentSwitcher: false,
                                defaultTransfersection: 'transfer',
                              })
                            }
                          />
                          <OverflowMenuItem
                            itemText={t('discharge', 'Discharge')}
                            onClick={() => {
                              launchWorkspace2('patient-discharge-workspace', {
                                wardPatient: wardPatient,
                                patientUuid: wardPatient?.patient?.uuid,
                                formUuid: config.inpatientDischargeFormUuid,
                                dischargePatientOnSuccesfullSubmission: false,
                              });
                            }}
                          />
                        </OverflowMenu>
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

export default UnassignedPatients;
