import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../labour-care-guide.scss';

export interface DrugsIVFluidsData {
  drugName: string;
  dosage: string;
  index?: number;
}

interface DrugsIVFluidsGraphProps {
  data: DrugsIVFluidsData[];
}

const DrugsIVFluidsGraph: React.FC<DrugsIVFluidsGraphProps> = ({ data }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.sectionBlock}>
      <table className={styles.gridTable}>
        <tbody>
          <tr>
            <td className={styles.parameterWideCell} colSpan={2}>
              {t('drugName', 'Drug Name')}
            </td>
            {data.map((item, idx) => (
              <td key={`drug-${idx}`} className={styles.entryCell}>
                {item.drugName}
              </td>
            ))}
          </tr>
          <tr>
            <td className={styles.parameterWideCell} colSpan={2}>
              {t('dosage', 'Dosage')}
            </td>
            {data.map((item, idx) => (
              <td key={`dosage-${idx}`} className={styles.entryCell}>
                {item.dosage}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default DrugsIVFluidsGraph;
