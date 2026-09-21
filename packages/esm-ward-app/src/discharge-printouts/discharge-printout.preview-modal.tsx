import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { ErrorState, restBaseUrl } from '@openmrs/esm-framework';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrintPreview } from './use-print-preview';
import styles from './discharge-printout.preview-modal.scss';

/**
 * The server-generated documents that can be previewed/printed. The value maps
 * to the REST path segment, e.g. `.../palladiumemr/dischargeSummary`.
 */
export type DischargeDocumentName = 'dischargeSummary' | 'gatePass' | 'postOperationNotes';

type DischargePrintoutPreviewModalProps = {
  onClose: () => void;
  /**
   * The document to generate. Becomes the REST path segment.
   */
  documentName: DischargeDocumentName;
  /**
   * The visit the document is generated for.
   */
  visitUuid?: string;
  /**
   * Optional patient name, shown in the modal header.
   */
  patientName?: string;
};

const DischargePrintoutPreviewModal: FC<DischargePrintoutPreviewModalProps> = ({
  onClose,
  documentName,
  visitUuid,
  patientName,
}) => {
  const { t } = useTranslation();
  const url = visitUuid
    ? `${window.openmrsBase}${restBaseUrl}/palladiumemr/${documentName}?visitUuid=${visitUuid}`
    : null;
  const { data, isLoading, error } = usePrintPreview(url);

  const modalHeader = patientName
    ? t('printPreviewForPatient', 'Print Preview — {{patientName}}', { patientName })
    : t('printPreview', 'Print Preview');

  const handlePrint = () => {
    const iframe = document.querySelector<HTMLIFrameElement>(`.${styles.previewFrame}`);
    iframe?.contentWindow?.focus();
    iframe?.contentWindow?.print();
  };

  return (
    <div>
      <ModalHeader closeModal={onClose} className={styles.title}>
        {modalHeader}
      </ModalHeader>
      <ModalBody>
        {isLoading && (
          <div className={styles.loadingContainer}>
            <InlineLoading
              status="active"
              iconDescription={t('loading', 'Loading')}
              description={t('loadingPreview', 'Loading preview...')}
            />
          </div>
        )}
        {error && <ErrorState error={error} headerTitle={t('previewError', 'Preview Error')} />}
        {data && !isLoading && (
          <iframe src={data} title={t('printPreview', 'Print Preview')} className={styles.previewFrame} />
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose} type="button">
          {t('close', 'Close')}
        </Button>
        {data && (
          <Button kind="primary" type="button" onClick={handlePrint}>
            {t('print', 'Print')}
          </Button>
        )}
      </ModalFooter>
    </div>
  );
};

export default DischargePrintoutPreviewModal;
