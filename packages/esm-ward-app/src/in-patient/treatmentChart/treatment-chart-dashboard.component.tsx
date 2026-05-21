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
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type NursingCardexPlanWorkspaceProps } from './nursing-cardex-plan.workspace';
import { useNursingTreatmentSheet } from './nursing-treatment-sheet.resource';
import styles from './treatment-chart-dashboard.scss';

type TreatmentChartDashboardProps = {
  patientUuid: string;
  patient: Record<string, unknown>;
};

// t('treatmentChart', 'Treatment Chart')
// t('failed-to-load-nursing-treatment-sheet', 'Failed to load nursing treatment sheet')
// t('loading', 'Loading...')
// t('nursingTreatmentSheet', 'Nursing Treatment Sheet')
// t('add', 'Add')
// t('name', 'Name')
// t('dose', 'Dose')
// t('route', 'Route')
// t('frequencies', 'Frequencies')
// t('timeTaken', 'Time taken')
// t('dateGiven', 'Date Given')
// t('provider', 'Provider')
// t('medicationAdministered', 'Medication Administered')
// t('noMedicationData', 'No medication records found')
// t('fluidName', 'Fluid name')
// t('volume', 'Volume')
// t('frequency', 'Frequency')
// t('rate', 'Rate')
// t('duration', 'Duration')
// t('timeGiven', 'Time Given')
// t('fluidsAndParenteralNutritionSection', 'Fluids and Parenteral Nutrition Section')
// t('noFluidData', 'No fluid records found')
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

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Loading...')} />;
  }

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('failed-to-load-nursing-treatment-sheet', 'Failed to load nursing treatment sheet')}
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
      <TableContainer title={t('medicationAdministered', 'Medication Administered')}>
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
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedMedicationRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>{t('noMedicationData', 'No medication records found')}</TableCell>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pagination
        page={medicationPage}
        pageSize={medicationPageSize}
        pageSizes={medicationPageSizes}
        totalItems={medicationRows.length}
        onChange={({ page, pageSize }) => {
          goToMedicationPage(page);
          setMedicationPageSize(pageSize);
        }}
      />
      <div className={styles.fluidSection}>
        <TableContainer title={t('fluidsAndParenteralNutritionSection', 'Fluids and Parenteral Nutrition Section')}>
          <Table size="sm" useZebraStyles>
            <TableHead>
              <TableRow>
                <TableHeader>{t('fluidName', 'Fluid name')}</TableHeader>
                <TableHeader>{t('volume', 'Volume')}</TableHeader>
                <TableHeader>{t('frequency', 'Frequency')}</TableHeader>
                <TableHeader>{t('rate', 'Rate')}</TableHeader>
                <TableHeader>{t('duration', 'Duration')}</TableHeader>
                <TableHeader>{t('timeGiven', 'Time Given')}</TableHeader>
                <TableHeader>{t('dateGiven', 'Date Given')}</TableHeader>
                <TableHeader>{t('provider', 'Provider')}</TableHeader>
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
                    <TableCell>--</TableCell>
                    <TableCell>{row.duration}</TableCell>
                    <TableCell>{row.time}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.provider}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Pagination
          page={fluidPage}
          pageSize={fluidPageSize}
          pageSizes={fluidPageSizes}
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
