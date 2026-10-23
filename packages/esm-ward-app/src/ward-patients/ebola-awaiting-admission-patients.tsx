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
  showSnackbar,
  useAppContext,
  usePagination,
} from '@openmrs/esm-framework';
import { usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createIsolationAdmissionRequest,
  excludeAdmittedIsolationSuspects,
  useEbolaIsolationSuspects,
} from '../hooks/useEbolaIsolationSuspects';
import useWardLocation from '../hooks/useWardLocation';
import { type WardPatient, type WardViewContext } from '../types';
import { useWardPatientSearch } from '../ward-view/ward-view-ui.store';
import { getOpenmrsId } from '../ward-view/ward-view.resource';
import { HyperLinkPatientCell } from './patient-cells';
import { EmptyState, ErrorState } from './table-state-components';
import styles from './ward-patient.scss';

/**
 * Isolation Ward awaiting list: suspected Ebola cases from screening,
 * not patients who already went through the Admission Request Form.
 * Admit patient writes that same request (isolation pre-set) then opens bed assignment.
 */
const EbolaAwaitingAdmissionPatients = () => {
  const { t } = useTranslation();
  const search = useWardPatientSearch();
  const { suspects, isLoading, error, mutate } = useEbolaIsolationSuspects(true);
  const { location } = useWardLocation();
  const { wardPatientGroupDetails } = useAppContext<WardViewContext>('ward-view-context') ?? {};
  const [pageSize, setPageSize] = useState(5);
  const [admittingUuid, setAdmittingUuid] = useState<string | null>(null);

  const queuedSuspects = useMemo(
    () =>
      excludeAdmittedIsolationSuspects(
        suspects ?? [],
        wardPatientGroupDetails?.wardAdmittedPatientsWithBed?.keys(),
        wardPatientGroupDetails?.wardUnassignedPatientsList,
      ),
    [suspects, wardPatientGroupDetails],
  );

  const searchResults = useMemo(() => {
    return queuedSuspects.filter((row) => row?.patient?.person?.display?.toLowerCase().includes(search.toLowerCase()));
  }, [queuedSuspects, search]);
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

  const toWardPatient = (row: (typeof suspects)[number]): WardPatient => ({
    patient: row.patient,
    visit: row.visit,
    bed: null,
    inpatientAdmission: null,
    inpatientRequest: {
      ...row,
      dispositionType: 'ADMIT',
    } as WardPatient['inpatientRequest'],
  });

  const launchPatientTransferForm = (wardPatient: WardPatient) => {
    launchWorkspace2('patient-admit-or-transfer-request-form', {
      wardPatient,
    });
  };

  const admitPatient = async (row: (typeof suspects)[number]) => {
    const wardPatient = toWardPatient(row);
    setAdmittingUuid(row.patient.uuid);
    try {
      await createIsolationAdmissionRequest(row.patient.uuid, row.visit.uuid, location?.uuid);
      await mutate();
      launchWorkspace2('admit-patient-form-workspace', { wardPatient });
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('errorCreatingEncounter', 'Failed to admit patient'),
        subtitle:
          error instanceof Error
            ? error.message
            : t('isolationAdmissionRequestFailed', 'Could not create the isolation admission request'),
      });
    } finally {
      setAdmittingUuid(null);
    }
  };

  const tableRows = useMemo(() => {
    return results?.map((request, index) => {
      const admissionDate = request.dateQueued ? formatDatetime(parseDate(request.dateQueued)) : '--';
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
  if (!queuedSuspects.length) {
    return <EmptyState message={t('noPatientInAdmisionQueue', 'No patients in admission queue')} />;
  }

  return (
    <div className={styles.dataTableContainer}>
      <DataTable size="sm" rows={tableRows} headers={headers} isSortable useZebraStyles>
        {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getCellProps, getTableContainerProps }) => (
          <TableContainer
            title={t('awaitingAdmissionTitle', 'Patients awaiting admission')}
            description={t(
              'awaitingAdmissionDescription',
              'Patients with a pending request to be admitted to this ward.',
            )}
            {...getTableContainerProps()}>
            <Table {...getTableProps()} aria-label={t('awaitingAdmission', 'Awaiting Admission')}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                  <TableHead />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const suspect = results.find((result) => result.patient.uuid === row.id);
                  const wardPatient = suspect ? toWardPatient(suspect) : null;
                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell) => (
                        <TableCell {...getCellProps({ cell })} key={cell.id}>
                          {cell.value}
                        </TableCell>
                      ))}
                      <TableCell className="cds--table-column-menu">
                        <OverflowMenu size="sm" flipped>
                          {wardPatient && suspect && (
                            <>
                              <OverflowMenuItem
                                itemText={t('admitElsewhere', 'Admit elsewhere')}
                                onClick={() => launchPatientTransferForm(wardPatient)}
                              />
                              <OverflowMenuItem
                                itemText={t('admitPatient', 'Admit patient')}
                                disabled={admittingUuid === suspect.patient.uuid}
                                onClick={() => admitPatient(suspect)}
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
                totalItems={queuedSuspects.length}
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

export default EbolaAwaitingAdmissionPatients;
