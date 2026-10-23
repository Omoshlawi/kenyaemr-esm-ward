import {
  Button,
  DataTable,
  DataTableSkeleton,
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
  ErrorState,
  launchWorkspace2,
  useConfig,
  usePagination,
  usePaginationInfo,
} from '@openmrs/esm-framework';
import { EmptyState, usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteRelationship, handleLaunchContactTracingForm, useRelationships } from './use-contact-mapping';
import { type WardConfigObject } from '../../../config-schema';
import ContactTracingHistory from './contact-tracing-history.component';

const ContactListing: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { mutateVisitContext, patient, visitContext } = usePatientChartStore(patientUuid);
  const { contacts, error, isLoading, headers } = useRelationships(patientUuid);
  const { contactTracingFormUuid } = useConfig<WardConfigObject>();
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(10);
  const { results, totalPages, currentPage, goTo } = usePagination(contacts, pageSize);
  const { pageSizes } = usePaginationInfo(pageSize, totalPages, currentPage, results.length);

  const tableRows = useMemo(
    () =>
      contacts.map((c) => ({
        id: c.uuid,
        ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ? v : '--'])),
        actions: (
          <OverflowMenu aria-label="overflow-menu" iconDescription={t('actions', 'Actions')} size="md">
            <OverflowMenuItem
              itemText={t('traceContact', 'Trace contact')}
              onClick={() => handleLaunchContactTracingForm(c.uuid, contactTracingFormUuid)}
            />
            <OverflowMenuItem
              itemText={t('delete', 'Delete')}
              onClick={() => deleteRelationship(c.relationShipUuid, t)}
            />
          </OverflowMenu>
        ),
      })),
    [contactTracingFormUuid, contacts, t],
  );
  const handleAddContact = () => {
    launchWorkspace2(
      'add-contact-form-workspace',
      { patientUuid },
      { patient, patientUuid, visitContext, mutateVisitContext },
    );
  };

  if (isLoading) {
    return <DataTableSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={t('contactListing', 'Contact Listing')} />;
  }

  if (!contacts.length) {
    return (
      <EmptyState
        headerTitle={t('contactListing', 'Contact Listing')}
        displayText={t('contacts', 'Contacts')}
        launchForm={handleAddContact}
      />
    );
  }

  return (
    <div>
      <CardHeader title={t('contactListing', 'Contact Listing')}>
        <Button onClick={handleAddContact} renderIcon={Add} kind="ghost">
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <DataTable rows={tableRows ?? []} headers={headers}>
        {({
          rows,
          headers,
          getHeaderProps,
          getTableProps,
          getTableContainerProps,
          getRowProps,
          getExpandedRowProps,
        }) => (
          <TableContainer {...getTableContainerProps()}>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  <TableExpandHeader aria-label="expand row" />
                  {headers.map((header) => (
                    <TableHeader
                      {...getHeaderProps({
                        header,
                        isSortable: true,
                      })}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableExpandRow
                      {...getRowProps({
                        row,
                      })}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableExpandRow>

                    <TableExpandedRow
                      colSpan={headers.length + 1}
                      className="demo-expanded-td"
                      {...getExpandedRowProps({
                        row,
                      })}>
                      <ContactTracingHistory patientUuid={results.find((r) => r.uuid === row.id)?.uuid} />
                    </TableExpandedRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        pageSizes={pageSizes}
        totalItems={contacts.length}
        onChange={({ page, pageSize }) => {
          goTo(page);
          setPageSize(pageSize);
        }}
      />
    </div>
  );
};

export default ContactListing;
