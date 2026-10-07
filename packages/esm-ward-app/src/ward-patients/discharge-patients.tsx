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
import { formatDatetime, parseDate, showModal } from '@openmrs/esm-framework';
import React, { useMemo, useState } from 'react';
import { useWardPatientSearch } from '../ward-view/ward-view-ui.store';
import { useTranslation } from 'react-i18next';
import { useIpdDischargeEncounter } from '../hooks/useIpdDischargeEncounter';
import {
  HyperLinkPatientCell,
  PatientAdmissionDateCell,
  PatientAgeCell,
  PatientDayInWardCell,
  PatientGenderCell,
} from './patient-cells';
import { EmptyState, ErrorState } from './table-state-components';
import styles from './ward-patient.scss';

const DischargePatients = () => {
  const { t } = useTranslation();
  const search = useWardPatientSearch();

  const {
    encounters,
    error,
    isLoading,
    paginated,
    currentPage,
    pageSizes,
    goTo,
    currPageSize,
    setCurrPageSize,
    totalCount,
  } = useIpdDischargeEncounter();

  const headers = [
    { key: 'admissionDate', header: t('admissionDate', 'Admission Date') },
    { key: 'dischargeDate', header: t('dischargeDate', 'Discharge Date') },
    { key: 'idNumber', header: t('idNumber', 'ID Number') },
    { key: 'name', header: t('name', 'Name') },
    { key: 'gender', header: t('gender', 'Gender') },
    { key: 'age', header: t('age', 'Age') },
    { key: 'bedNumber', header: t('bedNumber', 'Bed Number') },
    { key: 'daysAdmitted', header: t('durationOnWard', 'Duration on Ward') },
  ];

  const tableRows = useMemo(() => {
    return encounters
      ?.filter((encounter) => encounter.patient.name.toLowerCase().includes(search.toLowerCase()))
      ?.map((encounter) => {
        return {
          id: encounter.uuid,
          dischargeDate: encounter.encounterDateTime ? formatDatetime(parseDate(encounter.encounterDateTime)) : '--',
          admissionDate: (
            <PatientAdmissionDateCell patientUuid={encounter.patient.uuid} encounterUuid={encounter.uuid} />
          ),
          idNumber: encounter.patient.openmrsId,
          name: <HyperLinkPatientCell patientName={encounter.patient.name} patientUuid={encounter.patient.uuid} />,
          gender: <PatientGenderCell patientUuid={encounter.patient.uuid} />,
          age: <PatientAgeCell patientUuid={encounter.patient.uuid} />,
          bedNumber: '--',
          daysAdmitted: <PatientDayInWardCell patientUuid={encounter.patient.uuid} encounterUuid={encounter.uuid} />,
        };
      });
  }, [encounters, search]);

  if (isLoading) return <DataTableSkeleton />;
  if (error) return <ErrorState error={error} />;
  if (!encounters?.length) return <EmptyState message={t('noDischargedPatients', 'No Discharged patients')} />;

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
            title={t('dischargedPatientsTitle', 'Discharged patients')}
            description={t('dischargedPatientsDescription', 'Patients discharged from this ward.')}
            {...getTableContainerProps()}>
            <Table {...getTableProps()} aria-label={t('discharged', 'Discharged')}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                  <TableHeader />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const encounter = encounters.find((encounter) => encounter.uuid === row.id);
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
                            itemText={t('dischargeSummary', 'Discharge Summary')}
                            onClick={() => {
                              const dispose = showModal('patient-discharge-document-preview-modal', {
                                size: 'lg',
                                onClose: () => dispose(),
                                documentName: 'dischargeSummary',
                                visitUuid: encounter?.visitUuid,
                                patientName: encounter?.patient?.name,
                              });
                            }}
                          />
                          <OverflowMenuItem
                            itemText={t('postOperationNotes', 'Post Operation Notes')}
                            onClick={() => {
                              const dispose = showModal('patient-discharge-document-preview-modal', {
                                size: 'lg',
                                onClose: () => dispose(),
                                documentName: 'postOperationNotes',
                                visitUuid: encounter?.visitUuid,
                                patientName: encounter?.patient?.name,
                              });
                            }}
                          />
                          <OverflowMenuItem
                            itemText={t('gatePass', 'Gate Pass')}
                            onClick={() => {
                              const dispose = showModal('patient-discharge-document-preview-modal', {
                                size: 'lg',
                                onClose: () => dispose(),
                                documentName: 'gatePass',
                                visitUuid: encounter?.visitUuid,
                                patientName: encounter?.patient?.name,
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
                forwardText=""
                backwardText=""
                page={currentPage}
                pageSize={currPageSize}
                pageSizes={pageSizes}
                totalItems={totalCount}
                size="sm"
                onChange={({ page: newPage, pageSize }) => {
                  if (newPage !== currentPage) {
                    goTo(newPage);
                  }
                  setCurrPageSize(pageSize);
                }}
              />
            )}
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

export default DischargePatients;
