import {
  DataTable,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  formatDatetime,
  isDesktop,
  useConfig,
  useLayoutType,
  ErrorCard,
  CardHeader,
  EmptyCard,
  launchWorkspace2,
  type Encounter,
  parseDate,
} from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { WardConfigObject } from '../config-schema';
import useCurrentPatientAdmissionEncounter from '../hooks/useCurrentPatientAdmissionEncounter';
import { usePatientChartStore } from '@openmrs/esm-patient-common-lib/src';
import { useAdmissionRequest } from './in-patient.resource';

type AdmissionRequestProps = {
  patientUuid: string;
};
// t('admissionRequests', 'Admission Requests') - Required for tab title translation
const AdmissionRequest: React.FC<AdmissionRequestProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const { patient, visitContext, mutateVisitContext } = usePatientChartStore(patientUuid);
  const controlSize = isDesktop(layout) ? 'sm' : 'md';
  const { admissionRequestFormUuid } = useConfig<WardConfigObject>();
  const { admissionRequest, isLoading, error, mutate } = useAdmissionRequest(patientUuid);
  const { isPatientAdmitted } = useCurrentPatientAdmissionEncounter(patientUuid);

  const rows = useMemo(() => {
    return admissionRequest.map((admissionRequest) => ({
      id: admissionRequest.patient.uuid,
      admissionLocation: admissionRequest.dispositionLocation?.display,
      admissionType: admissionRequest.dispositionType,
      disposition: admissionRequest.disposition.display,
      requestDatetime: admissionRequest?.dispositionEncounter?.encounterDatetime
        ? formatDatetime(parseDate(admissionRequest.dispositionEncounter.encounterDatetime), {
            mode: 'standard',
          })
        : '--',
    }));
  }, [admissionRequest]);

  const headers = useMemo(() => {
    return [
      { key: 'requestDatetime', header: t('requestDatetime', 'Request Datetime') },
      { key: 'admissionLocation', header: t('admissionLocation', 'Admission Location') },
      { key: 'admissionType', header: t('admissionType', 'Admission Type') },
      { key: 'disposition', header: t('disposition', 'Disposition') },
    ];
  }, [t]);

  const handleLaunchAdmissionRequestForm = () => {
    launchWorkspace2(
      'ward-form-entry-workspace',
      {
        form: { uuid: admissionRequestFormUuid },
        encounterUuid: '',
        handlePostResponse: (encounter: Encounter) => {
          mutate();
        },
      },
      {
        patient,
        patientUuid,
        visitContext,
        mutateVisitContext,
      },
    );
  };

  if (isLoading) {
    return <DataTableSkeleton />;
  }

  if (error) {
    return <ErrorCard error={error} headerTitle={t('admissionRequest', 'Admission Request')} />;
  }

  if (admissionRequest.length === 0) {
    return (
      <EmptyCard
        displayText={t('admissionRequests', 'admission requests')}
        headerTitle={t('admissionRequest', 'Admission Request')}
        launchForm={isPatientAdmitted ? undefined : handleLaunchAdmissionRequestForm}
      />
    );
  }

  return (
    <div>
      <CardHeader title={t('admissionRequest', 'Admission Request')}>
        <></>
      </CardHeader>
      <DataTable size={controlSize} rows={rows} headers={headers}>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps, getCellProps }) => (
          <Table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow {...getRowProps({ row })}>
                  {row.cells.map((cell) => (
                    <TableCell {...getCellProps({ cell })}>{cell.value}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </div>
  );
};

export default AdmissionRequest;
