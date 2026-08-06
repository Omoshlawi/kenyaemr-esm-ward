import React from 'react';
import { type VisitSummary } from '../hooks/use-patient-summary';
import styles from './investigations-and-procedures.scss';
import { useTranslation } from 'react-i18next';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import dayjs from 'dayjs';
import { DATE_FORMART } from './discharge-printout.resource';
import classNames from 'classnames';

function decodeHtml(encoded: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = encoded;
  return txt.value;
}

type EntryProps = {
  headers: Array<string>;
  rows: Array<Array<string | number | null>>;
  title: string;
  headerClassName?: string;
};

const OrderEntry: React.FC<EntryProps> = ({ headers, rows, title, headerClassName = '' }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.section}>
      <div className={classNames({ [styles.sectionHeader]: !headerClassName, [headerClassName]: headerClassName })}>
        {title}
      </div>
      <table className={styles.proceduresTable}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`row-${i}`}>
              {row.map((cell, j) => (
                <td key={`cell-${i}-${j}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const ProceduresSummary: React.FC<Pick<VisitSummary, 'procedures'>> = ({ procedures }) => {
  const { t } = useTranslation();

  const headers = [t('procedure', 'Procedure'), t('date', 'Date'), t('status', 'Status')];

  const rows = procedures.map((proc) => [
    proc.procedure,
    proc.orderedDate ? dayjs(proc.orderedDate).format(DATE_FORMART) : '—',
    proc.status,
  ]);

  if (!procedures?.length) {
    return null;
  }

  return <OrderEntry headers={headers} rows={rows} title={t('operationOrProcedures', 'Operations / Procedures')} />;
};

export const ImagingSummary: React.FC<Pick<VisitSummary, 'imaging'>> = ({ imaging }) => {
  const { t } = useTranslation();

  const headers = [t('test', 'Test'), t('date', 'Date'), t('status', 'Status')];

  const rows = imaging.map((proc) => [
    proc.procedure,
    proc.orderedDate ? dayjs(proc.orderedDate).format(DATE_FORMART) : '—',
    proc.status,
  ]);

  if (!imaging?.length) {
    return null;
  }

  return <OrderEntry headers={headers} rows={rows} title={t('imagingFindings', 'Imaging Finding')} />;
};
export const InvestigationsSummary: React.FC<Pick<VisitSummary, 'labResults'>> = ({ labResults }) => {
  const { t } = useTranslation();
  const allResults = labResults.flatMap((panel) => panel.results);

  const headers = [t('lab', 'Lab'), t('date', 'Date'), t('result', 'Result')];

  const rows = allResults.map((proc) => [
    proc.test,
    proc.date ? dayjs(proc.date).format(DATE_FORMART) : '—',
    proc.value,
  ]);

  if (!allResults?.length) {
    return null;
  }

  return <OrderEntry headers={headers} rows={rows} title={t('laboratoryFindings', 'Laboratory Findings')} />;
};
export const MedicationSummary: React.FC<Pick<VisitSummary, 'medications'>> = ({ medications }) => {
  const { t } = useTranslation();

  const headers = [t('drug', 'Drug'), t('dispensed', 'Dispensed'), t('doseFrequencyRoute', 'Dose / Frequency / Route')];

  const rows = medications.map((med) => {
    const dosageParts = [med.dose, med.frequency, med.route, med.duration].filter(Boolean).join(' · ');
    return [med.drug, med.dateActivated ? dayjs(med.dateActivated).format(DATE_FORMART) : '—', dosageParts];
  });

  if (!medications?.length) {
    return (
      <div className={styles.section}>
        <div className={styles.medHeader}>{t('hospitalTreatment', 'Hospital Treatment')}</div>
        <p>{t('noTreatment', 'No treatment')}</p>
      </div>
    );
  }

  return (
    <OrderEntry
      headers={headers}
      rows={rows}
      title={t('hospitalTreatment', 'Hospital Treatment')}
      headerClassName={styles.medHeader}
    />
  );
};
