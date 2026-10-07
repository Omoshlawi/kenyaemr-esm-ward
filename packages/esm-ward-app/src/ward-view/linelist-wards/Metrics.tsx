import React, { type FC } from 'react';
import classNames from 'classnames';
import { ChevronRight } from '@carbon/react/icons';
import styles from './linelist-wards.scss';

export type MetricTone = 'blue' | 'green' | 'orange' | 'purple' | 'teal';

export type Metric = {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: MetricTone;
  /** When provided the card becomes a button (e.g. to jump to the matching patients tab). */
  onClick?: () => void;
};

type MetricsProps = {
  metrics: Array<Metric>;
};

const toneClass: Record<MetricTone, string> = {
  blue: styles.toneBlue,
  green: styles.toneGreen,
  orange: styles.toneOrange,
  purple: styles.tonePurple,
  teal: styles.toneTeal,
};

const Metrics: FC<MetricsProps> = ({ metrics }) => {
  return (
    <div className={styles.metricsContainer}>
      {metrics.map(({ label, value, icon, tone = 'teal', onClick }) => {
        const content = (
          <>
            {icon ? <span className={classNames(styles.metricIcon, toneClass[tone])}>{icon}</span> : null}
            <span className={styles.metricBody}>
              <span className={styles.metricLabel}>{label}</span>
              <span className={styles.metricValue}>{value ?? '--'}</span>
            </span>
            {onClick ? <ChevronRight size={16} className={styles.metricChevron} aria-hidden /> : null}
          </>
        );

        return onClick ? (
          <button
            key={label}
            type="button"
            className={classNames(styles.metricCard, styles.metricCardButton)}
            onClick={onClick}>
            {content}
          </button>
        ) : (
          <div key={label} className={styles.metricCard}>
            {content}
          </div>
        );
      })}
    </div>
  );
};

export default Metrics;
