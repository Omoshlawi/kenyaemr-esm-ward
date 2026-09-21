import React, { startTransition } from 'react';
import type { BabyEntry } from '../graphs/baby.component';
import type { LabourProgressEntry } from '../graphs/labour-progress.component';
import type { WomanLocalEntry } from '../graphs/woman.component';
import type { MedicationEntry } from '../resources/medication.resource';
import type { SupportiveCareEntry } from '../resources/supportive-care.resource';
import type { SharedDecisionMakingEntry } from '../resources/shared-decision-making.resource';
import { readLcgSectionEntries } from '../storage/lcg-local-storage';
import { useLcgSectionAutosave } from '../hooks/use-lcg-section-autosave';

export type LcgSectionKey =
  | 'supportive-care'
  | 'baby'
  | 'woman'
  | 'labour-progress'
  | 'medication'
  | 'shared-decision-making';

type SectionEntryMap = {
  'supportive-care': SupportiveCareEntry;
  baby: BabyEntry;
  woman: WomanLocalEntry;
  'labour-progress': LabourProgressEntry;
  medication: MedicationEntry;
  'shared-decision-making': SharedDecisionMakingEntry;
};

type SectionContextValue<T> = {
  entries: T[];
  setEntries: React.Dispatch<React.SetStateAction<T[]>>;
};

function useTransitionBackedEntries<T>(initializer: () => T[]) {
  const [entries, setEntriesState] = React.useState(initializer);
  const setEntries = React.useCallback((updater: React.SetStateAction<T[]>) => {
    startTransition(() => {
      setEntriesState(updater);
    });
  }, []);

  return [entries, setEntries] as const;
}

const SupportiveCareSectionContext = React.createContext<SectionContextValue<SupportiveCareEntry> | null>(null);
const BabySectionContext = React.createContext<SectionContextValue<BabyEntry> | null>(null);
const WomanSectionContext = React.createContext<SectionContextValue<WomanLocalEntry> | null>(null);
const LabourProgressSectionContext = React.createContext<SectionContextValue<LabourProgressEntry> | null>(null);
const MedicationSectionContext = React.createContext<SectionContextValue<MedicationEntry> | null>(null);
const SharedDecisionSectionContext = React.createContext<SectionContextValue<SharedDecisionMakingEntry> | null>(null);

const missingProviderError = 'useLcgSectionState must be used within LcgSectionStateProvider';

function hydrateSectionEntries<T>(patientUuid: string, section: LcgSectionKey): T[] {
  if (!patientUuid) {
    return [];
  }

  return readLcgSectionEntries<T>(patientUuid, section);
}

function SectionAutosaveBridge<T>({
  patientUuid,
  section,
  entries,
}: {
  patientUuid: string;
  section: LcgSectionKey;
  entries: T[];
}) {
  useLcgSectionAutosave(patientUuid, section, entries);
  return null;
}

export type LcgSectionStateProviderProps = {
  patientUuid: string;
  children: React.ReactNode;
};

export const LcgSectionStateProvider: React.FC<LcgSectionStateProviderProps> = ({ patientUuid, children }) => {
  const [supportiveCareEntries, setSupportiveCareEntries] = useTransitionBackedEntries<SupportiveCareEntry>(() =>
    hydrateSectionEntries<SupportiveCareEntry>(patientUuid, 'supportive-care'),
  );
  const [babyEntries, setBabyEntries] = useTransitionBackedEntries<BabyEntry>(() =>
    hydrateSectionEntries<BabyEntry>(patientUuid, 'baby'),
  );
  const [womanEntries, setWomanEntries] = useTransitionBackedEntries<WomanLocalEntry>(() =>
    hydrateSectionEntries<WomanLocalEntry>(patientUuid, 'woman'),
  );
  const [labourProgressEntries, setLabourProgressEntries] = useTransitionBackedEntries<LabourProgressEntry>(() =>
    hydrateSectionEntries<LabourProgressEntry>(patientUuid, 'labour-progress'),
  );
  const [medicationEntries, setMedicationEntries] = useTransitionBackedEntries<MedicationEntry>(() =>
    hydrateSectionEntries<MedicationEntry>(patientUuid, 'medication'),
  );
  const [sharedDecisionEntries, setSharedDecisionEntries] = useTransitionBackedEntries<SharedDecisionMakingEntry>(() =>
    hydrateSectionEntries<SharedDecisionMakingEntry>(patientUuid, 'shared-decision-making'),
  );

  React.useEffect(() => {
    startTransition(() => {
      setSupportiveCareEntries(hydrateSectionEntries<SupportiveCareEntry>(patientUuid, 'supportive-care'));
      setBabyEntries(hydrateSectionEntries<BabyEntry>(patientUuid, 'baby'));
      setWomanEntries(hydrateSectionEntries<WomanLocalEntry>(patientUuid, 'woman'));
      setLabourProgressEntries(hydrateSectionEntries<LabourProgressEntry>(patientUuid, 'labour-progress'));
      setMedicationEntries(hydrateSectionEntries<MedicationEntry>(patientUuid, 'medication'));
      setSharedDecisionEntries(hydrateSectionEntries<SharedDecisionMakingEntry>(patientUuid, 'shared-decision-making'));
    });
  }, [
    patientUuid,
    setBabyEntries,
    setLabourProgressEntries,
    setMedicationEntries,
    setSharedDecisionEntries,
    setSupportiveCareEntries,
    setWomanEntries,
  ]);

  const supportiveCareValue = React.useMemo(
    () => ({ entries: supportiveCareEntries, setEntries: setSupportiveCareEntries }),
    [supportiveCareEntries, setSupportiveCareEntries],
  );
  const babyValue = React.useMemo(
    () => ({ entries: babyEntries, setEntries: setBabyEntries }),
    [babyEntries, setBabyEntries],
  );
  const womanValue = React.useMemo(
    () => ({ entries: womanEntries, setEntries: setWomanEntries }),
    [womanEntries, setWomanEntries],
  );
  const labourProgressValue = React.useMemo(
    () => ({ entries: labourProgressEntries, setEntries: setLabourProgressEntries }),
    [labourProgressEntries, setLabourProgressEntries],
  );
  const medicationValue = React.useMemo(
    () => ({ entries: medicationEntries, setEntries: setMedicationEntries }),
    [medicationEntries, setMedicationEntries],
  );
  const sharedDecisionValue = React.useMemo(
    () => ({ entries: sharedDecisionEntries, setEntries: setSharedDecisionEntries }),
    [sharedDecisionEntries, setSharedDecisionEntries],
  );

  return (
    <SupportiveCareSectionContext.Provider value={supportiveCareValue}>
      <BabySectionContext.Provider value={babyValue}>
        <WomanSectionContext.Provider value={womanValue}>
          <LabourProgressSectionContext.Provider value={labourProgressValue}>
            <MedicationSectionContext.Provider value={medicationValue}>
              <SharedDecisionSectionContext.Provider value={sharedDecisionValue}>
                <SectionAutosaveBridge
                  patientUuid={patientUuid}
                  section="supportive-care"
                  entries={supportiveCareEntries}
                />
                <SectionAutosaveBridge patientUuid={patientUuid} section="baby" entries={babyEntries} />
                <SectionAutosaveBridge patientUuid={patientUuid} section="woman" entries={womanEntries} />
                <SectionAutosaveBridge
                  patientUuid={patientUuid}
                  section="labour-progress"
                  entries={labourProgressEntries}
                />
                <SectionAutosaveBridge patientUuid={patientUuid} section="medication" entries={medicationEntries} />
                <SectionAutosaveBridge
                  patientUuid={patientUuid}
                  section="shared-decision-making"
                  entries={sharedDecisionEntries}
                />
                {children}
              </SharedDecisionSectionContext.Provider>
            </MedicationSectionContext.Provider>
          </LabourProgressSectionContext.Provider>
        </WomanSectionContext.Provider>
      </BabySectionContext.Provider>
    </SupportiveCareSectionContext.Provider>
  );
};

export function useLcgSectionState<K extends LcgSectionKey>(section: K): SectionContextValue<SectionEntryMap[K]> {
  const supportiveCareContext = React.useContext(SupportiveCareSectionContext);
  const babyContext = React.useContext(BabySectionContext);
  const womanContext = React.useContext(WomanSectionContext);
  const labourProgressContext = React.useContext(LabourProgressSectionContext);
  const medicationContext = React.useContext(MedicationSectionContext);
  const sharedDecisionContext = React.useContext(SharedDecisionSectionContext);

  switch (section) {
    case 'supportive-care': {
      if (!supportiveCareContext) {
        throw new Error(missingProviderError);
      }
      return supportiveCareContext as SectionContextValue<SectionEntryMap[K]>;
    }
    case 'baby': {
      if (!babyContext) {
        throw new Error(missingProviderError);
      }
      return babyContext as SectionContextValue<SectionEntryMap[K]>;
    }
    case 'woman': {
      if (!womanContext) {
        throw new Error(missingProviderError);
      }
      return womanContext as SectionContextValue<SectionEntryMap[K]>;
    }
    case 'labour-progress': {
      if (!labourProgressContext) {
        throw new Error(missingProviderError);
      }
      return labourProgressContext as SectionContextValue<SectionEntryMap[K]>;
    }
    case 'medication': {
      if (!medicationContext) {
        throw new Error(missingProviderError);
      }
      return medicationContext as SectionContextValue<SectionEntryMap[K]>;
    }
    case 'shared-decision-making': {
      if (!sharedDecisionContext) {
        throw new Error(missingProviderError);
      }
      return sharedDecisionContext as SectionContextValue<SectionEntryMap[K]>;
    }
    default: {
      const exhaustiveCheck: never = section;
      throw new Error(`Unsupported LCG section: ${String(exhaustiveCheck)}`);
    }
  }
}

export function useLcgAllSectionEntries() {
  const supportiveCare = useLcgSectionState('supportive-care');
  const baby = useLcgSectionState('baby');
  const woman = useLcgSectionState('woman');
  const labourProgress = useLcgSectionState('labour-progress');
  const medication = useLcgSectionState('medication');
  const sharedDecision = useLcgSectionState('shared-decision-making');

  return {
    localSupportiveCareEntries: supportiveCare.entries,
    setLocalSupportiveCareEntries: supportiveCare.setEntries,
    localBabyEntries: baby.entries,
    setLocalBabyEntries: baby.setEntries,
    localWomanEntries: woman.entries,
    setLocalWomanEntries: woman.setEntries,
    localLabourProgressEntries: labourProgress.entries,
    setLocalLabourProgressEntries: labourProgress.setEntries,
    localMedicationEntries: medication.entries,
    setLocalMedicationEntries: medication.setEntries,
    localSharedDecisionMakingEntries: sharedDecision.entries,
    setLocalSharedDecisionMakingEntries: sharedDecision.setEntries,
  };
}
