import {
  Button,
  ComboButton,
  DataTable,
  DataTableSkeleton,
  Layer,
  MenuItem,
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
  Tile,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import {
  CardHeader,
  EditIcon,
  EmptyCardIllustration,
  ErrorState,
  formatDatetime,
  launchWorkspace2,
  parseDate,
  usePagination,
  usePaginationInfo,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { EmptyState, usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EncounterObservations from '../encounter-observations/encounter-observations.component';
import { type Encounter } from '../encounter-observations/visit.resource';
import { useVisitFormEncounters } from './form-encounters.resource';
import styles from './form-encounters-table.scss';

type FormEncountersTableProps = {
  patientUuid: string;
  forms: Array<{ uuid: string; label?: string }>;
  headerTitle: string;
  displayText: string;
};

const FormEncountersTable: React.FC<FormEncountersTableProps> = ({ patientUuid, forms, headerTitle, displayText }) => {
  const { t } = useTranslation();
  const session = useSession();
  const { visitContext, mutateVisitContext, patient } = usePatientChartStore(patientUuid);
  const { encounters, error, isLoading, mutate } = useVisitFormEncounters(
    visitContext?.uuid,
    forms.map((form) => form.uuid),
  );
  const [pageSize, setPageSize] = useState(10);
  const { results, totalPages, currentPage, goTo } = usePagination(encounters, pageSize);
  const { pageSizes } = usePaginationInfo(pageSize, totalPages, currentPage, results.length);

  const encountersByUuid = useMemo(
    () => new Map(encounters.map((encounter) => [encounter.uuid, encounter])),
    [encounters],
  );

  const handleLaunchForm = (formUuid: string, encounter?: Encounter) => {
    launchWorkspace2(
      'patient-form-entry-workspace',
      {
        form: { uuid: formUuid },
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

  const launchControl =
    forms.length === 1 ? (
      <Button onClick={() => handleLaunchForm(forms[0].uuid)} renderIcon={Add} kind="ghost" size="sm">
        {t('add', 'Add')}
      </Button>
    ) : forms.length > 1 ? (
      <ComboButton size="sm" label={t('add', 'Add')} menuAlignment="bottom-end">
        {forms.map((form) => (
          <MenuItem key={form.uuid} label={form.label ?? form.uuid} onClick={() => handleLaunchForm(form.uuid)} />
        ))}
      </ComboButton>
    ) : null;

  if (!encounters.length) {
    if (forms.length === 1) {
      return (
        <EmptyState
          headerTitle={headerTitle}
          displayText={displayText}
          launchForm={() => handleLaunchForm(forms[0].uuid)}
        />
      );
    }

    return (
      <Layer className={styles.container}>
        <CardHeader title={headerTitle}>{launchControl}</CardHeader>
        <Tile className={styles.emptyState}>
          <EmptyCardIllustration />
          <p>{t('emptyStateText', 'There are no {{displayText}} to display for this patient', { displayText })}</p>
        </Tile>
      </Layer>
    );
  }

  return (
    <Layer className={styles.container}>
      <CardHeader title={headerTitle}>{launchControl}</CardHeader>
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
                                onClick={() => handleLaunchForm(encounter.form?.uuid, encounter)}
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
                              onClick={() => handleLaunchForm(encounter.form?.uuid, encounter)}
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

export default FormEncountersTable;
