import { ContentSwitcher, Switch } from '@carbon/react';
import { useFeatureFlag, Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WardPatientWorkspaceProps } from '../../types';
import WardPatientWorkspaceBanner from '../patient-banner/patient-banner.component';
import styles from './patient-transfer-swap.scss';

const TransferSection = {
  TRANSFER: 'transfer',
  BED_SWAP: 'bed-swap',
} as const;

type TransferSectionValues = (typeof TransferSection)[keyof typeof TransferSection];

export default function PatientTransferAndSwapWorkspace(
  props: Workspace2DefinitionProps<WardPatientWorkspaceProps> & {
    withContentSwitcher?: boolean;
    defaultTransfersection?: TransferSectionValues;
  },
) {
  const {
    defaultTransfersection,
    withContentSwitcher = true,
    workspaceProps: { wardPatient },
    launchChildWorkspace,
  } = props;
  const { t } = useTranslation();
  const [selectedSection, setSelectedSection] = useState<TransferSectionValues>(
    defaultTransfersection ?? TransferSection.TRANSFER,
  );
  const isBedManagementModuleInstalled = useFeatureFlag('bedmanagement-module');

  return (
    <Workspace2 title={t('transfers', 'Transfers')}>
      <div className={styles.flexWrapper}>
        <div className={styles.patientWorkspaceBanner}>
          <WardPatientWorkspaceBanner wardPatient={wardPatient} />
        </div>
        {isBedManagementModuleInstalled && withContentSwitcher && (
          <div className={styles.contentSwitcherWrapper}>
            <h2 className={styles.productiveHeading02}>{t('typeOfTransfer', 'Type of transfer')}</h2>
            <div className={styles.contentSwitcher}>
              <ContentSwitcher
                onChange={({ index }) =>
                  launchChildWorkspace(
                    index === 0 ? 'patient-admit-or-transfer-request-form' : 'patient-bed-swap-form',
                    { wardPatient },
                  )
                }
                selectedIndex={selectedSection === TransferSection.TRANSFER ? 0 : 1}
                size="sm">
                <Switch name={TransferSection.TRANSFER} text={t('transfer', 'Transfer')} />
                <Switch name={TransferSection.BED_SWAP} text={t('bedSwap', 'Bed swap')} />
              </ContentSwitcher>
            </div>
          </div>
        )}
        <div className={styles.workspaceForm}>
          {/* {selectedSection === TransferSection.TRANSFER ? (
          <PatientAdmitOrTransferForm {...props} />
        ) : (
          <PatientBedSwapForm {...props} />
        )} */}
        </div>
      </div>
    </Workspace2>
  );
}
