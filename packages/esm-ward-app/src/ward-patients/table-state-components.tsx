// Desclaimer: not using openmrs provided (EmptyState,ErrorState) to avoid repeated header titles and customize the message since provided ones are contexted to patient chart

import { Tile } from '@carbon/react';
import React, { type FC } from 'react';
import styles from './ward-patient.scss';
import { useTranslation } from 'react-i18next';
type EmptyStateProps = {
  message?: string;
};

/** Hospital bed with a medical cross, used for empty ward patient lists. */
export const EmptyBedIllustration: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="96" height="72" viewBox="0 0 96 72" fill="none" aria-hidden="true">
    <ellipse className={styles.illustrationShadow} cx="48" cy="66" rx="38" ry="4" />
    <rect
      className={`${styles.illustrationWhiteFill} ${styles.illustrationPrimaryStroke}`}
      x="58"
      y="6"
      width="22"
      height="22"
      rx="4"
      strokeWidth="2"
    />
    <path className={styles.illustrationPrimaryStroke} d="M69 11v12M63 17h12" strokeWidth="3" strokeLinecap="round" />
    <rect className={styles.illustrationPrimaryFill} x="10" y="22" width="5" height="34" rx="2.5" />
    <rect className={styles.illustrationPrimaryFill} x="81" y="34" width="5" height="22" rx="2.5" />
    <rect className={styles.illustrationPrimaryFill} x="14" y="40" width="70" height="10" rx="3" />
    <path className={styles.illustrationSoftFill} d="M16 40c0-6 4-10 10-10h52c4 0 6 2 6 6v4H16z" />
    <rect
      className={`${styles.illustrationWhiteFill} ${styles.illustrationLineStroke}`}
      x="18"
      y="31"
      width="16"
      height="9"
      rx="4.5"
      strokeWidth="1.5"
    />
    <path className={styles.illustrationLineStroke} d="M38 34c8-3 18-3 26 0" strokeWidth="1.5" strokeLinecap="round" />
    <circle
      className={`${styles.illustrationWhiteFill} ${styles.illustrationPrimaryStroke}`}
      cx="22"
      cy="60"
      r="4"
      strokeWidth="2.5"
    />
    <circle
      className={`${styles.illustrationWhiteFill} ${styles.illustrationPrimaryStroke}`}
      cx="76"
      cy="60"
      r="4"
      strokeWidth="2.5"
    />
    <path className={styles.illustrationPrimaryStroke} d="M22 50v6M76 50v6" strokeWidth="2.5" />
  </svg>
);

export const EmptyState: FC<EmptyStateProps> = ({ message }) => {
  return (
    <Tile className={styles.empty}>
      <EmptyBedIllustration className={styles.emptyIllustration} />
      <p className={styles.emptyMessage}>{message}</p>
    </Tile>
  );
};
type ErrorStateProps = {
  error?: Error;
};

export const ErrorState: FC<ErrorStateProps> = ({ error }) => {
  const { t } = useTranslation();
  return (
    <Tile className={styles.error}>
      <strong>
        {t('error', 'Error')} {`${(error as any)?.response?.status}: `}
        {(error as any)?.response?.statusText}
      </strong>
      <p>
        {t(
          'errorCopy',
          'Sorry, there was a problem displaying this information. You can try to reload this page, or contact the site administrator and quote the error code above.',
        )}
      </p>{' '}
    </Tile>
  );
};
