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
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
} from '@carbon/react';
import { formatDatetime, launchWorkspace2, parseDate, useAppContext, usePagination } from '@openmrs/esm-framework';
import { usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type WardPatient, type WardViewContext } from '../types';
import { getOpenmrsId } from '../ward-view/ward-view.resource';
import AdmitPatientButton from '../ward-workspace/admit-patient-button.component';
import { HyperLinkPatientCell } from './patient-cells';
import { EmptyState, ErrorState } from './table-state-components';
import styles from './ward-patient.scss';

const AwaitingAdmissionPatients = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { wardPatientGroupDetails } = useAppContext<WardViewContext>('ward-view-context') ?? {};
  const { inpatientRequests, isLoading, error } = wardPatientGroupDetails?.inpatientRequestResponse ?? {};
  const [pageSize, setPageSize] = useState(5);
  const searchResults = useMemo(() => {
    return inpatientRequests?.filter((req) =>
      req?.patient?.person?.display.toLowerCase().includes(search.toLowerCase()),
    );
  }, [inpatientRequests, search]);
  const { paginated, results, totalPages, currentPage, goTo } = usePagination(searchResults, pageSize);
  const { pageSizes } = usePaginationInfo(pageSize, totalPages, currentPage, results.length);

  const headers = [
    { key: 'admissionDate', header: t('dateQueued', 'Date Queued') },
    { key: 'idNumber', header: t('idNumber', 'ID Number') },
    { key: 'name', header: t('name', 'Name') },
    { key: 'gender', header: t('gender', 'Gender') },
    { key: 'age', header: t('age', 'Age') },
    { key: 'bedNumber', header: t('bedNumber', 'Bed Number') },
  ];

  const launchPatientTransferForm = (wardPatient: WardPatient) => {
    launchWorkspace2('patient-admit-or-transfer-request-form', {
      wardPatient,
    });
  };

  const launchCancelAdmissionForm = (wardPatient: WardPatient) => {
    launchWorkspace2('cancel-admission-request-workspace', {
      wardPatient,
    });
  };
  const tableRows = useMemo(() => {
    return results?.map((request, index) => {
      const admissionDate = request.dispositionEncounter?.encounterDatetime
        ? formatDatetime(parseDate(request.dispositionEncounter?.encounterDatetime))
        : '--';
      const wardPatient = {
        patient: request.patient,
        visit: request.visit,
        bed: null,
        inpatientRequest: request,
        inpatientAdmission: null,
      };
      const isTransfer = wardPatient.inpatientRequest.dispositionType == 'TRANSFER';

      return {
        id: request?.patient?.uuid ?? index.toString(),
        admissionDate,
        idNumber: getOpenmrsId(request.patient?.identifiers ?? []) ?? '--',
        name: (
          <HyperLinkPatientCell patientName={request.patient?.person?.display} patientUuid={request.patient?.uuid} />
        ),
        gender: request?.patient?.person?.gender ?? '--',
        age: request?.patient?.person?.age ?? '--',
        bedNumber: '--',
      };
    });
  }, [results]);

  if (isLoading) return <DataTableSkeleton />;
  if (error) return <ErrorState error={error} />;
  if (!inpatientRequests || !inpatientRequests.length)
    return <EmptyState message={t('noPatientInAdmisionQueue', 'No patients in admission queue')} />;
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
          getToolbarProps,
          getTableContainerProps,
        }) => (
          <TableContainer
            title={t('awaitingAdmissionTitle', 'Patients awaiting admission')}
            description={t(
              'awaitingAdmissionDescription',
              'Patients with a pending request to be admitted to this ward.',
            )}
            {...getTableContainerProps()}>
            <TableToolbar {...getToolbarProps()}>
              <TableToolbarContent>
                <TableToolbarSearch
                  persistent
                  value={search}
                  placeholder={t('searchPatients', 'Search patients')}
                  onChange={(event, value) =>
                    setSearch(typeof event === 'object' && event?.target ? event.target.value : (value ?? ''))
                  }
                />
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()} aria-label={t('awaitingAdmission', 'Awaiting Admission')}>
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
                  <TableHead />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const wardPatientInfo = results.find((result) => result.patient.uuid === row.id);
                  const wardPatient = {
                    patient: wardPatientInfo?.patient,
                    visit: wardPatientInfo?.visit,
                    bed: null,
                    inpatientRequest: wardPatientInfo,
                    inpatientAdmission: null,
                  };
                  const isTransfer = wardPatient?.inpatientRequest?.dispositionType == 'TRANSFER';
                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell) => (
                        <TableCell {...getCellProps({ cell })} key={cell.id}>
                          {cell.value}
                        </TableCell>
                      ))}
                      <TableCell className="cds--table-column-menu">
                        <OverflowMenu size={'sm'} flipped>
                          {wardPatient?.inpatientRequest && (
                            <>
                              <OverflowMenuItem
                                itemText={
                                  isTransfer
                                    ? t('transferElsewhere', 'Transfer elsewhere')
                                    : t('admitElsewhere', 'Admit elsewhere')
                                }
                                onClick={() => launchPatientTransferForm(wardPatient as WardPatient)}
                              />
                              <AdmitPatientButton
                                wardPatient={wardPatient as WardPatient}
                                dispositionType={wardPatient.inpatientRequest.dispositionType}
                                onAdmitPatientSuccess={() => {}}
                                component="menu"
                              />
                              <OverflowMenuItem
                                itemText={t('cancel', 'Cancel')}
                                onClick={() => launchCancelAdmissionForm(wardPatient as WardPatient)}
                              />
                            </>
                          )}
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
                totalItems={(inpatientRequests ?? []).length}
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

export default AwaitingAdmissionPatients;
