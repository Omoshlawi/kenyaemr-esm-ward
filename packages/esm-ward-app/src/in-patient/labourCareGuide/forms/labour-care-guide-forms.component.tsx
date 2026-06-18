import React from 'react';
import { useTranslation } from 'react-i18next';
import { getPatientName } from '@openmrs/esm-framework';
import {
  TimeForm,
  SupportiveCareForm,
  BabyForm,
  WomanForm,
  ContractionsForm,
  LabourProgressForm,
  MedicationForm,
  SharedDecisionMakingForm,
  AdmissionDetailsForm,
} from './index';
import type { SupportiveCareFormProps } from './supportive-care-form.component';
import type { BabyEntry } from '../graphs/baby.component';
import type { WomanLocalEntry } from '../graphs/woman.component';
import type { LabourProgressEntry } from '../graphs/labour-progress.component';
import type { MedicationEntry } from '../resources/medication.resource';
import type { SupportiveCareEntry } from '../resources/supportive-care.resource';
import {
  normalizeSharedDecisionMakingAction,
  type SharedDecisionMakingEntry,
} from '../resources/shared-decision-making.resource';
import type { LabourProgressFormData } from './labour-progress-form.component';
import { SUPPORTIVE_CARE_CODED_VALUES, type LcgEmergencySectionKey } from '../types';
import { activeFirstStageHours, secondStageHours } from '../labour-care-guide.utils';
import type { SharedDecisionAlertItem } from '../alert-rules';

type AdmissionDetailsState = {
  labourOnset: string;
  activeLabourDiagnosisDate: string;
  rupturedMembranes: string;
  rupturedMembranesDate: string;
  rupturedMembranesTime: string;
  riskFactors: string;
  riskFactorOtherText: string;
  ipNumber: string;
};

export type LabourCareGuideFormsProps = {
  // patient
  patient: any;
  patientUuid: string;

  // open / close state
  isTimeFormOpen: boolean;
  setIsTimeFormOpen: (value: boolean) => void;
  isSupportiveCareFormOpen: boolean;
  setIsSupportiveCareFormOpen: (value: boolean) => void;
  isBabyFormOpen: boolean;
  setIsBabyFormOpen: (value: boolean) => void;
  isWomanFormOpen: boolean;
  setIsWomanFormOpen: (value: boolean) => void;
  isContractionsFormOpen: boolean;
  setIsContractionsFormOpen: (value: boolean) => void;
  isLabourProgressFormOpen: boolean;
  setIsLabourProgressFormOpen: (value: boolean) => void;
  isMedicationFormOpen: boolean;
  setIsMedicationFormOpen: (value: boolean) => void;
  isSharedDecisionMakingFormOpen: boolean;
  setIsSharedDecisionMakingFormOpen: (value: boolean) => void;
  isAdmissionDetailsFormOpen: boolean;
  setIsAdmissionDetailsFormOpen: (value: boolean) => void;

  // shared time / stage data
  baseTime: string | null | undefined;
  firstStageTransition: { time: string; encounterDatetime: string; slotIndex: number } | null | undefined;

  // merged entry lists
  mergedSupportiveCareEntries: SupportiveCareEntry[];
  mergedBabyEntries: BabyEntry[];
  mergedMedicationEntries: MedicationEntry[];
  mergedLabourProgressEntries: LabourProgressEntry[];
  mergedSharedDecisionMakingEntries: SharedDecisionMakingEntry[];
  womanFormExistingTimeEntries: Array<{ hour: number; time: string }>;

  // local entry setters
  setLocalSupportiveCareEntries: React.Dispatch<React.SetStateAction<SupportiveCareEntry[]>>;
  setLocalBabyEntries: React.Dispatch<React.SetStateAction<BabyEntry[]>>;
  setLocalWomanEntries: React.Dispatch<React.SetStateAction<WomanLocalEntry[]>>;
  setLocalMedicationEntries: React.Dispatch<React.SetStateAction<MedicationEntry[]>>;
  setLocalSharedDecisionMakingEntries: React.Dispatch<React.SetStateAction<SharedDecisionMakingEntry[]>>;

  // admission details
  setAdmissionDetails: React.Dispatch<React.SetStateAction<AdmissionDetailsState>>;

  // shared decision auto-prompt
  sharedDecisionAutoPromptSummary: string | null;
  setSharedDecisionAutoPromptSummary: (value: string | null) => void;
  sharedDecisionAutoPromptItems: Array<SharedDecisionAlertItem>;
  setSharedDecisionAutoPromptItems: (value: Array<SharedDecisionAlertItem>) => void;
  activeSharedDecisionAlerts: Array<SharedDecisionAlertItem>;
  sharedDecisionAutoPromptDebugWindow:
    | { triggerTimeMs: number; openAtMs: number | null; expiresAtMs: number }
    | undefined;
  onSharedDecisionFormInteraction?: () => void;
  onSharedDecisionAlertSessionAcknowledged?: (entry: SharedDecisionMakingEntry) => void;

  // complex submit callbacks
  handleWomanFormSubmit: (
    data: {
      time: string;
      pulse: string;
      systolicBp: string;
      diastolicBp: string;
      temperature: string;
      protein: string;
      acetone: string;
    },
    options?: { emergencyReason?: string },
  ) => Promise<void>;
  handleLabourProgressFormSubmit: (
    data: LabourProgressFormData,
    options?: { emergencyReason?: string },
  ) => Promise<void>;

  // mutate / refetch callbacks
  mutateLabourTimeSetData: () => void;
  mutateSupportiveCareData: () => void;
  mutateBabyData: () => void;
  mutateMedicationData: () => void;
  mutateSharedDecisionMakingData: () => void;
  mutateAdmissionDetails: () => void;

  // emergency override context
  emergencyReason: string | null;
  emergencySection: LcgEmergencySectionKey | null;
  clearEmergencyContext: () => void;

  // active baby twin context
  activeBabyTwinIndex: number;
  activeBabyShowLowerFields: boolean;
  activeBabyLockUpperFields: boolean;
  isMultipleGestation: boolean;
  hasTwinOneBirthRecorded: boolean;
};

export const LabourCareGuideForms: React.FC<LabourCareGuideFormsProps> = ({
  patient,
  patientUuid,
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
  isAdmissionDetailsFormOpen,
  setIsAdmissionDetailsFormOpen,
  baseTime,
  firstStageTransition,
  mergedSupportiveCareEntries,
  mergedBabyEntries,
  mergedMedicationEntries,
  mergedLabourProgressEntries,
  mergedSharedDecisionMakingEntries,
  womanFormExistingTimeEntries,
  setLocalSupportiveCareEntries,
  setLocalBabyEntries,
  setLocalWomanEntries,
  setLocalMedicationEntries,
  setLocalSharedDecisionMakingEntries,
  setAdmissionDetails,
  sharedDecisionAutoPromptSummary,
  setSharedDecisionAutoPromptSummary,
  sharedDecisionAutoPromptItems,
  setSharedDecisionAutoPromptItems,
  activeSharedDecisionAlerts,
  sharedDecisionAutoPromptDebugWindow,
  onSharedDecisionFormInteraction,
  onSharedDecisionAlertSessionAcknowledged,
  handleWomanFormSubmit,
  handleLabourProgressFormSubmit,
  mutateLabourTimeSetData,
  mutateSupportiveCareData,
  mutateBabyData,
  mutateMedicationData,
  mutateSharedDecisionMakingData,
  mutateAdmissionDetails,
  emergencyReason,
  emergencySection,
  clearEmergencyContext,
  activeBabyTwinIndex,
  activeBabyShowLowerFields,
  activeBabyLockUpperFields,
  isMultipleGestation,
  hasTwinOneBirthRecorded,
}) => {
  const { t } = useTranslation();

  const supportiveCodeToDisplay = React.useMemo<Record<string, string>>(
    () => ({
      [SUPPORTIVE_CARE_CODED_VALUES.YES]: 'Y',
      [SUPPORTIVE_CARE_CODED_VALUES.NO]: 'N',
      [SUPPORTIVE_CARE_CODED_VALUES.DECLINED]: 'D',
      [SUPPORTIVE_CARE_CODED_VALUES.SUPINE]: 'SP',
      [SUPPORTIVE_CARE_CODED_VALUES.MOBILE]: 'MO',
    }),
    [],
  );

  const sharedDecisionFormAlerts = React.useMemo(() => {
    const byKey = new Map<string, SharedDecisionAlertItem>();

    for (const item of activeSharedDecisionAlerts) {
      byKey.set(item.id ?? `${item.section}|${item.code}|${item.timestampCreatedMs ?? ''}`, item);
    }

    for (const item of sharedDecisionAutoPromptItems) {
      byKey.set(item.id ?? `${item.section}|${item.code}|${item.timestampCreatedMs ?? ''}`, item);
    }

    const sectionOrder = ['Supportive Care', 'Baby', 'Woman', 'Labour Progress'];
    return Array.from(byKey.values()).sort((left, right) => {
      const leftIndex = sectionOrder.indexOf(left.section);
      const rightIndex = sectionOrder.indexOf(right.section);
      const normalizedLeft = leftIndex === -1 ? sectionOrder.length : leftIndex;
      const normalizedRight = rightIndex === -1 ? sectionOrder.length : rightIndex;

      if (normalizedLeft !== normalizedRight) {
        return normalizedLeft - normalizedRight;
      }

      return left.code.localeCompare(right.code);
    });
  }, [activeSharedDecisionAlerts, sharedDecisionAutoPromptItems]);

  const slotCount = activeFirstStageHours.length + secondStageHours.length;
  const firstStageSlotCount = activeFirstStageHours.length;
  const secondStageSlotCount = secondStageHours.length;
  const routesTwinTwoMaternalDataToTwinOne =
    isMultipleGestation && hasTwinOneBirthRecorded && activeBabyTwinIndex === 2;
  const activeBabyFormExistingEntries = React.useMemo(() => {
    const activeTwinEntries = mergedBabyEntries.filter((entry) => (entry.twinIndex ?? 1) === activeBabyTwinIndex);

    if (!routesTwinTwoMaternalDataToTwinOne) {
      return activeTwinEntries;
    }

    const twinOneMaternalEntries = mergedBabyEntries.filter(
      (entry) =>
        (entry.twinIndex ?? 1) === 1 &&
        Boolean(entry.amnioticFluid || entry.fetalPosition || entry.caput || entry.moulding),
    );

    return [...activeTwinEntries, ...twinOneMaternalEntries];
  }, [activeBabyTwinIndex, mergedBabyEntries, routesTwinTwoMaternalDataToTwinOne]);

  const patientInfo = patient
    ? {
        uuid: (patient as any).id,
        name: getPatientName(patient),
        gender: patient.gender,
        age: String((patient as any).age),
      }
    : undefined;

  return (
    <>
      {isTimeFormOpen ? (
        <TimeForm
          isOpen={isTimeFormOpen}
          onClose={() => setIsTimeFormOpen(false)}
          onSubmit={() => {
            setIsTimeFormOpen(false);
            mutateLabourTimeSetData();
          }}
          onDataSaved={() => mutateLabourTimeSetData()}
          patient={
            patientUuid
              ? {
                  uuid: patientUuid,
                  name: patient ? getPatientName(patient) : '',
                  gender: patient?.gender ?? '',
                  age: '',
                }
              : undefined
          }
        />
      ) : null}

      {isSupportiveCareFormOpen ? (
        <SupportiveCareForm
          {...({
            isOpen: isSupportiveCareFormOpen,
            onClose: () => setIsSupportiveCareFormOpen(false),
            onSubmit: (data) => {
              const timestamp = new Date().toISOString();
              const isEmergencyEntry = emergencySection === 'supportive-care' && Boolean(emergencyReason);
              setLocalSupportiveCareEntries((prev) => [
                ...prev,
                {
                  id: `supportive-local-${timestamp}`,
                  encounterUuid: `supportive-local-${timestamp}`,
                  encounterDatetime: timestamp,
                  time: data.time,
                  companion: supportiveCodeToDisplay[data.companion] ?? data.companion,
                  painRelief: supportiveCodeToDisplay[data.painRelief] ?? data.painRelief,
                  oralFluid: supportiveCodeToDisplay[data.oralFluid] ?? data.oralFluid,
                  posture: supportiveCodeToDisplay[data.posture] ?? data.posture,
                  isEmergency: isEmergencyEntry,
                  emergencyReason: isEmergencyEntry ? (emergencyReason ?? '') : undefined,
                },
              ]);
              setIsSupportiveCareFormOpen(false);
            },
            onDataSaved: () => mutateSupportiveCareData(),
            existingTimeEntries: mergedSupportiveCareEntries.map((entry, index) => ({
              hour: index + 1,
              time: entry.time,
            })),
            baseTime: baseTime ?? undefined,
            slotCount,
            firstStageSlotCount,
            secondStageSlotCount,
            secondStageStartTime: firstStageTransition?.time,
            patient: patientInfo,
            isEmergencyMode: emergencySection === 'supportive-care' && Boolean(emergencyReason),
            emergencyReason: emergencySection === 'supportive-care' ? (emergencyReason ?? undefined) : undefined,
          } satisfies SupportiveCareFormProps)}
        />
      ) : null}

      {isBabyFormOpen ? (
        <BabyForm
          isOpen={isBabyFormOpen}
          onClose={() => setIsBabyFormOpen(false)}
          onSubmit={(data) => {
            const timestamp = new Date().toISOString();
            const isEmergencyEntry = emergencySection === 'baby' && Boolean(emergencyReason);
            const hasUpperInput = Boolean(data.baselineFhr || data.fhrDeceleration);
            const hasLowerInput = Boolean(data.amnioticFluid || data.fetalPosition || data.caput || data.moulding);
            const localEntries: BabyEntry[] = [];

            if (!routesTwinTwoMaternalDataToTwinOne || hasUpperInput) {
              localEntries.push({
                id: `baby-local-${timestamp}`,
                encounterDatetime: timestamp,
                time: data.time,
                twinIndex: activeBabyTwinIndex,
                baselineFhr: data.baselineFhr,
                fhrDeceleration: data.fhrDeceleration,
                amnioticFluid: routesTwinTwoMaternalDataToTwinOne ? '' : data.amnioticFluid,
                fetalPosition: routesTwinTwoMaternalDataToTwinOne ? '' : data.fetalPosition,
                caput: routesTwinTwoMaternalDataToTwinOne ? '' : data.caput,
                moulding: routesTwinTwoMaternalDataToTwinOne ? '' : data.moulding,
                isEmergency: isEmergencyEntry,
                emergencyReason: isEmergencyEntry ? (emergencyReason ?? '') : undefined,
              });
            }

            if (routesTwinTwoMaternalDataToTwinOne && hasLowerInput) {
              localEntries.push({
                id: `baby-local-maternal-${timestamp}`,
                encounterDatetime: timestamp,
                time: data.time,
                twinIndex: 1,
                baselineFhr: '',
                fhrDeceleration: '',
                amnioticFluid: data.amnioticFluid,
                fetalPosition: data.fetalPosition,
                caput: data.caput,
                moulding: data.moulding,
                isEmergency: isEmergencyEntry,
                emergencyReason: isEmergencyEntry ? (emergencyReason ?? '') : undefined,
              });
            }

            setLocalBabyEntries((prev) => [...prev, ...localEntries]);
            setIsBabyFormOpen(false);
          }}
          onDataSaved={() => mutateBabyData()}
          existingEntries={activeBabyFormExistingEntries}
          existingTimeEntries={activeBabyFormExistingEntries.map((entry, index) => ({
            hour: index + 1,
            time: entry.time,
          }))}
          baseTime={baseTime ?? undefined}
          slotCount={slotCount}
          firstStageSlotCount={firstStageSlotCount}
          secondStageSlotCount={secondStageSlotCount}
          secondStageStartTime={firstStageTransition?.time}
          patient={patientInfo}
          twinIndex={activeBabyTwinIndex}
          lowerFieldsTwinIndex={routesTwinTwoMaternalDataToTwinOne ? 1 : activeBabyTwinIndex}
          showLowerFields={activeBabyShowLowerFields}
          lockUpperFields={activeBabyLockUpperFields}
          isEmergencyMode={emergencySection === 'baby' && Boolean(emergencyReason)}
          emergencyReason={emergencySection === 'baby' ? (emergencyReason ?? undefined) : undefined}
        />
      ) : null}

      {isWomanFormOpen ? (
        <WomanForm
          isOpen={isWomanFormOpen}
          onClose={() => setIsWomanFormOpen(false)}
          onSubmit={async (data) => {
            const recordedAt = new Date().toISOString();
            const isEmergencyEntry = emergencySection === 'woman' && Boolean(emergencyReason);
            const optimisticEntry: WomanLocalEntry = {
              time: data.time,
              recordedAt,
              pulse: data.pulse || undefined,
              systolicBp: data.systolicBp || undefined,
              diastolicBp: data.diastolicBp || undefined,
              temperature: data.temperature || undefined,
              protein: data.protein || undefined,
              acetone: data.acetone || undefined,
              isEmergency: isEmergencyEntry,
              emergencyReason: isEmergencyEntry ? (emergencyReason ?? '') : undefined,
            };
            setLocalWomanEntries((prev) => [...prev, optimisticEntry]);
            try {
              await handleWomanFormSubmit(data, {
                emergencyReason: emergencySection === 'woman' ? (emergencyReason ?? undefined) : undefined,
              });
              setIsWomanFormOpen(false);
            } catch (error) {
              setLocalWomanEntries((prev) => prev.filter((entry) => entry.recordedAt !== recordedAt));
              throw error;
            }
          }}
          existingTimeEntries={womanFormExistingTimeEntries}
          baseTime={baseTime ?? undefined}
          slotCount={slotCount}
          firstStageSlotCount={firstStageSlotCount}
          secondStageSlotCount={secondStageSlotCount}
          secondStageStartTime={firstStageTransition?.time}
          patient={patientInfo}
          isEmergencyMode={emergencySection === 'woman' && Boolean(emergencyReason)}
          emergencyReason={emergencySection === 'woman' ? (emergencyReason ?? undefined) : undefined}
        />
      ) : null}

      {isContractionsFormOpen ? (
        <ContractionsForm
          isOpen={isContractionsFormOpen}
          onClose={() => setIsContractionsFormOpen(false)}
          onSubmit={(data) => {
            setIsContractionsFormOpen(false);
          }}
          patient={patientInfo}
        />
      ) : null}

      {isLabourProgressFormOpen ? (
        <LabourProgressForm
          isOpen={isLabourProgressFormOpen}
          onClose={() => setIsLabourProgressFormOpen(false)}
          onSubmit={async (data) => {
            await handleLabourProgressFormSubmit(data, {
              emergencyReason: emergencySection === 'labour-progress' ? (emergencyReason ?? undefined) : undefined,
            });
            setIsLabourProgressFormOpen(false);
          }}
          existingTimeEntries={mergedLabourProgressEntries
            .filter((entry) => Boolean(entry.time))
            .map((entry, index) => ({
              hour: index + 1,
              time: entry.time as string,
            }))}
          baseTime={baseTime ?? undefined}
          secondStageStartTime={firstStageTransition?.time}
          slotCount={slotCount}
          existingLabourProgressFormData={mergedLabourProgressEntries}
          patient={patientInfo}
          isEmergencyMode={emergencySection === 'labour-progress' && Boolean(emergencyReason)}
          emergencyReason={emergencySection === 'labour-progress' ? (emergencyReason ?? undefined) : undefined}
        />
      ) : null}

      {isMedicationFormOpen ? (
        <MedicationForm
          isOpen={isMedicationFormOpen}
          onClose={() => setIsMedicationFormOpen(false)}
          onSubmit={(data) => {
            const timestamp = new Date().toISOString();
            const isEmergencyEntry = emergencySection === 'medication' && Boolean(emergencyReason);
            const oxytocinUnitsValue =
              data.oxytocinUsed === 'yes' && data.oxytocinUnitsPerLitre !== ''
                ? Number(data.oxytocinUnitsPerLitre)
                : undefined;
            const oxytocinDropsValue =
              data.oxytocinUsed === 'yes' && data.oxytocinDropsPerMinute !== ''
                ? Number(data.oxytocinDropsPerMinute)
                : undefined;
            setLocalMedicationEntries((prev) => [
              ...prev,
              {
                id: `medication-local-${timestamp}`,
                encounterUuid: `medication-local-${timestamp}`,
                encounterDatetime: timestamp,
                time: data.time,
                oxytocin: data.oxytocinUsed === 'yes' ? 'Y' : 'N',
                medicine: data.medicine === 'yes' ? 'Y' : 'N',
                ivFluids: data.ivFluids === 'yes' ? 'Y' : 'N',
                oxytocinU_L: oxytocinUnitsValue,
                oxytocinDrops: oxytocinDropsValue,
                drugName: data.medicine === 'yes' ? data.drug : undefined,
                dosage: data.medicine === 'yes' ? data.dosage : undefined,
                route: data.medicine === 'yes' ? data.route : undefined,
                isEmergency: isEmergencyEntry,
                emergencyReason: isEmergencyEntry ? (emergencyReason ?? '') : undefined,
              },
            ]);
            setIsMedicationFormOpen(false);
          }}
          onDataSaved={() => mutateMedicationData()}
          existingTimeEntries={mergedMedicationEntries
            .filter((entry) => Boolean(entry.time))
            .map((entry, index) => ({
              hour: index + 1,
              time: entry.time,
            }))}
          baseTime={baseTime ?? undefined}
          slotCount={slotCount}
          firstStageSlotCount={firstStageSlotCount}
          secondStageSlotCount={secondStageSlotCount}
          secondStageStartTime={firstStageTransition?.time}
          isEmergencyMode={emergencySection === 'medication' && Boolean(emergencyReason)}
          emergencyReason={emergencySection === 'medication' ? (emergencyReason ?? undefined) : undefined}
          patient={
            patient
              ? {
                  uuid: (patient as any).id,
                  name: getPatientName(patient),
                }
              : undefined
          }
        />
      ) : null}

      {isSharedDecisionMakingFormOpen ? (
        <SharedDecisionMakingForm
          isOpen={isSharedDecisionMakingFormOpen}
          onClose={() => {
            onSharedDecisionFormInteraction?.();
            setIsSharedDecisionMakingFormOpen(false);
            setSharedDecisionAutoPromptSummary(null);
            setSharedDecisionAutoPromptItems([]);
          }}
          onSubmit={(data) => {
            const timestamp = new Date().toISOString();
            const isEmergencyEntry = emergencySection === 'shared-decision-making' && Boolean(emergencyReason);
            const entryTime =
              data.time && baseTime
                ? (() => {
                    const [hours, minutes] = data.time.split(':').map(Number);
                    const date = new Date();
                    date.setHours(hours, minutes, 0, 0);
                    return date.toISOString();
                  })()
                : timestamp;

            const submittedEntry: SharedDecisionMakingEntry = {
              id: `shared-decision-local-${timestamp}`,
              encounterUuid: `shared-decision-local-${timestamp}`,
              encounterDatetime: entryTime,
              assessment: data.assessment,
              plan: data.plan,
              action: normalizeSharedDecisionMakingAction(data.action),
              time: data.time,
              isEmergency: isEmergencyEntry,
              emergencyReason: isEmergencyEntry ? (emergencyReason ?? '') : undefined,
            };

            setLocalSharedDecisionMakingEntries((prev) => [...prev, submittedEntry]);
            onSharedDecisionAlertSessionAcknowledged?.(submittedEntry);
            onSharedDecisionFormInteraction?.();
            setIsSharedDecisionMakingFormOpen(false);
          }}
          onDataSaved={() => mutateSharedDecisionMakingData()}
          autoPromptSummary={sharedDecisionAutoPromptSummary ?? undefined}
          autoPromptItems={sharedDecisionFormAlerts}
          isAutoPrompt={Boolean(sharedDecisionAutoPromptSummary)}
          autoPromptDebugWindow={sharedDecisionAutoPromptSummary ? sharedDecisionAutoPromptDebugWindow : undefined}
          patient={patientInfo}
          existingTimeEntries={mergedSharedDecisionMakingEntries
            .filter((entry) => Boolean(entry.time))
            .map((entry, index) => ({ hour: index, time: entry.time as string }))}
          baseTime={baseTime ?? undefined}
          slotCount={slotCount}
          firstStageSlotCount={firstStageSlotCount}
          secondStageSlotCount={secondStageSlotCount}
          secondStageStartTime={firstStageTransition?.time}
          isMultipleGestation={isMultipleGestation}
          hasTwinOneBirthRecorded={hasTwinOneBirthRecorded}
          isEmergencyMode={emergencySection === 'shared-decision-making' && Boolean(emergencyReason)}
          emergencyReason={emergencySection === 'shared-decision-making' ? (emergencyReason ?? undefined) : undefined}
        />
      ) : null}

      {isAdmissionDetailsFormOpen ? (
        <AdmissionDetailsForm
          isOpen={isAdmissionDetailsFormOpen}
          onClose={() => setIsAdmissionDetailsFormOpen(false)}
          onSubmit={(data) => {
            const riskFactorsDisplay = (data.riskFactors || [])
              .map((risk) => {
                switch (risk) {
                  case 'chronic_hypertension':
                    return t('chronicHypertension', 'Chronic hypertension');
                  case 'pre_eclampsia':
                    return t('preEclampsia', 'Pre-eclampsia');
                  case 'advanced_age':
                    return t('advancedAge', "Woman's advanced age");
                  case 'adolescent_pregnancy':
                    return t('adolescentPregnancy', 'Adolescent pregnancy');
                  case 'preterm_labour':
                    return t('pretermLabour', 'Preterm labour');
                  case 'colonization':
                    return t('colonization', 'Colonization');
                  case 'other':
                    return data.riskFactorOtherText?.trim()
                      ? `${t('other', 'Other')}: ${data.riskFactorOtherText.trim()}`
                      : t('other', 'Other');
                  case 'none':
                    return t('none', 'None');
                  default:
                    return risk;
                }
              })
              .join(', ');

            setAdmissionDetails((prev) => ({
              ...prev,
              labourOnset: data.labourOnset,
              activeLabourDiagnosisDate: data.activeLabourDiagnosisDate,
              riskFactors: riskFactorsDisplay,
              riskFactorOtherText: data.riskFactorOtherText || '',
              rupturedMembranes: data.rupturedMembranes,
              rupturedMembranesDate: data.rupturedMembranesDate,
              rupturedMembranesTime: data.rupturedMembranesTime,
            }));
            mutateAdmissionDetails();
            setIsAdmissionDetailsFormOpen(false);
          }}
          patient={
            patient
              ? {
                  uuid: (patient as any).id,
                  name: getPatientName(patient),
                  gender: patient.gender,
                  age: String((patient as any).age),
                  birthDate: (patient as any).birthDate,
                }
              : undefined
          }
        />
      ) : null}

      {emergencyReason ? <div style={{ display: 'none' }} aria-hidden="true" onClick={clearEmergencyContext} /> : null}
    </>
  );
};
