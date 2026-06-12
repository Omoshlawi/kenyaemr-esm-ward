import {
  Button,
  InlineLoading,
  InlineNotification,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { launchWorkspace2, usePagination } from '@openmrs/esm-framework';
import { usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type NursingCardexPlanWorkspaceProps } from './nursing-cardex-plan.workspace';
import { type CardexRow, useNursingTreatmentSheet } from './nursing-treatment-sheet.resource';
import styles from './treatment-chart-dashboard.scss';

type TreatmentChartDashboardProps = {
  patientUuid: string;
  patient: Record<string, unknown>;
};

type ExportColumn = {
  header: string;
  value: (row: CardexRow) => string;
};

const emptyValue = '--';

const escapeCsvValue = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const escapeHtml = (value: string) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getExportFilename = (title: string, extension: string) => {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${normalizedTitle || 'treatment-sheet'}-${dateStamp}.${extension}`;
};

const downloadCsv = (title: string, exportDateLabel: string, columns: ExportColumn[], rows: CardexRow[]) => {
  const csvContent = [
    escapeCsvValue(title),
    escapeCsvValue(exportDateLabel),
    '',
    columns.map((column) => escapeCsvValue(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(column.value(row) || emptyValue)).join(',')),
  ].join('\n');
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = getExportFilename(title, 'csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
};

const printTable = (title: string, exportDateLabel: string, columns: ExportColumn[], rows: CardexRow[]) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return;
  }

  const headerCells = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('');
  const bodyRows = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${columns.map((column) => `<td>${escapeHtml(column.value(row) || emptyValue)}</td>`).join('')}</tr>`,
        )
        .join('')
    : `<tr><td colspan="${columns.length}">${emptyValue}</td></tr>`;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #161616; }
          h1 { font-size: 18px; margin: 0 0 8px; }
          .export-date { margin: 0 0 16px; font-size: 12px; color: #525252; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #dcdcdc; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f4f4f4; font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p class="export-date">${escapeHtml(exportDateLabel)}</p>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

// Note: Needed for translation. Do not remove
// t('treatmentChart', 'Treatment sheet')
const TreatmentChartDashboard: React.FC<TreatmentChartDashboardProps> = ({ patientUuid, patient }) => {
  const { t } = useTranslation();
  const [medicationPageSize, setMedicationPageSize] = useState(5);
  const [fluidPageSize, setFluidPageSize] = useState(5);

  const {
    medicationRows: allMedicationRows,
    fluidAndNutritionRows: allFluidRows,
    isLoading,
    error,
  } = useNursingTreatmentSheet(patientUuid);

  const medicationRows = allMedicationRows;
  const fluidRows = allFluidRows;

  const {
    results: paginatedMedicationRows,
    currentPage: medicationPage,
    goTo: goToMedicationPage,
  } = usePagination(medicationRows, medicationPageSize);
  const {
    results: paginatedFluidRows,
    currentPage: fluidPage,
    goTo: goToFluidPage,
  } = usePagination(fluidRows, fluidPageSize);
  const { pageSizes: medicationPageSizes } = usePaginationInfo(
    medicationPageSize,
    medicationRows.length,
    medicationPage,
    paginatedMedicationRows.length,
  );
  const { pageSizes: fluidPageSizes } = usePaginationInfo(
    fluidPageSize,
    fluidRows.length,
    fluidPage,
    paginatedFluidRows.length,
  );

  const medicationTitle = t('medicationAdministered', 'Medication Administered');
  const fluidTitle = t('fluidsAndParenteralNutritionSection', 'Fluids and Parenteral Nutrition Section');
  const exportDateLabel = `${t('date', 'Date')}: ${new Date().toLocaleString()}`;

  const medicationExportColumns = useMemo<ExportColumn[]>(
    () => [
      { header: t('name', 'Name'), value: (row) => row.name },
      { header: t('dose', 'Dose'), value: (row) => row.dose },
      { header: t('route', 'Route'), value: (row) => row.route },
      { header: t('frequencies', 'Frequencies'), value: (row) => row.frequency },
      { header: t('timeTaken', 'Time taken'), value: (row) => row.time },
      { header: t('dateGiven', 'Date Given'), value: (row) => row.date },
      { header: t('provider', 'Provider'), value: (row) => row.provider },
      { header: t('notes', 'Notes'), value: (row) => row.notes },
    ],
    [t],
  );
  const fluidExportColumns = useMemo<ExportColumn[]>(
    () => [
      { header: t('fluidName', 'Fluid name'), value: (row) => row.name },
      { header: t('volume', 'Volume'), value: (row) => row.volume },
      { header: t('frequency', 'Frequency'), value: (row) => row.frequency },
      { header: t('duration', 'Duration'), value: (row) => row.duration },
      { header: t('timeGiven', 'Time Given'), value: (row) => row.time },
      { header: t('dateGiven', 'Date Given'), value: (row) => row.date },
      { header: t('provider', 'Provider'), value: (row) => row.provider },
      { header: t('notes', 'Notes'), value: (row) => row.notes },
    ],
    [t],
  );

  const renderExportDropdown = useCallback(
    (title: string, columns: ExportColumn[], rows: CardexRow[]) => (
      <select
        className={styles.downloadSelect}
        aria-label={t('download', 'Download')}
        value=""
        onChange={(event) => {
          const selectedFormat = event.target.value;
          if (selectedFormat === 'csv') {
            downloadCsv(title, exportDateLabel, columns, rows);
          }
          if (selectedFormat === 'pdf') {
            printTable(title, exportDateLabel, columns, rows);
          }
        }}>
        <option value="" disabled>
          {t('download', 'Download')}
        </option>
        <option value="csv">{t('csv', 'CSV')}</option>
        <option value="pdf">{t('pdf', 'PDF')}</option>
      </select>
    ),
    [exportDateLabel, t],
  );

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Loading...')} />;
  }

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('failedToLoadNursingTreatmentSheet', 'Failed to load nursing treatment sheet')}
      />
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('nursingTreatmentSheet', 'Nursing Treatment Sheet')}</h3>
        <div className={styles.headerActions}>
          <Button
            kind="primary"
            size="sm"
            onClick={() =>
              launchWorkspace2<NursingCardexPlanWorkspaceProps, object, object>(
                'nursing-cardex-plan-workspace',
                { patientUuid, patient },
                {},
                { patient, patientUuid },
              )
            }>
            {t('add', 'Add')}
          </Button>
        </div>
      </div>
      <div className={styles.tableSectionHeader}>
        <h4>{medicationTitle}</h4>
      </div>
      <TableContainer>
        <Table size="sm" useZebraStyles>
          <TableHead>
            <TableRow>
              <TableHeader>{t('name', 'Name')}</TableHeader>
              <TableHeader>{t('dose', 'Dose')}</TableHeader>
              <TableHeader>{t('route', 'Route')}</TableHeader>
              <TableHeader>{t('frequencies', 'Frequencies')}</TableHeader>
              <TableHeader>{t('timeTaken', 'Time taken')}</TableHeader>
              <TableHeader>{t('dateGiven', 'Date Given')}</TableHeader>
              <TableHeader>{t('provider', 'Provider')}</TableHeader>
              <TableHeader className={styles.downloadHeader}>
                {renderExportDropdown(medicationTitle, medicationExportColumns, medicationRows)}
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedMedicationRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>{t('noMedicationData', 'No medication records found')}</TableCell>
              </TableRow>
            ) : (
              paginatedMedicationRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.dose}</TableCell>
                  <TableCell>{row.route}</TableCell>
                  <TableCell>{row.frequency}</TableCell>
                  <TableCell>{row.time}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.provider}</TableCell>
                  <TableCell />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pagination
        page={medicationPage}
        pageSize={medicationPageSize}
        pageSizes={medicationPageSizes?.length ? medicationPageSizes : [medicationPageSize]}
        totalItems={medicationRows.length}
        onChange={({ page, pageSize }) => {
          goToMedicationPage(page);
          setMedicationPageSize(pageSize);
        }}
      />
      <div className={styles.fluidSection}>
        <div className={styles.tableSectionHeader}>
          <h4>{fluidTitle}</h4>
        </div>
        <TableContainer>
          <Table size="sm" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>{t('fluidName', 'Fluid name')}</TableHeader>
                <TableHeader>{t('volume', 'Volume')}</TableHeader>
                <TableHeader>{t('frequency', 'Frequency')}</TableHeader>
                <TableHeader>{t('duration', 'Duration')}</TableHeader>
                <TableHeader>{t('timeGiven', 'Time Given')}</TableHeader>
                <TableHeader>{t('dateGiven', 'Date Given')}</TableHeader>
                <TableHeader>{t('provider', 'Provider')}</TableHeader>
                <TableHeader className={styles.downloadHeader}>
                  {renderExportDropdown(fluidTitle, fluidExportColumns, fluidRows)}
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedFluidRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>{t('noFluidData', 'No fluid records found')}</TableCell>
                </TableRow>
              ) : (
                paginatedFluidRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.volume}</TableCell>
                    <TableCell>{row.frequency}</TableCell>
                    <TableCell>{row.duration}</TableCell>
                    <TableCell>{row.time}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.provider}</TableCell>
                    <TableCell />
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Pagination
          page={fluidPage}
          pageSize={fluidPageSize}
          pageSizes={fluidPageSizes?.length ? fluidPageSizes : [fluidPageSize]}
          totalItems={fluidRows.length}
          onChange={({ page, pageSize }) => {
            goToFluidPage(page);
            setFluidPageSize(pageSize);
          }}
        />
      </div>
    </div>
  );
};

export default TreatmentChartDashboard;
