import React from 'react';
import { useTranslation } from 'react-i18next';
import { Add } from '@carbon/react/icons';
import styles from './labour-care-guide.scss';
import {
  usePatient,
  getPatientName,
  openmrsFetch,
  restBaseUrl,
  useConfig,
  launchWorkspace2,
  useSession,
} from '@openmrs/esm-framework';
import { Button, InlineLoading } from '@carbon/react';
import useSWR from 'swr';
import type { WardConfigObject } from '../../config-schema';
import useCurrentPatientAdmissionEncounter from '../../hooks/useCurrentPatientAdmissionEncounter';
import { useAdmissionLocationTags } from '../in-patient.resource';
import SupportiveCare from './graphs/supportive-care.component';
import Baby from './graphs/baby.component';
import Woman from './graphs/woman.component';
import LabourProgress from './graphs/labour-progress.component';
import Medication from './graphs/medication.component';
import SharedDecisionMaking from './graphs/shared-decision-making.component';
import LabourCareGuideHeader from './graphs/labour-care-guide-header.component';
import { LabourCareGuideForms } from './forms/labour-care-guide-forms.component';
import EmergencyEntryModal from './forms/emergency-entry-modal.component';
import {
  calculateGravida,
  LCG_SHARED_DECISION_ALERT_TIMER_MINUTES,
  LCG_SHARED_DECISION_PROMPT_HOUR_MINUTES,
  LCG_TIME_INCREMENT_MINUTES,
  LCG_MATERNITY_LOOKBACK_DAYS,
  MATERNITY_INPATIENT_ENCOUNTER_TYPE_UUID,
  MATERNITY_INPATIENT_FORM_UUID,
  MISCARRIAGE_ABORTIONS_CONCEPT_UUID,
  PARITY_CONCEPT_UUID,
  PARTOGRAPHY_CONCEPTS,
  URGE_TO_PUSH_UUID,
  type LcgEmergencySectionKey,
} from './types';
import {
  addStepsToHHMM,
  getSlotIndexForTime,
  resolveStageAwareStopSlots,
  SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
} from './time-slot-utils';
import { LabourCareGuideSummaryHeader } from './labour-care-guide-header.component';
import {
  activeFirstStageHours,
  calculateAgeFromBirthDate,
  getEncounterObsValue,
  getEncounterRecordedTime,
  getEncounterObsNumber,
  parseCervicalDilationValue,
  parseUrgeToPushValue,
  resolveBirthActionLabel,
  secondStageHours,
} from './labour-care-guide.utils';
import { useLcgData } from './hooks/use-lcg-data';
import { LcgSectionStateProvider } from './context/lcg-section-state.context';
import { GlobalCdsAlertProvider, useGlobalCdsAlert } from './global-cds-alerts/global-cds-alert-context';
import GlobalCdsAlertDisplay from './global-cds-alerts/global-cds-alert-display.component';
import { LCG_CDS_ALERT_HANDLED_QUERY_KEY, LCG_CDS_ALERT_STORAGE_KEY } from './constants/labour-care-guide.constants';
import type { CdsAlertBroadcastPayload } from './types/labour-care-guide.types';
import { useLcgAlertSound } from './hooks/use-lcg-alert-sound';

type LabourCareGuideProps = {
  patientUuid: string;
};

type LabourCareGuideContentProps = LabourCareGuideProps & {
  patient: any;
};

const getPatientGenderValue = (patient: any): string => {
  const gender = patient?.gender;
  if (typeof gender === 'string') {
    return gender;
  }

  if (gender && typeof gender === 'object') {
    return String(gender.display ?? gender.name ?? gender.value ?? '');
  }

  return '';
};

const isMalePatient = (patient: any): boolean => {
  const gender = getPatientGenderValue(patient).trim().toLowerCase();
  return gender === 'm' || gender === 'male' || gender.startsWith('male ');
};

const isFemalePatient = (patient: any): boolean => {
  const gender = getPatientGenderValue(patient).trim().toLowerCase();
  return gender === 'f' || gender === 'female' || gender.startsWith('female ');
};

const getPatientAge = (patient: any): number => {
  const ageFromPatient = Number(patient?.age);
  if (Number.isFinite(ageFromPatient)) {
    return ageFromPatient;
  }

  const birthDate = patient?.birthDate;
  if (!birthDate) {
    return NaN;
  }

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return NaN;
  }

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasNotHadBirthdayYet =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (hasNotHadBirthdayYet) {
    age -= 1;
  }

  return age;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatEncounterDateTime = (value?: string): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

type ExportTableColumn = {
  key: string;
  label: string;
  width?: string;
};

const LabourCareGuide: React.FC<LabourCareGuideProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { patient, isLoading } = usePatient(patientUuid);
  const { inpatientLocationTags } = useConfig<WardConfigObject>();
  const {
    admissionEncounter,
    isLoading: isLoadingAdmission,
    isPatientAdmitted,
  } = useCurrentPatientAdmissionEncounter(patientUuid);
  const { tags, isLoading: isLoadingTags } = useAdmissionLocationTags(admissionEncounter?.location?.uuid);

  const isAdmittedToAllowedWard = React.useMemo(() => {
    const allowedWardTags = [
      inpatientLocationTags?.labourWard,
      inpatientLocationTags?.antenatalWard,
      inpatientLocationTags?.maternityWard,
    ].filter(Boolean);
    return allowedWardTags.some((tagUuid) => tags.some((tag) => tag.uuid === tagUuid));
  }, [inpatientLocationTags, tags]);

  if (isLoading || isLoadingAdmission || isLoadingTags) {
    return <InlineLoading description={t('loading', 'Loading...')} />;
  }

  const patientAge = getPatientAge(patient);
  const isEligible =
    !isMalePatient(patient) &&
    isFemalePatient(patient) &&
    Number.isFinite(patientAge) &&
    patientAge > 9 &&
    isPatientAdmitted &&
    isAdmittedToAllowedWard;

  if (!isEligible) {
    return null;
  }

  return <LabourCareGuideContent patientUuid={patientUuid} patient={patient} />;
};

const LabourCareGuideContent: React.FC<LabourCareGuideContentProps> = ({ patientUuid, patient }) => {
  return (
    <LcgSectionStateProvider patientUuid={patientUuid}>
      <LabourCareGuideWorkspace patientUuid={patientUuid} patient={patient} />
    </LcgSectionStateProvider>
  );
};

const LabourCareGuideWorkspace: React.FC<LabourCareGuideContentProps> = ({ patientUuid, patient }) => {
  const { t } = useTranslation();
  const config = useConfig();
  const session = useSession();
  const { broadcastAlert: broadcastAlertToGlobalContext } = useGlobalCdsAlert();
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = React.useState(false);
  const [emergencyReason, setEmergencyReason] = React.useState<string | null>(null);
  const [emergencySection, setEmergencySection] = React.useState<LcgEmergencySectionKey | null>(null);
  const [activeBabyTwinIndex, setActiveBabyTwinIndex] = React.useState(1);
  const [twinSectionCount, setTwinSectionCount] = React.useState(1);
  const [activeCdsToast, setActiveCdsToast] = React.useState<CdsAlertBroadcastPayload | null>(null);
  const [activeAlertKey, setActiveAlertKey] = React.useState<string | null>(null);
  const { isAlertSoundEnabled, setIsAlertSoundEnabled, startAlertBeep, stopAlertBeep } = useLcgAlertSound();
  const lastBroadcastKeyRef = React.useRef<string | null>(null);
  const lastHandledRouteKeyRef = React.useRef<string | null>(null);
  const printableCanvasRef = React.useRef<HTMLDivElement | null>(null);
  // Track first detection time of current alert for threshold calculation
  const alertFirstDetectionTimeRef = React.useRef<number | null>(null);
  const {
    isTimeFormOpen,
    setIsTimeFormOpen,
    isSupportiveCareFormOpen,
    setIsSupportiveCareFormOpen,
    isBabyFormOpen,
    setIsBabyFormOpen,
    isWomanFormOpen,
    setIsWomanFormOpen,
    isContractionsFormOpen,
    setIsContractionsFormOpen,
    isLabourProgressFormOpen,
    setIsLabourProgressFormOpen,
    isMedicationFormOpen,
    setIsMedicationFormOpen,
    isSharedDecisionMakingFormOpen,
    setIsSharedDecisionMakingFormOpen,
    sharedDecisionAutoPromptSummary,
    setSharedDecisionAutoPromptSummary,
    sharedDecisionAutoPromptItems,
    setSharedDecisionAutoPromptItems,
    isAdmissionDetailsFormOpen,
    setIsAdmissionDetailsFormOpen,
    labourProgressRefreshToken,
    setLocalSupportiveCareEntries,
    setLocalMedicationEntries,
    setLocalBabyEntries,
    localLabourProgressEntries,
    localWomanEntries,
    setLocalWomanEntries,
    setLocalSharedDecisionMakingEntries,
    admissionDetails,
    setAdmissionDetails,
    admissionDetailsFilled,
    mutateAdmissionDetails,
    mutateLabourTimeSetData,
    mutateBabyData,
    mutateMedicationData,
    mutateSupportiveCareData,
    mutateSharedDecisionMakingData,
    mergedMedicationEntries,
    mergedSupportiveCareEntries,
    mergedBabyEntries,
    mergedSharedDecisionMakingEntries,
    mergedLabourProgressEntries,
    womanFormExistingTimeEntries,
    handleWomanFormSubmit,
    handleLabourProgressFormSubmit,
    admissionRiskFactorCodes,
    birthEvents,
    nowMinutes,
    baseTime,
    workflowStopState,
    isWorkflowStopped,
    sharedDecisionAutoPromptDebugWindow,
    cdsPendingAlert,
    activeSharedDecisionAlerts,
    cervicalEncounters,
  } = useLcgData(patientUuid);

  const currentPatientName = React.useMemo(() => {
    if (!patient) {
      return patientUuid;
    }
    const name = getPatientName(patient);
    return name?.trim() ? name : patientUuid;
  }, [patient, patientUuid]);

  const providerName = React.useMemo(() => {
    const raw = (session as any)?.currentProvider?.display ?? '';
    const parts = String(raw).split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ') : raw;
  }, [session]);

  const isMultipleGestation = React.useMemo(
    () => admissionRiskFactorCodes.includes('multiple_gestation'),
    [admissionRiskFactorCodes],
  );

  React.useEffect(() => {
    if (!isMultipleGestation) {
      setTwinSectionCount(1);
      setActiveBabyTwinIndex(1);
    }
  }, [isMultipleGestation]);

  const observedTwinCount = React.useMemo(() => {
    if (!isMultipleGestation) {
      return 1;
    }

    const maxTwinIndex = mergedBabyEntries.reduce((maxIndex, entry) => {
      const index = Number(entry.twinIndex ?? 1);
      return Number.isFinite(index) && index > maxIndex ? index : maxIndex;
    }, 1);

    return Math.max(1, maxTwinIndex);
  }, [isMultipleGestation, mergedBabyEntries]);

  React.useEffect(() => {
    if (!isMultipleGestation) {
      return;
    }

    if (observedTwinCount > twinSectionCount) {
      setTwinSectionCount(observedTwinCount);
    }
  }, [isMultipleGestation, observedTwinCount, twinSectionCount]);

  const deliveredTwinsSet = React.useMemo(() => {
    const delivered = new Set<number>();
    if (!isMultipleGestation) {
      return delivered;
    }
    let deliveryCount = 0;
    const sortedSdmEntries = [...mergedSharedDecisionMakingEntries].sort(
      (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
    );

    for (const entry of sortedSdmEntries) {
      if (resolveBirthActionLabel(entry.action) === 'BIRTH') {
        deliveryCount++;
        delivered.add(deliveryCount);
      }
    }

    return delivered;
  }, [isMultipleGestation, mergedSharedDecisionMakingEntries]);

  const hasTwinOneBirthRecorded = React.useMemo(
    () => isMultipleGestation && deliveredTwinsSet.has(1),
    [deliveredTwinsSet, isMultipleGestation],
  );

  const totalTwinSections = isMultipleGestation
    ? Math.min(2, Math.max(hasTwinOneBirthRecorded ? 2 : 1, twinSectionCount, observedTwinCount))
    : 1;

  React.useEffect(() => {
    if (!isMultipleGestation || activeBabyTwinIndex === -1) {
      return;
    }

    if (deliveredTwinsSet.has(activeBabyTwinIndex) && activeBabyTwinIndex < totalTwinSections) {
      setActiveBabyTwinIndex(activeBabyTwinIndex + 1);
    }
  }, [isMultipleGestation, deliveredTwinsSet, activeBabyTwinIndex, totalTwinSections]);

  const effectiveWorkflowStopState = workflowStopState;
  const effectiveIsWorkflowStopped = Boolean(effectiveWorkflowStopState);

  const babyEntriesByTwin = React.useMemo(() => {
    const grouped = new Map<number, typeof mergedBabyEntries>();
    for (const entry of mergedBabyEntries) {
      const twinIndex = entry.twinIndex ?? 1;
      if (!grouped.has(twinIndex)) {
        grouped.set(twinIndex, []);
      }
      grouped.get(twinIndex)!.push(entry);
    }
    return grouped;
  }, [mergedBabyEntries]);

  const ruptureDisplay = React.useMemo(() => {
    if (admissionDetails.rupturedMembranes === 'yes') {
      const date = admissionDetails.rupturedMembranesDate || '';
      const time = admissionDetails.rupturedMembranesTime || '';
      if (date || time) {
        return `[Date: ${date || '-'} Time: ${time || '-'}]`;
      }
      return 'Yes';
    }

    if (admissionDetails.rupturedMembranes === 'no') {
      return 'No';
    }

    if (admissionDetails.rupturedMembranes === 'intact') {
      return 'Intact';
    }

    if (admissionDetails.rupturedMembranes === 'unknown') {
      return 'Unknown';
    }

    return '';
  }, [
    admissionDetails.rupturedMembranes,
    admissionDetails.rupturedMembranesDate,
    admissionDetails.rupturedMembranesTime,
  ]);

  const labourOnsetDisplay = React.useMemo(() => {
    switch (admissionDetails.labourOnset) {
      case 'spontaneous':
        return t('spontaneous', 'Spontaneous');
      case 'induction':
        return t('induction', 'Induction');
      case 'pre_labour_csection':
        return t('preLabourCsection', 'Pre-labour C-section');
      default:
        return admissionDetails.labourOnset;
    }
  }, [admissionDetails.labourOnset, t]);

  const patientAge =
    String((patient as any)?.age ?? '').trim() || calculateAgeFromBirthDate((patient as any)?.birthDate);

  const exportSectionRows = React.useMemo(() => {
    const admissionRows = [
      {
        labourOnset: labourOnsetDisplay || admissionDetails.labourOnset || '',
        diagnosisDate: admissionDetails.activeLabourDiagnosisDate || '',
        riskFactors: admissionDetails.riskFactors || '',
        rupturedMembranes: admissionDetails.rupturedMembranes || '',
        rupturedMembranesDate: admissionDetails.rupturedMembranesDate || '',
        rupturedMembranesTime: admissionDetails.rupturedMembranesTime || '',
      },
    ];

    const supportiveCareRows = mergedSupportiveCareEntries.map((entry) => ({
      time: entry.time ?? '',
      companion: entry.companion ?? '',
      painRelief: entry.painRelief ?? '',
      oralFluid: entry.oralFluid ?? '',
      posture: entry.posture ?? '',
      recordedAt: formatEncounterDateTime(entry.encounterDatetime),
    }));

    const babyRows = mergedBabyEntries.map((entry) => ({
      time: entry.time ?? '',
      twin: String(entry.twinIndex ?? 1),
      baselineFhr: entry.baselineFhr ?? '',
      fhrDeceleration: entry.fhrDeceleration ?? '',
      amnioticFluid: entry.amnioticFluid ?? '',
      fetalPosition: entry.fetalPosition ?? '',
      caput: entry.caput ?? '',
      moulding: entry.moulding ?? '',
      recordedAt: formatEncounterDateTime(entry.encounterDatetime),
    }));

    const womanRows = localWomanEntries.map((entry) => ({
      time: entry.time ?? '',
      pulse: entry.pulse ?? '',
      systolicBp: entry.systolicBp ?? '',
      diastolicBp: entry.diastolicBp ?? '',
      temperature: entry.temperature ?? '',
      protein: entry.protein ?? '',
      acetone: entry.acetone ?? '',
      recordedAt: formatEncounterDateTime(entry.recordedAt),
    }));

    const labourProgressRows = mergedLabourProgressEntries.map((entry) => ({
      time: entry.time ?? '',
      contractionsPer10Mins: entry.contractionsPer10Mins ?? '',
      durationOfContractions: entry.durationOfContractions ?? '',
      cervicalDilation: entry.cervicalDilation ?? '',
      descentOfHead: entry.descentOfHead ?? '',
      urgeToPush: entry.urgeToPush ?? '',
      recordedAt: formatEncounterDateTime(entry.encounterDatetime),
    }));

    const medicationRows = mergedMedicationEntries.map((entry) => ({
      time: entry.time ?? '',
      oxytocin: entry.oxytocin ?? '',
      oxytocinUnitsPerLitre: entry.oxytocinU_L ?? '',
      oxytocinDropsPerMinute: entry.oxytocinDrops ?? '',
      medicine: entry.medicine ?? '',
      drugName: entry.drugName ?? '',
      dosage: entry.dosage ?? '',
      route: entry.route ?? '',
      ivFluids: entry.ivFluids ?? '',
      ivFluidType: entry.ivFluidType ?? '',
      recordedAt: formatEncounterDateTime(entry.encounterDatetime),
    }));

    const sharedDecisionRows = mergedSharedDecisionMakingEntries.map((entry) => ({
      time: entry.time ?? '',
      assessment: entry.assessment ?? '',
      action: entry.action ?? '',
      plan: entry.plan ?? '',
      recordedAt: formatEncounterDateTime(entry.encounterDatetime),
    }));

    return {
      admissionRows,
      supportiveCareRows,
      babyRows,
      womanRows,
      labourProgressRows,
      medicationRows,
      sharedDecisionRows,
    };
  }, [
    admissionDetails,
    labourOnsetDisplay,
    mergedSupportiveCareEntries,
    mergedBabyEntries,
    localWomanEntries,
    mergedLabourProgressEntries,
    mergedMedicationEntries,
    mergedSharedDecisionMakingEntries,
  ]);

  const buildPdfTableSection = React.useCallback(
    (title: string, columns: ExportTableColumn[], rows: Array<Record<string, string | number>>) => {
      const headerHtml = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
      const colGroupHtml = columns
        .map((column) => `<col${column.width ? ` style="width:${escapeHtml(column.width)}"` : ''} />`)
        .join('');
      const rowsHtml =
        rows.length > 0
          ? rows
              .map(
                (row) =>
                  `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.key] ?? '')}</td>`).join('')}</tr>`,
              )
              .join('')
          : `<tr><td colspan="${columns.length}">${escapeHtml(t('noData', 'No data recorded'))}</td></tr>`;
      return `<section class="table-section"><h3>${escapeHtml(title)}</h3><table><colgroup>${colGroupHtml}</colgroup><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></section>`;
    },
    [t],
  );

  const downloadPdf = React.useCallback(() => {
    const source = printableCanvasRef.current;
    if (!source) {
      return;
    }

    const patientAgeValue = String((patient as any)?.age ?? '').trim() || String(patientAge ?? '');
    const tablesHtml = [
      buildPdfTableSection(
        t('admissionDetails', 'Admission Details'),
        [
          { key: 'labourOnset', label: t('labourOnset', 'Labour Onset'), width: '16%' },
          { key: 'diagnosisDate', label: t('diagnosisDate', 'Diagnosis Date'), width: '14%' },
          { key: 'riskFactors', label: t('riskFactors', 'Risk Factors'), width: '34%' },
          { key: 'rupturedMembranes', label: t('rupturedMembranes', 'Ruptured Membranes'), width: '12%' },
          { key: 'rupturedMembranesDate', label: t('dateOfRupture', 'Date of Rupture'), width: '12%' },
          { key: 'rupturedMembranesTime', label: t('timeOfRupture', 'Time of Rupture'), width: '12%' },
        ],
        exportSectionRows.admissionRows,
      ),
      buildPdfTableSection(
        t('supportiveCare', 'Supportive Care'),
        [
          { key: 'time', label: t('time', 'Time'), width: '10%' },
          { key: 'companion', label: t('labourCompanion', 'Companion'), width: '15%' },
          { key: 'painRelief', label: t('painRelief', 'Pain Relief'), width: '15%' },
          { key: 'oralFluid', label: t('oralFluids', 'Oral Fluids'), width: '15%' },
          { key: 'posture', label: t('posture', 'Posture'), width: '15%' },
          { key: 'recordedAt', label: t('recordedAt', 'Recorded At'), width: '30%' },
        ],
        exportSectionRows.supportiveCareRows,
      ),
      buildPdfTableSection(
        t('baby', 'Baby'),
        [
          { key: 'time', label: t('time', 'Time'), width: '8%' },
          { key: 'twin', label: t('twin', 'Twin'), width: '6%' },
          { key: 'baselineFhr', label: t('baselineFhr', 'Baseline FHR'), width: '11%' },
          { key: 'fhrDeceleration', label: t('fhrDeceleration', 'FHR Deceleration'), width: '12%' },
          { key: 'amnioticFluid', label: t('amnioticFluid', 'Amniotic Fluid'), width: '12%' },
          { key: 'fetalPosition', label: t('fetalPosition', 'Fetal Position'), width: '11%' },
          { key: 'caput', label: t('caput', 'Caput'), width: '8%' },
          { key: 'moulding', label: t('moulding', 'Moulding'), width: '8%' },
          { key: 'recordedAt', label: t('recordedAt', 'Recorded At'), width: '24%' },
        ],
        exportSectionRows.babyRows,
      ),
      buildPdfTableSection(
        t('woman', 'Woman'),
        [
          { key: 'time', label: t('time', 'Time'), width: '8%' },
          { key: 'pulse', label: t('pulse', 'Pulse'), width: '10%' },
          { key: 'systolicBp', label: t('systolicBp', 'Systolic BP'), width: '10%' },
          { key: 'diastolicBp', label: t('diastolicBp', 'Diastolic BP'), width: '10%' },
          { key: 'temperature', label: t('temperature', 'Temperature'), width: '10%' },
          { key: 'protein', label: t('protein', 'Protein'), width: '10%' },
          { key: 'acetone', label: t('acetone', 'Acetone'), width: '10%' },
          { key: 'recordedAt', label: t('recordedAt', 'Recorded At'), width: '32%' },
        ],
        exportSectionRows.womanRows,
      ),
      buildPdfTableSection(
        t('labourProgress', 'Labour Progress'),
        [
          { key: 'time', label: t('time', 'Time'), width: '8%' },
          { key: 'contractionsPer10Mins', label: t('contractionsPer10Mins', 'Contractions/10 Min'), width: '14%' },
          {
            key: 'durationOfContractions',
            label: t('durationOfContractions', 'Duration of Contractions'),
            width: '14%',
          },
          { key: 'cervicalDilation', label: t('cervicalDilation', 'Cervical Dilation'), width: '12%' },
          { key: 'descentOfHead', label: t('descentOfHead', 'Descent of Head'), width: '12%' },
          { key: 'urgeToPush', label: t('urgeToPush', 'Urge to Push'), width: '10%' },
          { key: 'recordedAt', label: t('recordedAt', 'Recorded At'), width: '30%' },
        ],
        exportSectionRows.labourProgressRows,
      ),
      buildPdfTableSection(
        t('medication', 'Medication'),
        [
          { key: 'time', label: t('time', 'Time'), width: '7%' },
          { key: 'oxytocin', label: t('oxytocin', 'Oxytocin'), width: '7%' },
          { key: 'oxytocinUnitsPerLitre', label: t('oxytocinUnitsPerLitre', 'Oxytocin U/L'), width: '8%' },
          { key: 'oxytocinDropsPerMinute', label: t('oxytocinDropsPerMinute', 'Drops/Min'), width: '8%' },
          { key: 'medicine', label: t('medicine', 'Medicine'), width: '8%' },
          { key: 'drugName', label: t('drugName', 'Drug Name'), width: '12%' },
          { key: 'dosage', label: t('dosage', 'Dosage'), width: '8%' },
          { key: 'route', label: t('route', 'Route'), width: '8%' },
          { key: 'ivFluids', label: t('ivFluids', 'IV Fluids'), width: '8%' },
          { key: 'ivFluidType', label: t('ivFluidType', 'IV Fluid Type'), width: '10%' },
          { key: 'recordedAt', label: t('recordedAt', 'Recorded At'), width: '16%' },
        ],
        exportSectionRows.medicationRows,
      ),
      buildPdfTableSection(
        t('sharedDecisionMaking', 'Shared Decision Making'),
        [
          { key: 'time', label: t('time', 'Time'), width: '8%' },
          { key: 'assessment', label: t('assessment', 'Assessment'), width: '28%' },
          { key: 'action', label: t('action', 'Action'), width: '16%' },
          { key: 'plan', label: t('plan', 'Plan'), width: '28%' },
          { key: 'recordedAt', label: t('recordedAt', 'Recorded At'), width: '20%' },
        ],
        exportSectionRows.sharedDecisionRows,
      ),
    ].join('');

    const firstPageUiHtml = source.outerHTML.replaceAll('>BABY<', '><');

    const inheritedStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((styleNode) => styleNode.outerHTML)
      .join('\n');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(t('labourCareGuideExport', 'Labour Care Guide Export'))}</title>
          ${inheritedStyles}
          <style>
            @page { size: A2 landscape; margin: 8mm; }
            body { font-family: Arial, sans-serif; color: #161616; }
            .page-break { page-break-before: always; }
            .meta { margin-bottom: 12px; font-size: 12px; }
            .meta strong { display: inline-block; min-width: 130px; }
            .table-section { margin-bottom: 14px; }
            .table-section h3 { margin: 0 0 6px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #d0d0d0; padding: 4px; text-align: left; vertical-align: top; }
            th { background: #f4f4f4; }
            .signature { margin-top: 18px; font-size: 12px; }
            .signature-line { margin-top: 18px; border-top: 1px solid #161616; width: 280px; padding-top: 4px; }
            button, .cds--btn, [data-export-hide="true"] { display: none !important; }
            .ui-page { page-break-after: always; overflow: hidden; }
            .ui-scale-wrap {
              transform: scale(0.82);
              transform-origin: top left;
              width: 122%;
            }
            .container { overflow: visible !important; background: #ffffff !important; padding: 0 !important; }
            .canvas { border: 0 !important; }
            .table-section table { table-layout: fixed; }
            .table-section td, .table-section th {
              white-space: normal;
              word-break: break-word;
            }
          </style>
        </head>
        <body>
          <div class="ui-page">
            <div class="meta">
              <div><strong>${escapeHtml(t('patientName', 'Patient Name'))}:</strong> ${escapeHtml(currentPatientName)}</div>
              <div><strong>${escapeHtml(t('age', 'Age'))}:</strong> ${escapeHtml(patientAgeValue)}</div>
              <div><strong>${escapeHtml(t('generatedOn', 'Generated On'))}:</strong> ${escapeHtml(new Date().toLocaleString())}</div>
            </div>
            <div class="ui-scale-wrap">
              ${firstPageUiHtml}
            </div>
            <div class="signature">
              <div class="signature-line">${escapeHtml(
                `${t('providerSignature', 'Provider Signature/Name')}: ${providerName || '____________________'}`,
              )}</div>
            </div>
          </div>
          <div>
            <h2>${escapeHtml(t('labourCareGuideTables', 'Labour Care Guide Tables'))}</h2>
            ${tablesHtml}
            <div class="signature">
              <div class="signature-line">${escapeHtml(
                `${t('providerSignature', 'Provider Signature/Name')}: ${providerName || '____________________'}`,
              )}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);

    const frameDocument = frame.contentDocument;
    if (!frameDocument) {
      document.body.removeChild(frame);
      return;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    window.setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => {
        if (frame.parentNode) {
          frame.parentNode.removeChild(frame);
        }
      }, 2000);
    }, 0);
  }, [buildPdfTableSection, currentPatientName, exportSectionRows, patient, patientAge, providerName, t]);

  const {
    data: maternityEncounter,
    isLoading: isLoadingMaternityEncounter,
    mutate,
  } = useSWR<any>(
    `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${MATERNITY_INPATIENT_ENCOUNTER_TYPE_UUID}&v=full`,
    openmrsFetch,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    },
  );

  // Use the maternity form UUID from config
  const maternityFormUuid = config?.maternityInpatientFormUuid || MATERNITY_INPATIENT_FORM_UUID;

  const openMaternityForm = () => {
    const latestEncounterUuid = latestMaternityEncounter?.uuid ?? '';

    launchWorkspace2(
      'kenyaemr-custom-form-entry-workspace',
      {
        workspaceTitle: t('maternityInpatientForm', 'Maternity Inpatient Form'),
        form: { uuid: maternityFormUuid },
        formUuid: maternityFormUuid,
        encounterTypeUuid: MATERNITY_INPATIENT_ENCOUNTER_TYPE_UUID,
        patientUuid,
        encounterUuid: latestEncounterUuid,
        mutateForm: () => mutate(),
      },
      {
        patient,
        patientUuid,
        encounterUuid: latestEncounterUuid,
        visitContext: null,
      },
    );
  };

  const maternityEncounters = Array.isArray(maternityEncounter?.data?.results) ? maternityEncounter.data.results : [];
  const lookbackCutoff = Date.now() - LCG_MATERNITY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const recentMaternityEncounters = maternityEncounters.filter((encounter: any) => {
    const encounterTime = new Date(encounter?.encounterDatetime).getTime();
    return Number.isFinite(encounterTime) && encounterTime >= lookbackCutoff;
  });

  const latestMaternityEncounter = recentMaternityEncounters.reduce((latest: any | null, current: any) => {
    if (!latest) {
      return current;
    }

    const latestTime = new Date(latest.encounterDatetime).getTime();
    const currentTime = new Date(current.encounterDatetime).getTime();
    return currentTime > latestTime ? current : latest;
  }, null);

  const latestMaternityEncounterObs = Array.isArray(latestMaternityEncounter?.obs) ? latestMaternityEncounter.obs : [];
  const hasMaternityBaselineData =
    latestMaternityEncounterObs.some((o: any) => o?.concept?.uuid === PARITY_CONCEPT_UUID) ||
    latestMaternityEncounterObs.some((o: any) => o?.concept?.uuid === MISCARRIAGE_ABORTIONS_CONCEPT_UUID);

  const parityValue = getEncounterObsNumber(latestMaternityEncounter, PARITY_CONCEPT_UUID);
  const miscarriageValue = getEncounterObsNumber(latestMaternityEncounter, MISCARRIAGE_ABORTIONS_CONCEPT_UUID);
  const gravidaValue = calculateGravida(parityValue, miscarriageValue);
  const parityDisplay = `[${parityValue}, ${miscarriageValue}]`;

  const firstStageTransition = (() => {
    if (!baseTime) {
      return null;
    }

    const transitionCandidates: Array<{ time: string; encounterDatetime: string; slotIndex: number }> = [];

    for (const encounter of cervicalEncounters) {
      const cervicalDilation = parseCervicalDilationValue(
        getEncounterObsValue(encounter, PARTOGRAPHY_CONCEPTS['cervical-dilation']),
      );
      const urgeToPush = parseUrgeToPushValue(getEncounterObsValue(encounter, URGE_TO_PUSH_UUID));

      if (cervicalDilation !== 10 || urgeToPush !== 'yes') {
        continue;
      }

      const time = getEncounterRecordedTime(encounter);
      const slotIndex = getSlotIndexForTime(baseTime, time, activeFirstStageHours.length);
      if (slotIndex === null) {
        continue;
      }

      transitionCandidates.push({
        time,
        encounterDatetime: encounter?.encounterDatetime ?? '',
        slotIndex,
      });
    }

    for (const entry of localLabourProgressEntries) {
      if (entry.cervicalDilation !== 10 || entry.urgeToPush !== 'yes' || !entry.time) {
        continue;
      }

      const slotIndex = getSlotIndexForTime(baseTime, entry.time, activeFirstStageHours.length);
      if (slotIndex === null) {
        continue;
      }

      transitionCandidates.push({
        time: entry.time,
        encounterDatetime: entry.encounterDatetime ?? '',
        slotIndex,
      });
    }

    transitionCandidates.sort((left, right) => {
      if (left.slotIndex !== right.slotIndex) {
        return left.slotIndex - right.slotIndex;
      }

      return new Date(left.encounterDatetime).getTime() - new Date(right.encounterDatetime).getTime();
    });

    if (transitionCandidates.length > 0) {
      return transitionCandidates[0];
    }

    const thresholdHours = gravidaValue === 1 ? 12 : 10;
    const thresholdMinutes = thresholdHours * LCG_TIME_INCREMENT_MINUTES;

    const baseMinutes = (() => {
      const parts = baseTime.split(':');
      if (parts.length !== 2) return null;
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return h * 60 + m;
    })();

    if (baseMinutes === null) return null;

    const MINUTES_IN_DAY = 24 * 60;
    const elapsedMinutes = (nowMinutes - baseMinutes + MINUTES_IN_DAY) % MINUTES_IN_DAY;

    if (elapsedMinutes < thresholdMinutes) {
      return null;
    }

    const thresholdCell = thresholdHours;
    const thresholdSlotIndex = Math.max(0, Math.min(activeFirstStageHours.length - 1, thresholdCell - 1));
    const secondStageStartStepIndex = thresholdSlotIndex + 1;

    return {
      time: addStepsToHHMM(baseTime, secondStageStartStepIndex) ?? baseTime,
      encounterDatetime: '',
      slotIndex: thresholdSlotIndex,
    };
  })();

  const stageAwareWorkflowStopState = React.useMemo(() => {
    if (!effectiveWorkflowStopState || !baseTime) {
      return null;
    }

    const totalSlots = activeFirstStageHours.length + secondStageHours.length;
    const stopSlots = resolveStageAwareStopSlots(
      baseTime,
      effectiveWorkflowStopState.time,
      activeFirstStageHours.length,
      secondStageHours.length,
      firstStageTransition?.time,
      SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
    );

    const actionSlotIndex = stopSlots?.actionSlotIndex ?? effectiveWorkflowStopState.slotIndex;
    const markerSlotIndex = stopSlots?.markerSlotIndex ?? Math.min(actionSlotIndex + 1, totalSlots - 1);

    return {
      ...effectiveWorkflowStopState,
      slotIndex: actionSlotIndex,
      markerSlotIndex,
    };
  }, [baseTime, effectiveWorkflowStopState, firstStageTransition?.time]);

  const stageAwareBirthEvents = React.useMemo(
    () =>
      birthEvents.map((event) => {
        if (!baseTime) {
          return event;
        }

        const stopSlots = resolveStageAwareStopSlots(
          baseTime,
          event.time,
          activeFirstStageHours.length,
          secondStageHours.length,
          firstStageTransition?.time,
          SHARED_DECISION_PLAN_ACTION_SLOT_OPTIONS,
        );

        return stopSlots === null
          ? event
          : {
              ...event,
              slotIndex: stopSlots.actionSlotIndex,
              markerSlotIndex: stopSlots.markerSlotIndex,
            };
      }),
    [baseTime, birthEvents, firstStageTransition?.time],
  );

  const displayDate = admissionDetails.activeLabourDiagnosisDate
    ? `[Date: ${admissionDetails.activeLabourDiagnosisDate}]`
    : '[Date: ]';

  const visibleFirstStageTimeSlotIndices = React.useMemo(() => {
    if (!baseTime) {
      return [];
    }

    const visibleSlots = new Set<number>();
    const addFirstStageTime = (time?: string) => {
      if (!time || (firstStageTransition?.time && time >= firstStageTransition.time)) {
        return;
      }

      const slotIndex = getSlotIndexForTime(baseTime, time, activeFirstStageHours.length);
      if (slotIndex !== null) {
        visibleSlots.add(slotIndex);
      }
    };

    mergedSupportiveCareEntries.forEach((entry) => addFirstStageTime(entry.time));
    mergedBabyEntries.forEach((entry) => addFirstStageTime(entry.time));
    mergedLabourProgressEntries.forEach((entry) => addFirstStageTime(entry.time));
    mergedMedicationEntries.forEach((entry) => addFirstStageTime(entry.time));
    mergedSharedDecisionMakingEntries.forEach((entry) => addFirstStageTime(entry.time));
    womanFormExistingTimeEntries.forEach((entry) => addFirstStageTime(entry.time));

    return Array.from(visibleSlots).sort((left, right) => left - right);
  }, [
    baseTime,
    firstStageTransition?.time,
    mergedBabyEntries,
    mergedLabourProgressEntries,
    mergedMedicationEntries,
    mergedSharedDecisionMakingEntries,
    mergedSupportiveCareEntries,
    womanFormExistingTimeEntries,
  ]);

  const timerSet = Boolean(baseTime);
  const showChartControls = admissionDetailsFilled && timerSet;

  const openEmergencySectionForm = React.useCallback(
    (section: LcgEmergencySectionKey) => {
      switch (section) {
        case 'supportive-care':
          setIsSupportiveCareFormOpen(true);
          break;
        case 'baby':
          setIsBabyFormOpen(true);
          break;
        case 'woman':
          setIsWomanFormOpen(true);
          break;
        case 'labour-progress':
          setIsLabourProgressFormOpen(true);
          break;
        case 'medication':
          setIsMedicationFormOpen(true);
          break;
        case 'shared-decision-making':
          setSharedDecisionAutoPromptSummary(null);
          setIsSharedDecisionMakingFormOpen(true);
          break;
        default:
          break;
      }
    },
    [
      setIsSupportiveCareFormOpen,
      setIsBabyFormOpen,
      setIsWomanFormOpen,
      setIsLabourProgressFormOpen,
      setIsMedicationFormOpen,
      setSharedDecisionAutoPromptSummary,
      setIsSharedDecisionMakingFormOpen,
    ],
  );

  React.useEffect(() => {
    if (!effectiveIsWorkflowStopped) {
      return;
    }

    stopAlertBeep();
    setActiveCdsToast(null);
    setIsSharedDecisionMakingFormOpen(false);
    setSharedDecisionAutoPromptSummary(null);
    setSharedDecisionAutoPromptItems([]);
    setActiveAlertKey(null);
    lastBroadcastKeyRef.current = null;
    alertFirstDetectionTimeRef.current = null;
  }, [
    effectiveIsWorkflowStopped,
    stopAlertBeep,
    setIsSharedDecisionMakingFormOpen,
    setSharedDecisionAutoPromptSummary,
    setSharedDecisionAutoPromptItems,
  ]);

  React.useEffect(() => {
    if (!cdsPendingAlert || isWorkflowStopped) {
      const hasSamePatientActiveAlert =
        activeCdsToast?.sourcePatientUuid === patientUuid ||
        activeAlertKey !== null ||
        Boolean(lastBroadcastKeyRef.current?.startsWith(`${patientUuid}-`));

      if (hasSamePatientActiveAlert || isWorkflowStopped) {
        setActiveCdsToast(null);
        stopAlertBeep();
        lastBroadcastKeyRef.current = null;
      }

      if (isWorkflowStopped || sharedDecisionAutoPromptSummary !== null) {
        setIsSharedDecisionMakingFormOpen(false);
        setSharedDecisionAutoPromptSummary(null);
        setSharedDecisionAutoPromptItems([]);
      }

      alertFirstDetectionTimeRef.current = null;
      setActiveAlertKey(null);
      return;
    }

    const nowMs = Date.now();
    const alertKey = `${patientUuid}-${cdsPendingAlert.triggerTimeMs}-${cdsPendingAlert.summary}`;

    if (alertFirstDetectionTimeRef.current === null || activeAlertKey !== alertKey) {
      alertFirstDetectionTimeRef.current = nowMs;
      setActiveAlertKey(alertKey);
    }

    const activatesAtMs = cdsPendingAlert.activatesAtMs;
    const expiresAtMs = cdsPendingAlert.expiresAtMs;
    if (nowMs >= expiresAtMs) {
      if (lastBroadcastKeyRef.current === alertKey) {
        setActiveCdsToast(null);
        setActiveAlertKey(null);
        alertFirstDetectionTimeRef.current = null;
        lastBroadcastKeyRef.current = null;
      }
      return;
    }
    if (nowMs >= activatesAtMs) {
      if (lastBroadcastKeyRef.current === alertKey) {
        return;
      }

      const payload: CdsAlertBroadcastPayload = {
        type: 'lcg-cds-critical',
        sourcePatientUuid: patientUuid,
        sourcePatientName: currentPatientName,
        triggerTimeMs: cdsPendingAlert.triggerTimeMs,
        expiresAtMs: expiresAtMs,
        activatesAtMs: activatesAtMs,
        summary: cdsPendingAlert.summary,
        items: cdsPendingAlert.items,
      };

      try {
        window.localStorage.setItem(LCG_CDS_ALERT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Storage can be unavailable in restricted browser contexts.
      }

      lastBroadcastKeyRef.current = alertKey;
      setActiveCdsToast(payload);
      setSharedDecisionAutoPromptSummary(payload.summary);
      setSharedDecisionAutoPromptItems(payload.items);
      setIsSharedDecisionMakingFormOpen(true);
      broadcastAlertToGlobalContext({
        ...payload,
        detectedAtMs: Date.now(),
      });
      startAlertBeep();
    }
  }, [
    cdsPendingAlert,
    currentPatientName,
    activeAlertKey,
    activeCdsToast,
    isWorkflowStopped,
    patientUuid,
    sharedDecisionAutoPromptSummary,
    startAlertBeep,
    stopAlertBeep,
    broadcastAlertToGlobalContext,
    setIsSharedDecisionMakingFormOpen,
    setSharedDecisionAutoPromptSummary,
    setSharedDecisionAutoPromptItems,
  ]);

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LCG_CDS_ALERT_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        const payload = JSON.parse(event.newValue) as CdsAlertBroadcastPayload;
        if (!payload || payload.type !== 'lcg-cds-critical') {
          return;
        }

        const nowMs = Date.now();
        if (nowMs < payload.activatesAtMs || nowMs >= payload.expiresAtMs) {
          return;
        }

        if (payload.sourcePatientUuid !== patientUuid) {
          setActiveCdsToast(payload);
          broadcastAlertToGlobalContext({
            ...payload,
            detectedAtMs: nowMs,
          });
          startAlertBeep();
          return;
        }

        setActiveCdsToast(payload);
        setSharedDecisionAutoPromptSummary(payload.summary);
        setSharedDecisionAutoPromptItems(payload.items);
        setIsSharedDecisionMakingFormOpen(true);
        startAlertBeep();
      } catch {
        // Ignore malformed or unavailable cross-tab alert payloads.
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [
    patientUuid,
    startAlertBeep,
    broadcastAlertToGlobalContext,
    setIsSharedDecisionMakingFormOpen,
    setSharedDecisionAutoPromptSummary,
    setSharedDecisionAutoPromptItems,
  ]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sourcePatient = params.get('lcgCdsPatient');
    const triggerTime = params.get('lcgCdsTrigger');
    const summary = params.get('lcgCdsSummary');

    if (!sourcePatient || !triggerTime || !summary) {
      return;
    }

    const routeKey = `${sourcePatient}-${triggerTime}-${summary}`;
    if (lastHandledRouteKeyRef.current === routeKey) {
      return;
    }

    if (sourcePatient !== patientUuid) {
      return;
    }

    const triggerTimeMs = Number(triggerTime) || Date.now();
    const activatesAtMs = triggerTimeMs + LCG_SHARED_DECISION_ALERT_TIMER_MINUTES * 60_000;
    const expiresAtMs = triggerTimeMs + LCG_SHARED_DECISION_PROMPT_HOUR_MINUTES * 60_000;
    const nowMs = Date.now();

    if (nowMs < activatesAtMs || nowMs >= expiresAtMs) {
      params.set(LCG_CDS_ALERT_HANDLED_QUERY_KEY, '1');
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      lastHandledRouteKeyRef.current = routeKey;
      return;
    }

    setSharedDecisionAutoPromptSummary(summary);
    setSharedDecisionAutoPromptItems([]);
    setIsSharedDecisionMakingFormOpen(true);
    setActiveCdsToast({
      type: 'lcg-cds-critical',
      sourcePatientUuid: sourcePatient,
      sourcePatientName: params.get('lcgCdsPatientName') || sourcePatient,
      triggerTimeMs: triggerTimeMs,
      expiresAtMs: expiresAtMs,
      activatesAtMs: activatesAtMs,
      summary,
      items: [],
    });

    params.set(LCG_CDS_ALERT_HANDLED_QUERY_KEY, '1');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    lastHandledRouteKeyRef.current = routeKey;
  }, [
    patientUuid,
    setIsSharedDecisionMakingFormOpen,
    setSharedDecisionAutoPromptItems,
    setSharedDecisionAutoPromptSummary,
  ]);

  React.useEffect(() => {
    if (!activeCdsToast) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs >= activeCdsToast.expiresAtMs) {
      setActiveCdsToast(null);
      setIsSharedDecisionMakingFormOpen(false);
      setSharedDecisionAutoPromptSummary(null);
      setSharedDecisionAutoPromptItems([]);
      stopAlertBeep();
      return;
    }

    const msUntilExpiry = activeCdsToast.expiresAtMs - nowMs;
    const timeoutId = window.setTimeout(() => {
      setActiveCdsToast(null);
      setIsSharedDecisionMakingFormOpen(false);
      setSharedDecisionAutoPromptSummary(null);
      setSharedDecisionAutoPromptItems([]);
      stopAlertBeep();
    }, msUntilExpiry);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeCdsToast,
    stopAlertBeep,
    setIsSharedDecisionMakingFormOpen,
    setSharedDecisionAutoPromptSummary,
    setSharedDecisionAutoPromptItems,
  ]);

  const dismissCdsToast = React.useCallback(() => {
    setActiveCdsToast(null);
    stopAlertBeep();
  }, [stopAlertBeep]);

  if (isLoadingMaternityEncounter) {
    return <InlineLoading description={t('loading', 'Loading...')} />;
  }

  if (!latestMaternityEncounter || !hasMaternityBaselineData) {
    return (
      <div className={styles.container} data-patient-uuid={patientUuid}>
        <div className={styles.canvas}>
          <h2 className={styles.title}>{t('whoLabourCareGuide', 'LABOUR CARE GUIDE')}</h2>
          <div className={styles.formNotFilledNotice}>
            <p>
              {t(
                'completeMaternityInpatientBeforeLabourGuide',
                'Complete the Maternity Inpatient form (recent encounter) before opening the Labour Care Guide.',
              )}
            </p>
            <Button kind="primary" size="sm" onClick={openMaternityForm}>
              {t('openMaternityInpatientForm', 'Open Maternity Inpatient Form')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} data-patient-uuid={patientUuid}>
      <div className={styles.canvas} ref={printableCanvasRef}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <Button
            size="sm"
            kind={isAlertSoundEnabled ? 'secondary' : 'tertiary'}
            onClick={() => setIsAlertSoundEnabled((current) => !current)}>
            {isAlertSoundEnabled ? t('alertSoundOn', 'Alert Sound: ON') : t('alertSoundOff', 'Alert Sound: OFF')}
          </Button>
        </div>
        <h2 className={styles.title}>{t('whoLabourCareGuide', 'LABOUR CARE GUIDE')}</h2>

        <LabourCareGuideSummaryHeader
          patient={patient}
          patientAge={patientAge}
          parityDisplay={parityDisplay}
          labourOnsetDisplay={labourOnsetDisplay}
          displayDate={displayDate}
          ruptureDisplay={ruptureDisplay}
          riskFactors={admissionDetails.riskFactors}
          gravidaValue={gravidaValue}
          admissionDetailsFilled={admissionDetailsFilled}
          onAddAdmissionDetails={() => setIsAdmissionDetailsFormOpen(true)}
        />

        <LabourCareGuideHeader
          activeFirstStageHours={activeFirstStageHours}
          secondStageHours={secondStageHours}
          onAddClick={
            admissionDetailsFilled && !timerSet && !effectiveIsWorkflowStopped
              ? () => setIsTimeFormOpen(true)
              : undefined
          }
          baseTime={baseTime ?? undefined}
          firstStageCutoffSlotIndex={firstStageTransition?.slotIndex}
          visibleFirstStageTimeSlotIndices={visibleFirstStageTimeSlotIndices}
          secondStageStartTime={firstStageTransition?.time}
          stopSlotIndex={stageAwareWorkflowStopState?.slotIndex}
          stopMarkerSlotIndex={stageAwareWorkflowStopState?.markerSlotIndex}
          stopTime={stageAwareWorkflowStopState?.time}
        />

        <SupportiveCare
          activeFirstStageHours={activeFirstStageHours}
          secondStageHours={secondStageHours}
          showViewToggle={showChartControls}
          onAddClick={
            admissionDetailsFilled && timerSet && !effectiveIsWorkflowStopped
              ? () => setIsSupportiveCareFormOpen(true)
              : undefined
          }
          baseTime={baseTime ?? undefined}
          entries={mergedSupportiveCareEntries}
          firstStageCutoffSlotIndex={firstStageTransition?.slotIndex}
          secondStageStartTime={firstStageTransition?.time}
          stopSlotIndex={stageAwareWorkflowStopState?.slotIndex}
          stopMarkerSlotIndex={stageAwareWorkflowStopState?.markerSlotIndex}
          stopLabel={stageAwareWorkflowStopState?.label}
        />

        {!isMultipleGestation ? (
          <Baby
            activeFirstStageHours={activeFirstStageHours}
            secondStageHours={secondStageHours}
            showViewToggle={showChartControls}
            onAddClick={
              admissionDetailsFilled && timerSet && !effectiveIsWorkflowStopped
                ? () => {
                    setActiveBabyTwinIndex(1);
                    setIsBabyFormOpen(true);
                  }
                : undefined
            }
            baseTime={baseTime ?? undefined}
            entries={mergedBabyEntries}
            firstStageCutoffSlotIndex={firstStageTransition?.slotIndex}
            secondStageStartTime={firstStageTransition?.time}
            stopSlotIndex={stageAwareWorkflowStopState?.slotIndex}
            stopMarkerSlotIndex={stageAwareWorkflowStopState?.markerSlotIndex}
          />
        ) : (
          <>
            {Array.from({ length: totalTwinSections }, (_, idx) => idx + 1).map((twinIndex) => {
              const twinEntries = babyEntriesByTwin.get(twinIndex) ?? [];
              const twinBirthEvent = stageAwareBirthEvents[twinIndex - 1];
              const isTwinDelivered = deliveredTwinsSet.has(twinIndex);
              const isTwinBorn = stageAwareBirthEvents.length >= twinIndex;

              return (
                <Baby
                  key={`twin-section-${twinIndex}`}
                  activeFirstStageHours={activeFirstStageHours}
                  secondStageHours={secondStageHours}
                  showViewToggle={showChartControls}
                  onAddClick={
                    admissionDetailsFilled && timerSet && !effectiveIsWorkflowStopped && !isTwinDelivered
                      ? () => {
                          setActiveBabyTwinIndex(twinIndex);
                          setIsBabyFormOpen(true);
                        }
                      : undefined
                  }
                  baseTime={baseTime ?? undefined}
                  entries={twinEntries}
                  firstStageCutoffSlotIndex={firstStageTransition?.slotIndex}
                  secondStageStartTime={firstStageTransition?.time}
                  stopSlotIndex={stageAwareWorkflowStopState?.slotIndex}
                  stopMarkerSlotIndex={stageAwareWorkflowStopState?.markerSlotIndex}
                  fetalStopSlotIndex={isTwinDelivered ? (twinBirthEvent?.slotIndex ?? -1) : twinBirthEvent?.slotIndex}
                  sectionLabel={`Twin ${twinIndex}`}
                  showLowerRows={twinIndex === 1}
                  showBirthLabel={isTwinDelivered || isTwinBorn}
                />
              );
            })}

            {totalTwinSections < 2 ? (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => setTwinSectionCount(2)}
                  disabled={effectiveIsWorkflowStopped}>
                  <span>{t('addTwin', 'Add Twin 2')}</span>
                  <span className={styles.addDivider} />
                  <Add size={16} />
                </button>
              </div>
            ) : null}
          </>
        )}

        <Woman
          patientUuid={patientUuid}
          activeFirstStageHours={activeFirstStageHours}
          secondStageHours={secondStageHours}
          showViewToggle={showChartControls}
          onAddClick={
            admissionDetailsFilled && timerSet && !effectiveIsWorkflowStopped
              ? () => setIsWomanFormOpen(true)
              : undefined
          }
          baseTime={baseTime ?? undefined}
          localEntries={localWomanEntries}
          firstStageCutoffSlotIndex={firstStageTransition?.slotIndex}
          secondStageStartTime={firstStageTransition?.time}
          stopSlotIndex={stageAwareWorkflowStopState?.slotIndex}
        />

        <LabourProgress
          patientUuid={patientUuid}
          activeFirstStageHours={activeFirstStageHours}
          secondStageHours={secondStageHours}
          showViewToggle={showChartControls}
          parityValue={parityValue}
          baseTime={baseTime ?? undefined}
          refreshToken={labourProgressRefreshToken}
          entries={localLabourProgressEntries}
          onContractionsAddClick={
            admissionDetailsFilled && timerSet && !effectiveIsWorkflowStopped
              ? () => setIsContractionsFormOpen(true)
              : undefined
          }
          onLabourProgressAddClick={
            admissionDetailsFilled && timerSet && !effectiveIsWorkflowStopped
              ? () => setIsLabourProgressFormOpen(true)
              : undefined
          }
          firstStageCutoffSlotIndex={firstStageTransition?.slotIndex}
          secondStageStartTime={firstStageTransition?.time}
          stopSlotIndex={stageAwareWorkflowStopState?.slotIndex}
        />

        <Medication
          activeFirstStageHours={activeFirstStageHours}
          secondStageHours={secondStageHours}
          showViewToggle={showChartControls}
          onAddClick={
            admissionDetailsFilled && timerSet && !effectiveIsWorkflowStopped
              ? () => setIsMedicationFormOpen(true)
              : undefined
          }
          baseTime={baseTime ?? undefined}
          entries={mergedMedicationEntries}
          firstStageCutoffSlotIndex={firstStageTransition?.slotIndex}
          secondStageStartTime={firstStageTransition?.time}
          stopSlotIndex={stageAwareWorkflowStopState?.slotIndex}
        />

        <SharedDecisionMaking
          activeFirstStageHours={activeFirstStageHours}
          secondStageHours={secondStageHours}
          showViewToggle={showChartControls}
          onAddClick={
            admissionDetailsFilled && timerSet && !effectiveIsWorkflowStopped
              ? () => {
                  setSharedDecisionAutoPromptSummary(null);
                  setIsSharedDecisionMakingFormOpen(true);
                }
              : undefined
          }
          firstStageCutoffSlotIndex={firstStageTransition?.slotIndex}
          baseTime={baseTime ?? undefined}
          entries={mergedSharedDecisionMakingEntries}
          secondStageStartTime={firstStageTransition?.time}
          stopSlotIndex={stageAwareWorkflowStopState?.slotIndex}
        />

        {showChartControls ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" className={styles.addButton} data-export-hide="true" onClick={downloadPdf}>
              {t('downloadPdf', 'Download PDF')}
            </button>
            {!effectiveIsWorkflowStopped ? (
              <button
                type="button"
                className={styles.addButton}
                style={{ backgroundColor: '#da1e28', borderColor: '#da1e28', color: '#ffffff' }}
                onClick={() => setIsEmergencyModalOpen(true)}>
                {t('emergency', 'Emergency')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <LabourCareGuideForms
        patient={patient}
        patientUuid={patientUuid}
        isTimeFormOpen={isTimeFormOpen}
        setIsTimeFormOpen={setIsTimeFormOpen}
        isSupportiveCareFormOpen={isSupportiveCareFormOpen}
        setIsSupportiveCareFormOpen={setIsSupportiveCareFormOpen}
        isBabyFormOpen={isBabyFormOpen}
        setIsBabyFormOpen={setIsBabyFormOpen}
        isWomanFormOpen={isWomanFormOpen}
        setIsWomanFormOpen={setIsWomanFormOpen}
        isContractionsFormOpen={isContractionsFormOpen}
        setIsContractionsFormOpen={setIsContractionsFormOpen}
        isLabourProgressFormOpen={isLabourProgressFormOpen}
        setIsLabourProgressFormOpen={setIsLabourProgressFormOpen}
        isMedicationFormOpen={isMedicationFormOpen}
        setIsMedicationFormOpen={setIsMedicationFormOpen}
        isSharedDecisionMakingFormOpen={isSharedDecisionMakingFormOpen}
        setIsSharedDecisionMakingFormOpen={setIsSharedDecisionMakingFormOpen}
        isAdmissionDetailsFormOpen={isAdmissionDetailsFormOpen}
        setIsAdmissionDetailsFormOpen={setIsAdmissionDetailsFormOpen}
        baseTime={baseTime}
        firstStageTransition={firstStageTransition}
        mergedSupportiveCareEntries={mergedSupportiveCareEntries}
        mergedBabyEntries={mergedBabyEntries}
        mergedMedicationEntries={mergedMedicationEntries}
        mergedLabourProgressEntries={mergedLabourProgressEntries}
        mergedSharedDecisionMakingEntries={mergedSharedDecisionMakingEntries}
        womanFormExistingTimeEntries={womanFormExistingTimeEntries}
        setLocalSupportiveCareEntries={setLocalSupportiveCareEntries}
        setLocalBabyEntries={setLocalBabyEntries}
        setLocalWomanEntries={setLocalWomanEntries}
        setLocalMedicationEntries={setLocalMedicationEntries}
        setLocalSharedDecisionMakingEntries={setLocalSharedDecisionMakingEntries}
        setAdmissionDetails={setAdmissionDetails}
        sharedDecisionAutoPromptSummary={sharedDecisionAutoPromptSummary}
        setSharedDecisionAutoPromptSummary={setSharedDecisionAutoPromptSummary}
        sharedDecisionAutoPromptItems={sharedDecisionAutoPromptItems}
        setSharedDecisionAutoPromptItems={setSharedDecisionAutoPromptItems}
        activeSharedDecisionAlerts={activeSharedDecisionAlerts}
        sharedDecisionAutoPromptDebugWindow={sharedDecisionAutoPromptDebugWindow}
        onSharedDecisionFormInteraction={stopAlertBeep}
        handleWomanFormSubmit={handleWomanFormSubmit}
        handleLabourProgressFormSubmit={handleLabourProgressFormSubmit}
        mutateLabourTimeSetData={mutateLabourTimeSetData}
        mutateSupportiveCareData={mutateSupportiveCareData}
        mutateBabyData={mutateBabyData}
        mutateMedicationData={mutateMedicationData}
        mutateSharedDecisionMakingData={mutateSharedDecisionMakingData}
        mutateAdmissionDetails={mutateAdmissionDetails}
        emergencyReason={emergencyReason}
        emergencySection={emergencySection}
        clearEmergencyContext={() => {
          setEmergencyReason(null);
          setEmergencySection(null);
        }}
        activeBabyTwinIndex={activeBabyTwinIndex}
        activeBabyShowLowerFields={
          activeBabyTwinIndex === 1 || (isMultipleGestation && hasTwinOneBirthRecorded && activeBabyTwinIndex === 2)
        }
        activeBabyLockUpperFields={isMultipleGestation && deliveredTwinsSet.has(activeBabyTwinIndex)}
        isMultipleGestation={isMultipleGestation}
        hasTwinOneBirthRecorded={hasTwinOneBirthRecorded}
      />

      <EmergencyEntryModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        onContinue={({ section, reason }) => {
          setIsEmergencyModalOpen(false);
          setEmergencySection(section);
          setEmergencyReason(reason);
          openEmergencySectionForm(section);
        }}
      />
    </div>
  );
};

const LabourCareGuideWithProvider: React.FC<LabourCareGuideProps> = (props) => (
  <GlobalCdsAlertProvider>
    <GlobalCdsAlertDisplay />
    <LabourCareGuide {...props} />
  </GlobalCdsAlertProvider>
);

export default LabourCareGuideWithProvider;
