import {
  Button,
  DataTable,
  DataTableSkeleton,
  Layer,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import {
  CardHeader,
  EditIcon,
  ErrorState,
  formatDatetime,
  launchWorkspace2,
  parseDate,
  useConfig,
  usePagination,
  usePaginationInfo,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { EmptyState, usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../../../config-schema';
import EncounterObservations from '../../encounter-observations/encounter-observations.component';
import { type Encounter } from '../../encounter-observations/visit.resource';
import { useVisitFormEncounters } from './case-identification-finding.resource';
import styles from './case-identification-finding.scss';

const CaseIdentificationFinding: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const { visitContext, mutateVisitContext, patient } = usePatientChartStore(patientUuid);
  const { cifFormUuid } = useConfig<WardConfigObject>();
  const { encounters, error, isLoading, mutate } = useVisitFormEncounters(visitContext?.uuid, cifFormUuid);
  const [pageSize, setPageSize] = useState(10);
  const { results, totalPages, currentPage, goTo } = usePagination(encounters, pageSize);
  const { pageSizes } = usePaginationInfo(pageSize, totalPages, currentPage, results.length);
  const headerTitle = t('caseIdentificationFinding', 'Case Identification Finding');

  const encountersByUuid = useMemo(
    () => new Map(encounters.map((encounter) => [encounter.uuid, encounter])),
    [encounters],
  );

  const handleLaunchForm = (encounter?: Encounter) => {
    launchWorkspace2(
      'patient-form-entry-workspace',
      {
        form: { uuid: cifFormUuid },
        encounterUuid: encounter?.uuid ?? '',
      },
      {},
      {
        patient,
        patientUuid,
        visitContext,
        mutateVisitContext: () => {
          mutateVisitContext?.();
          mutate();
        },
      },
    );
  };

  const canEditEncounter = (encounter: Encounter) => {
    const editPrivilege = encounter.encounterType?.editPrivilege?.display;
    return !editPrivilege || (!!session?.user && userHasAccess(editPrivilege, session.user));
  };

  const headers = [
    { key: 'datetime', header: t('dateAndTime', 'Date & time') },
    { key: 'encounterType', header: t('encounterType', 'Encounter type') },
    { key: 'formName', header: t('formName', 'Form name') },
    { key: 'provider', header: t('provider', 'Provider') },
  ];

  const tableRows = useMemo(
    () =>
      results.map((encounter) => ({
        id: encounter.uuid,
        datetime: encounter.encounterDatetime ? formatDatetime(parseDate(encounter.encounterDatetime)) : '--',
        encounterType: encounter.encounterType?.display ?? '--',
        formName: encounter.form?.display ?? encounter.form?.name ?? '--',
        provider: encounter.encounterProviders?.[0]?.provider?.person?.display ?? '--',
      })),
    [results],
  );

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (!encounters.length) {
    return <EmptyState headerTitle={headerTitle} displayText={t('cif', 'CIF')} launchForm={() => handleLaunchForm()} />;
  }

  return (
    <Layer className={styles.container}>
      <CardHeader title={headerTitle}>
        <Button onClick={() => handleLaunchForm()} renderIcon={Add} kind="ghost" size="sm">
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <DataTable rows={tableRows} headers={headers} size="sm" useZebraStyles={encounters.length > 1}>
        {({ rows, headers: tableHeaders, getHeaderProps, getTableProps, getRowProps, getExpandHeaderProps }) => (
          <TableContainer className={styles.tableContainer}>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  <TableExpandHeader enableToggle {...getExpandHeaderProps()} />
                  {tableHeaders.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                  <TableHeader aria-label={t('actions', 'Actions')} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const encounter = encountersByUuid.get(row.id);
                  if (!encounter) {
                    return null;
                  }
                  const editable = canEditEncounter(encounter);

                  return (
                    <React.Fragment key={row.id}>
                      <TableExpandRow {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                        <TableCell className="cds--table-column-menu">
                          {editable && (
                            <OverflowMenu
                              aria-label={t('encounterTableActionsMenu', 'Encounter table actions menu')}
                              iconDescription={t('encounterTableActionsMenu', 'Encounter table actions menu')}
                              flipped
                              size="sm">
                              <OverflowMenuItem
                                className={styles.menuItem}
                                itemText={t('editThisEncounter', 'Edit this encounter')}
                                onClick={() => handleLaunchForm(encounter)}
                              />
                            </OverflowMenu>
                          )}
                        </TableCell>
                      </TableExpandRow>
                      {row.isExpanded ? (
                        <TableExpandedRow className={styles.expandedRow} colSpan={tableHeaders.length + 2}>
                          <EncounterObservations observations={encounter.obs ?? []} />
                          {editable && (
                            <Button
                              kind="ghost"
                              onClick={() => handleLaunchForm(encounter)}
                              renderIcon={(props: ComponentProps<typeof EditIcon>) => (
                                <EditIcon size={16} {...props} />
                              )}>
                              {t('editThisEncounter', 'Edit this encounter')}
                            </Button>
                          )}
                        </TableExpandedRow>
                      ) : (
                        <TableExpandedRow className={styles.hiddenRow} colSpan={tableHeaders.length + 2} />
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      {encounters.length > pageSize && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          pageSizes={pageSizes}
          totalItems={encounters.length}
          onChange={({ page, pageSize: nextPageSize }) => {
            goTo(page);
            setPageSize(nextPageSize);
          }}
        />
      )}
    </Layer>
  );
};

export default CaseIdentificationFinding;
