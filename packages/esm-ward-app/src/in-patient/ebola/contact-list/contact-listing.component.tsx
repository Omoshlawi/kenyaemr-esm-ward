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
  ErrorState,
  launchWorkspace2,
  useConfig,
  usePagination,
  usePaginationInfo,
} from '@openmrs/esm-framework';
import { EmptyState, usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type WardConfigObject } from '../../../config-schema';
import useCurrentPatientAdmissionEncounter from '../../../hooks/useCurrentPatientAdmissionEncounter';
import { useIsIsolationAdmission } from '../../../hooks/useIsIsolationWard';
import ContactTracingHistory from './contact-tracing-history.component';
import styles from './contact-listing.scss';
import { deleteRelationship, handleLaunchContactTracingForm, useRelationships } from './use-contact-mapping';

const ContactListing: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { mutateVisitContext, patient, visitContext } = usePatientChartStore(patientUuid);
  const { contacts, error, isLoading, headers, mutate: mutateRelationships } = useRelationships(patientUuid);
  const { contactTracingFormUuid } = useConfig<WardConfigObject>();
  const { t } = useTranslation();
  const { admissionEncounter, isLoading: isLoadingAdmission } = useCurrentPatientAdmissionEncounter(patientUuid);
  const {
    isIsolationAdmission,
    hasAdmissionLocation,
    isLoading: isLoadingIsolation,
  } = useIsIsolationAdmission(admissionEncounter?.location?.uuid);
  const [pageSize, setPageSize] = useState(10);
  const { results, totalPages, currentPage, goTo } = usePagination(contacts, pageSize);
  const { pageSizes } = usePaginationInfo(pageSize, totalPages, currentPage, results.length);

  const tableRows = useMemo(
    () =>
      results.map((contact) => ({
        id: contact.uuid,
        ...Object.fromEntries(Object.entries(contact).map(([key, value]) => [key, value ? value : '--'])),
        actions: (
          <OverflowMenu
            flipped
            size="sm"
            aria-label={t('actions', 'Actions')}
            iconDescription={t('actions', 'Actions')}>
            <OverflowMenuItem
              itemText={t('traceContact', 'Trace contact')}
              onClick={() => handleLaunchContactTracingForm(contact.uuid, contactTracingFormUuid)}
            />
            <OverflowMenuItem
              hasDivider
              isDelete
              itemText={t('delete', 'Delete')}
              onClick={() => deleteRelationship(contact.relationShipUuid, t)}
            />
          </OverflowMenu>
        ),
      })),
    [contactTracingFormUuid, results, t],
  );

  const handleAddContact = () => {
    launchWorkspace2(
      'add-contact-form-workspace',
      { patientUuid, onContactAdded: () => void mutateRelationships?.() },
      { patient, patientUuid, visitContext, mutateVisitContext },
    );
  };

  if (isLoading || isLoadingAdmission || isLoadingIsolation) {
    return <DataTableSkeleton />;
  }

  if (hasAdmissionLocation && !isIsolationAdmission) {
    return null;
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
    <Layer className={styles.container}>
      <CardHeader title={t('contactListing', 'Contact Listing')}>
        <Button onClick={handleAddContact} renderIcon={Add} kind="ghost" size="sm">
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <DataTable rows={tableRows} headers={headers} size="sm" useZebraStyles>
        {({
          rows,
          headers: tableHeaders,
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
                  <TableExpandHeader aria-label={t('expandRow', 'Expand row')} />
                  {tableHeaders.map((header) => (
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
                    <TableExpandRow {...getRowProps({ row })}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableExpandRow>
                    <TableExpandedRow
                      colSpan={tableHeaders.length + 1}
                      className={styles.expandedRow}
                      {...getExpandedRowProps({ row })}>
                      <ContactTracingHistory patientUuid={results.find((item) => item.uuid === row.id)?.uuid ?? ''} />
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
        onChange={({ page, pageSize: nextPageSize }) => {
          goTo(page);
          setPageSize(nextPageSize);
        }}
      />
    </Layer>
  );
};

export default ContactListing;
