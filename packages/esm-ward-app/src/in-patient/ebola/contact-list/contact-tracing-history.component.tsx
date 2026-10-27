import {
  Button,
  DataTable,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Edit } from '@carbon/react/icons';
import { launchWorkspace2, restBaseUrl, useConfig, usePagination } from '@openmrs/esm-framework';
import { EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import { PAGE_SIZE_OPTIONS, useContactTraceHistory } from './contact-tracing.resource';
import { type WardConfigObject } from '../../../config-schema';

type ContactTracingHistoryProps = {
  patientUuid: string;
};

const ContactTracingHistory: React.FC<ContactTracingHistoryProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { contactTracesHistory, error, isLoading } = useContactTraceHistory(patientUuid);
  const [pageSize, setPageSize] = useState(3);
  const { results, totalPages, currentPage, goTo } = usePagination(contactTracesHistory, pageSize);
  const { contactTracingFormUuid } = useConfig<WardConfigObject>();

  const handleLaunchContactTracingForm = useCallback(
    (encounterUuid: string) => {
      launchWorkspace2('kenyaemr-custom-form-entry-workspace', {
        workspaceTitle: t('contactTracingForm', 'Contact tracing form'),
        formUuid: contactTracingFormUuid,
        patientUuid,
        encounterUuid,
        mutateForm: () => {
          mutate(
            (key) => typeof key === 'string' && key.includes(`${restBaseUrl}/encounter`) && key.includes(patientUuid),
            undefined,
            { revalidate: true },
          );
        },
      });
    },
    [contactTracingFormUuid, patientUuid, t],
  );

  const headers = [
    {
      header: t('date', 'Date'),
      key: 'date',
    },
    {
      header: t('contactType', 'Contact Type'),
      key: 'contactType',
    },
    {
      header: t('status', 'Status'),
      key: 'status',
    },
    {
      header: t('reasonNotContacted', 'Reason Not Contacted'),
      key: 'reasonNotContacted',
    },
    {
      header: t('facilityLinkedTo', 'Facility Linked To'),
      key: 'facilityLinkedTo',
    },
    {
      header: t('remarks', 'Remarks'),
      key: 'remarks',
    },
    {
      header: t('actions', 'Actions'),
      key: 'actions',
    },
  ];

  const headerTitle = t('contactTraceHistory', 'Contact Trace History');
  const tableRows = useMemo(
    () =>
      results.map((row) => ({
        ...row,
        id: row.encounterUuid,
        actions: (
          <Button
            renderIcon={Edit}
            hasIconOnly
            kind="ghost"
            iconDescription={t('editTracing', 'Edit tracing')}
            onClick={() => handleLaunchContactTracingForm(row.encounterUuid)}
          />
        ),
      })),
    [handleLaunchContactTracingForm, results, t],
  );

  if (error) {
    return <ErrorState headerTitle={headerTitle} error={error} />;
  }
  if (contactTracesHistory.length === 0) {
    return <EmptyState headerTitle={headerTitle} displayText={t('traceHistory', 'trace history')} />;
  }

  return (
    <div>
      <DataTable
        rows={tableRows}
        headers={headers}
        size="sm"
        useZebraStyles
        render={({ rows, headers, getHeaderProps, getTableProps, getTableContainerProps }) => (
          <TableContainer title={headerTitle} {...getTableContainerProps()}>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
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
                  <TableRow key={row.id}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      />
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        pageSizes={PAGE_SIZE_OPTIONS}
        totalItems={contactTracesHistory.length}
        onChange={({ page, pageSize }) => {
          goTo(page);
          setPageSize(pageSize);
        }}
      />
    </div>
  );
};

export default ContactTracingHistory;
