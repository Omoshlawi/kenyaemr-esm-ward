import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { Modal, Grid, Column, Select, SelectItem, NumberInput, InlineNotification } from '@carbon/react';
import { BabyTimePickerDropdown } from './form-scoped-time-pickers.component';
import styles from '../partography-data-form.scss';
import type { BabyEntry } from '../graphs/baby.component';
import { saveBabyData } from '../resources/baby.resource';
import { buildWomanScheduleState } from '../woman-schedule-utils';
import { useLcgFormClock } from '../hooks/use-lcg-form-clock';
import {
  formatMinutesToHHMM,
  getAllowedEmergencyTimes,
  getAllowedPointTimesForSlots,
  getAllowedTimesForSlots,
  parseHHMMToMinutes,
  getPointSlotIndexForTime,
  getPointSlotState,
  getSlotState,
  getStageAwareSlotIndexForTime,
  formatHHMM,
} from '../time-slot-utils';
import {
  LCG_BABY_FIRST_STAGE_FHR_INTERVAL_MINUTES,
  LCG_BABY_SECOND_STAGE_FHR_INTERVAL_MINUTES,
  LCG_BABY_SECOND_STAGE_LOWER_INTERVAL_MINUTES,
  LCG_BABY_VAGINAL_EXAM_INTERVAL_MINUTES,
  LCG_BABY_FIRST_STAGE_LOWER_INTERVAL_COLUMNS,
  LCG_TIME_INCREMENT_MINUTES,
} from '../types';

const BABY_PRIMARY_FHR_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_BABY_FIRST_STAGE_FHR_INTERVAL_MINUTES - 1,
};

const BABY_HALF_GRID_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
  offsetMinutes: LCG_BABY_FIRST_STAGE_FHR_INTERVAL_MINUTES,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_BABY_FIRST_STAGE_FHR_INTERVAL_MINUTES - 1,
};

const BABY_BASE_ROW_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_BABY_VAGINAL_EXAM_INTERVAL_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_BABY_VAGINAL_EXAM_INTERVAL_MINUTES - 1,
};

const BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS = Array.from({ length: 4 }, (_, segmentIndex) => ({
  slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
  offsetMinutes: segmentIndex * LCG_BABY_SECOND_STAGE_FHR_INTERVAL_MINUTES,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_BABY_SECOND_STAGE_FHR_INTERVAL_MINUTES - 1,
}));

const BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS = [
  {
    // In second stage, lower baby section opens every 30 minutes.
    slotIntervalMinutes: LCG_BABY_SECOND_STAGE_LOWER_INTERVAL_MINUTES,
    offsetMinutes: 0,
    earlyAllowanceMinutes: 0,
    lateAllowanceMinutes: LCG_BABY_SECOND_STAGE_LOWER_INTERVAL_MINUTES - 1,
  },
];

export type BabyFormData = {
  time: string;
  baselineFhr: string;
  fhrDeceleration: string;
  amnioticFluid: string;
  fetalPosition: string;
  caput: string;
  moulding: string;
};

const UPPER_FIELD_NAMES: Array<keyof BabyFormData> = ['baselineFhr', 'fhrDeceleration'];
const LOWER_FIELD_NAMES: Array<keyof BabyFormData> = ['amnioticFluid', 'fetalPosition', 'caput', 'moulding'];

type BabyFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BabyFormData) => void;
  onDataSaved?: () => void;
  existingTimeEntries?: Array<{ hour: number; time: string }>;
  existingEntries?: BabyEntry[];
  baseTime?: string;
  slotCount?: number;
  firstStageSlotCount?: number;
  secondStageSlotCount?: number;
  secondStageStartTime?: string;
  patient?: {
    uuid: string;
    name: string;
    gender: string;
    age: string;
  };
  twinIndex?: number;
  lowerFieldsTwinIndex?: number;
  showLowerFields?: boolean;
  lockUpperFields?: boolean;
  isEmergencyMode?: boolean;
  emergencyReason?: string;
};

const BabyForm: React.FC<BabyFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDataSaved,
  existingTimeEntries = [],
  existingEntries = [],
  baseTime,
  slotCount = 0,
  firstStageSlotCount = 0,
  secondStageSlotCount = 0,
  secondStageStartTime,
  patient,
  twinIndex = 1,
  lowerFieldsTwinIndex,
  showLowerFields = true,
  lockUpperFields = false,
  isEmergencyMode = false,
  emergencyReason,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const now = useLcgFormClock(isOpen);
  const showScheduleDebug = process.env.NODE_ENV !== 'production';

  const effectiveLowerFieldsTwinIndex = lowerFieldsTwinIndex ?? twinIndex;

  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<BabyFormData>({
    defaultValues: {
      time: '',
      baselineFhr: '',
      fhrDeceleration: '',
      amnioticFluid: '',
      fetalPosition: '',
      caput: '',
      moulding: '',
    },
  });

  // Reset form when it opens
  React.useEffect(() => {
    if (isOpen) {
      reset({
        time: '',
        baselineFhr: '',
        fhrDeceleration: '',
        amnioticFluid: '',
        fetalPosition: '',
        caput: '',
        moulding: '',
      });
      clearErrors();
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [isOpen, reset, clearErrors]);

  const hasUpperEntryData = React.useCallback(
    (entry: BabyEntry) => Boolean(entry.baselineFhr || entry.fhrDeceleration),
    [],
  );

  const hasLowerEntryData = React.useCallback(
    (entry: BabyEntry) => Boolean(entry.amnioticFluid || entry.fetalPosition || entry.caput || entry.moulding),
    [],
  );

  const getUpperSlotKey = React.useCallback(
    (time: string) => {
      if (!baseTime || slotCount === 0) {
        return null;
      }

      if (secondStageStartTime && secondStageSlotCount > 0) {
        const secondStageSegmentIndex = BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS.findIndex(
          (option) => getPointSlotIndexForTime(secondStageStartTime, time, secondStageSlotCount, option) !== null,
        );

        if (secondStageSegmentIndex !== -1) {
          const secondStageSlotIndex = getPointSlotIndexForTime(
            secondStageStartTime,
            time,
            secondStageSlotCount,
            BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS[secondStageSegmentIndex],
          );
          if (secondStageSlotIndex !== null) {
            return `second-stage-${secondStageSegmentIndex}-${secondStageSlotIndex}`;
          }
        }
      }

      const primarySlotIndex = getPointSlotIndexForTime(
        baseTime,
        time,
        firstStageSlotCount || slotCount,
        BABY_PRIMARY_FHR_SLOT_OPTIONS,
      );
      if (primarySlotIndex !== null) {
        return `primary-${primarySlotIndex}`;
      }

      const secondarySlotIndex = getPointSlotIndexForTime(
        baseTime,
        time,
        firstStageSlotCount || slotCount,
        BABY_HALF_GRID_SLOT_OPTIONS,
      );
      if (secondarySlotIndex !== null) {
        return `secondary-${secondarySlotIndex}`;
      }

      return null;
    },
    [baseTime, firstStageSlotCount, secondStageSlotCount, secondStageStartTime, slotCount],
  );

  const safeFirstStageSlotCount = firstStageSlotCount || slotCount;
  // Use pre-computed column count (1 guideline hour = 1 grid column, scale-independent)
  const firstStageLowerIntervalSlots = Math.max(1, LCG_BABY_FIRST_STAGE_LOWER_INTERVAL_COLUMNS);

  const firstStageLowerFilledSlotIndices = React.useMemo(() => {
    if (!baseTime || safeFirstStageSlotCount <= 0) {
      return [] as number[];
    }

    const filledSlots = new Set<number>();

    for (const entry of existingEntries) {
      if (!hasLowerEntryData(entry)) {
        continue;
      }

      if (
        secondStageStartTime &&
        secondStageSlotCount > 0 &&
        getPointSlotIndexForTime(
          secondStageStartTime,
          entry.time,
          secondStageSlotCount,
          BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS[0],
        ) !== null
      ) {
        continue;
      }

      const slotIndex = getStageAwareSlotIndexForTime(baseTime, entry.time, safeFirstStageSlotCount, 0);
      if (slotIndex !== null && slotIndex >= 0 && slotIndex < safeFirstStageSlotCount) {
        filledSlots.add(slotIndex);
      }
    }

    return Array.from(filledSlots).sort((left, right) => left - right);
  }, [
    baseTime,
    existingEntries,
    hasLowerEntryData,
    safeFirstStageSlotCount,
    secondStageSlotCount,
    secondStageStartTime,
  ]);

  const firstStageLowerScheduleState = React.useMemo(
    () =>
      buildWomanScheduleState({
        baseTime,
        slotCount: safeFirstStageSlotCount,
        actualFilledSlotIndices: firstStageLowerFilledSlotIndices,
        intervalMinutes: LCG_BABY_VAGINAL_EXAM_INTERVAL_MINUTES,
        now,
      }),
    [baseTime, firstStageLowerFilledSlotIndices, now, safeFirstStageSlotCount],
  );

  const firstStageCurrentSlotIndex = React.useMemo(() => {
    if (!baseTime || safeFirstStageSlotCount <= 0) {
      return null;
    }

    return getStageAwareSlotIndexForTime(
      baseTime,
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      safeFirstStageSlotCount,
      0,
    );
  }, [baseTime, now, safeFirstStageSlotCount]);

  const firstStageLowerCandidateSlotIndex = React.useMemo(() => {
    if (firstStageCurrentSlotIndex === null || safeFirstStageSlotCount <= 0) {
      return null;
    }

    if (firstStageLowerFilledSlotIndices.length === 0) {
      return Math.min(firstStageCurrentSlotIndex, safeFirstStageSlotCount - 1);
    }

    const latestFilledSlotIndex = Math.max(...firstStageLowerFilledSlotIndices);
    const nextDueSlotIndex = latestFilledSlotIndex + firstStageLowerIntervalSlots;
    const candidateSlotIndex =
      firstStageCurrentSlotIndex < nextDueSlotIndex ? nextDueSlotIndex : firstStageCurrentSlotIndex;

    if (candidateSlotIndex < 0 || candidateSlotIndex >= safeFirstStageSlotCount) {
      return null;
    }

    return candidateSlotIndex;
  }, [
    firstStageCurrentSlotIndex,
    firstStageLowerFilledSlotIndices,
    firstStageLowerIntervalSlots,
    safeFirstStageSlotCount,
  ]);

  const firstStageAvailableLowerSlotIndices = React.useMemo(() => {
    if (!baseTime || firstStageCurrentSlotIndex === null || safeFirstStageSlotCount <= 0) {
      return [];
    }

    if (getSlotState(baseTime, firstStageCurrentSlotIndex, now) === 'active') {
      return [firstStageCurrentSlotIndex];
    }

    if (firstStageLowerCandidateSlotIndex === null || firstStageCurrentSlotIndex < firstStageLowerCandidateSlotIndex) {
      return [];
    }

    return [firstStageLowerCandidateSlotIndex];
  }, [baseTime, firstStageCurrentSlotIndex, firstStageLowerCandidateSlotIndex, now, safeFirstStageSlotCount]);

  const availableUpperSlotKeys = React.useMemo(() => {
    if (!baseTime || slotCount === 0) {
      return [];
    }

    if (secondStageStartTime && secondStageSlotCount > 0) {
      const availableSlots: string[] = [];

      Array.from({ length: secondStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
        BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS.forEach((option, segmentIndex) => {
          const slotKey = `second-stage-${segmentIndex}-${slotIndex}`;
          if (getPointSlotState(secondStageStartTime, slotIndex, now, option) === 'active') {
            availableSlots.push(slotKey);
          }
        });
      });

      return availableSlots;
    }

    const availableSlots: string[] = [];

    Array.from({ length: firstStageSlotCount || slotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
      const primaryKey = `primary-${slotIndex}`;
      if (getPointSlotState(baseTime, slotIndex, now, BABY_PRIMARY_FHR_SLOT_OPTIONS) === 'active') {
        availableSlots.push(primaryKey);
      }

      const secondaryKey = `secondary-${slotIndex}`;
      if (getPointSlotState(baseTime, slotIndex, now, BABY_HALF_GRID_SLOT_OPTIONS) === 'active') {
        availableSlots.push(secondaryKey);
      }
    });

    return availableSlots;
  }, [baseTime, firstStageSlotCount, now, secondStageSlotCount, secondStageStartTime, slotCount]);

  const availableLowerSlotIndices = React.useMemo(() => {
    if (!baseTime || slotCount === 0) {
      return [];
    }

    if (secondStageStartTime && secondStageSlotCount > 0) {
      return Array.from({ length: secondStageSlotCount }, (_, slotIndex) => slotIndex)
        .flatMap((slotIndex) =>
          BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS.map((option, segmentIndex) => ({ slotIndex, segmentIndex, option })),
        )
        .filter(({ slotIndex, segmentIndex, option }) => {
          return getPointSlotState(secondStageStartTime, slotIndex, now, option) === 'active';
        });
    }

    return firstStageAvailableLowerSlotIndices;
  }, [baseTime, firstStageAvailableLowerSlotIndices, now, secondStageSlotCount, secondStageStartTime, slotCount]);

  const upperAllowedTimes = React.useMemo(() => {
    if (isEmergencyMode) {
      return getAllowedEmergencyTimes(now);
    }

    if (!baseTime || availableUpperSlotKeys.length === 0) {
      return [];
    }

    if (secondStageStartTime && secondStageSlotCount > 0) {
      return Array.from(
        new Set(
          BABY_SECOND_STAGE_UPPER_SLOT_OPTIONS.flatMap((option, segmentIndex) => {
            const slotIndices = availableUpperSlotKeys
              .filter((slotKey) => slotKey.startsWith(`second-stage-${segmentIndex}-`))
              .map((slotKey) => Number(slotKey.split('-').pop()))
              .filter((slotIndex) => Number.isInteger(slotIndex));

            return getAllowedPointTimesForSlots(secondStageStartTime, slotIndices, option, now);
          }),
        ),
      ).sort();
    }

    const primarySlotIndices = availableUpperSlotKeys
      .filter((slotKey) => slotKey.startsWith('primary-'))
      .map((slotKey) => Number(slotKey.replace('primary-', '')))
      .filter((slotIndex) => Number.isInteger(slotIndex));

    const secondarySlotIndices = availableUpperSlotKeys
      .filter((slotKey) => slotKey.startsWith('secondary-'))
      .map((slotKey) => Number(slotKey.replace('secondary-', '')))
      .filter((slotIndex) => Number.isInteger(slotIndex));

    return Array.from(
      new Set([
        ...getAllowedPointTimesForSlots(baseTime, primarySlotIndices, BABY_PRIMARY_FHR_SLOT_OPTIONS, now),
        ...getAllowedPointTimesForSlots(baseTime, secondarySlotIndices, BABY_HALF_GRID_SLOT_OPTIONS, now),
      ]),
    ).sort();
  }, [availableUpperSlotKeys, baseTime, isEmergencyMode, now, secondStageSlotCount, secondStageStartTime]);

  const lowerAllowedTimes = React.useMemo(() => {
    if (isEmergencyMode) {
      return getAllowedEmergencyTimes(now);
    }

    if (!baseTime || availableLowerSlotIndices.length === 0) {
      return [];
    }

    if (secondStageStartTime && secondStageSlotCount > 0) {
      return Array.from(
        new Set(
          BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS.flatMap((option, segmentIndex) => {
            const slotIndices = (availableLowerSlotIndices as Array<{ slotIndex: number; segmentIndex: number }>)
              .filter((item) => item.segmentIndex === segmentIndex)
              .map((item) => item.slotIndex);

            return getAllowedPointTimesForSlots(secondStageStartTime, slotIndices, option, now);
          }),
        ),
      ).sort();
    }

    // First-stage lower rows follow catch-up index progression. When a slot is due/open,
    // allow only the exact slot time so missed prior slots remain locked.
    return getAllowedTimesForSlots(baseTime, availableLowerSlotIndices as number[], now);
  }, [availableLowerSlotIndices, baseTime, isEmergencyMode, now, secondStageSlotCount, secondStageStartTime]);

  const latestFirstStageLowerEntryTime = React.useMemo(() => {
    const orderedLowerEntries = [...existingEntries]
      .filter((entry) => hasLowerEntryData(entry))
      .sort((left, right) => new Date(left.encounterDatetime).getTime() - new Date(right.encounterDatetime).getTime());

    let lastTime: string | null = null;

    for (const entry of orderedLowerEntries) {
      if (
        secondStageStartTime &&
        secondStageSlotCount > 0 &&
        getPointSlotIndexForTime(
          secondStageStartTime,
          entry.time,
          secondStageSlotCount,
          BABY_SECOND_STAGE_LOWER_SLOT_OPTIONS[0],
        ) !== null
      ) {
        continue;
      }

      lastTime = entry.time;
    }

    return lastTime;
  }, [existingEntries, hasLowerEntryData, secondStageSlotCount, secondStageStartTime]);

  const nextLowerDueTime = React.useMemo(() => {
    if (!latestFirstStageLowerEntryTime) {
      return null;
    }

    const lastMinutes = parseHHMMToMinutes(latestFirstStageLowerEntryTime);
    if (lastMinutes === null) {
      return null;
    }

    return formatMinutesToHHMM(lastMinutes + LCG_BABY_VAGINAL_EXAM_INTERVAL_MINUTES);
  }, [latestFirstStageLowerEntryTime]);

  const currentLowerCatchUpOpenTime = React.useMemo(() => {
    if (lowerAllowedTimes.length === 0) {
      return null;
    }
    return lowerAllowedTimes[0];
  }, [lowerAllowedTimes]);

  const slotAllowedTimes = React.useMemo(
    () => Array.from(new Set([...lowerAllowedTimes, ...upperAllowedTimes])).sort(),
    [lowerAllowedTimes, upperAllowedTimes],
  );

  const displayAllowedTimes = React.useMemo(() => {
    if (slotAllowedTimes.length > 0) {
      return slotAllowedTimes;
    }
    const nowHHMM = formatHHMM(now);
    return nowHHMM ? [nowHHMM] : [];
  }, [now, slotAllowedTimes]);

  const selectedTime = watch('time');

  const selectedAllowsUpper = React.useMemo(() => {
    if (selectedTime) {
      return upperAllowedTimes.includes(selectedTime);
    }

    return upperAllowedTimes.length > 0;
  }, [selectedTime, upperAllowedTimes]);

  const selectedAllowsLower = React.useMemo(() => {
    if (selectedTime) {
      return lowerAllowedTimes.includes(selectedTime);
    }

    return lowerAllowedTimes.length > 0;
  }, [lowerAllowedTimes, selectedTime]);

  const isActiveFirstStageGridSlotOpen = React.useMemo(() => {
    if (!baseTime || firstStageCurrentSlotIndex === null || safeFirstStageSlotCount <= 0) {
      return false;
    }
    if (secondStageStartTime && secondStageSlotCount > 0) {
      return false;
    }
    return getSlotState(baseTime, firstStageCurrentSlotIndex, now) === 'active';
  }, [baseTime, firstStageCurrentSlotIndex, now, safeFirstStageSlotCount, secondStageSlotCount, secondStageStartTime]);

  const isSelectedTimeInActiveFirstStageGridSlot = React.useMemo(() => {
    if (!isActiveFirstStageGridSlotOpen || !selectedTime || !baseTime) {
      return false;
    }
    const slotIndex = getStageAwareSlotIndexForTime(baseTime, selectedTime, safeFirstStageSlotCount, 0);
    return slotIndex === firstStageCurrentSlotIndex;
  }, [baseTime, firstStageCurrentSlotIndex, isActiveFirstStageGridSlotOpen, safeFirstStageSlotCount, selectedTime]);

  const canEditUpper = isEmergencyMode || selectedAllowsUpper || isActiveFirstStageGridSlotOpen;
  const canEditLower = isEmergencyMode || selectedAllowsLower || isActiveFirstStageGridSlotOpen;

  const isInputLocked =
    !isEmergencyMode && Boolean(baseTime) && slotAllowedTimes.length === 0 && !isActiveFirstStageGridSlotOpen;
  const upperFieldsDisabled = !canEditUpper || lockUpperFields;
  const lowerFieldsDisabled = !canEditLower;

  React.useEffect(() => {
    if (selectedAllowsUpper && !selectedAllowsLower) {
      clearErrors(LOWER_FIELD_NAMES);
      return;
    }

    if (selectedAllowsLower && !selectedAllowsUpper) {
      clearErrors(UPPER_FIELD_NAMES);
    }
  }, [clearErrors, selectedAllowsLower, selectedAllowsUpper]);

  const handleFormSubmit = async (data: BabyFormData) => {
    clearErrors();
    setSaveError(null);
    setSaveSuccess(false);

    if (!data.time) {
      setError('time', { type: 'manual', message: t('timeRequired', 'Time is required') });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    if (!isEmergencyMode && (!baseTime || slotCount === 0)) {
      setError('time', {
        type: 'manual',
        message: t('labourCareGuideTimeRequired', 'Set the labour care guide time before entering baby data'),
      });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    const isUpperTime = upperAllowedTimes.includes(data.time) || isSelectedTimeInActiveFirstStageGridSlot;
    const isLowerTime = lowerAllowedTimes.includes(data.time) || isSelectedTimeInActiveFirstStageGridSlot;
    const hasUpperInput = Boolean(data.baselineFhr || data.fhrDeceleration);
    const hasLowerInput =
      showLowerFields && Boolean(data.amnioticFluid || data.fetalPosition || data.caput || data.moulding);

    if (!isEmergencyMode && !isUpperTime && !isLowerTime) {
      setError('time', {
        type: 'manual',
        message: t('babyTimeOutOfRange', 'Select a time within the currently allowed baby window'),
      });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    if (!hasUpperInput && !hasLowerInput) {
      setSaveError(t('enterAtLeastOneBabySection', 'Enter at least one complete baby section before saving'));
      return;
    }

    if (!isEmergencyMode && hasUpperInput && !isUpperTime) {
      setError('time', {
        type: 'manual',
        message: t('babyUpperTimeOutOfRange', 'Selected time is not open for Baseline FHR/FHR Deceleration'),
      });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    if (!isEmergencyMode && hasLowerInput && !isLowerTime) {
      setError('time', {
        type: 'manual',
        message: t('babyLowerTimeOutOfRange', 'Selected time is not open for Amniotic/Fetal position/Caput/Moulding'),
      });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    const sanitizedData: BabyFormData = {
      time: data.time,
      baselineFhr: hasUpperInput && isUpperTime ? data.baselineFhr : '',
      fhrDeceleration: hasUpperInput && isUpperTime ? data.fhrDeceleration : '',
      amnioticFluid: hasLowerInput && isLowerTime ? data.amnioticFluid : '',
      fetalPosition: hasLowerInput && isLowerTime ? data.fetalPosition : '',
      caput: hasLowerInput && isLowerTime ? data.caput : '',
      moulding: hasLowerInput && isLowerTime ? data.moulding : '',
    };

    if (hasUpperInput && sanitizedData.baselineFhr === '') {
      setError('baselineFhr', { type: 'manual', message: t('baselineFhrRequired', 'Baseline FHR is required') });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    if (sanitizedData.baselineFhr) {
      const baselineFhr = Number(sanitizedData.baselineFhr);
      if (!Number.isFinite(baselineFhr) || baselineFhr < 0 || baselineFhr > 200) {
        setError('baselineFhr', {
          type: 'manual',
          message: t('baselineFhrRange', 'Baseline FHR must be between 0 and 200'),
        });
        setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
        return;
      }
    }

    if (hasUpperInput && !sanitizedData.fhrDeceleration) {
      setError('fhrDeceleration', {
        type: 'manual',
        message: t('fhrDecelerationRequired', 'FHR deceleration is required'),
      });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    if (hasLowerInput && !sanitizedData.amnioticFluid) {
      setError('amnioticFluid', {
        type: 'manual',
        message: t('amnioticFluidRequired', 'Amniotic fluid is required'),
      });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    if (hasLowerInput && !sanitizedData.fetalPosition) {
      setError('fetalPosition', {
        type: 'manual',
        message: t('fetalPositionRequired', 'Fetal position is required'),
      });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    if (hasLowerInput && !sanitizedData.caput) {
      setError('caput', { type: 'manual', message: t('caputRequired', 'Caput is required') });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    if (hasLowerInput && !sanitizedData.moulding) {
      setError('moulding', { type: 'manual', message: t('mouldingRequired', 'Moulding is required') });
      setSaveError(t('completeRequiredFields', 'Complete the required fields before saving'));
      return;
    }

    setIsSaving(true);
    try {
      if (!patient?.uuid) {
        throw new Error(t('patientRequired', 'Patient is required'));
      }

      const saveOptions = {
        emergencyReason: isEmergencyMode ? emergencyReason : undefined,
      };

      if (effectiveLowerFieldsTwinIndex !== twinIndex && (hasUpperInput || hasLowerInput)) {
        if (hasUpperInput) {
          const fetalResult = await saveBabyData(
            patient.uuid,
            {
              ...sanitizedData,
              amnioticFluid: '',
              fetalPosition: '',
              caput: '',
              moulding: '',
            },
            t,
            undefined,
            undefined,
            {
              ...saveOptions,
              twinIndex,
            },
          );

          if (!fetalResult.success) {
            setSaveError(fetalResult.message || t('saveError', 'Failed to save data'));
            return;
          }
        }

        if (hasLowerInput) {
          const maternalResult = await saveBabyData(
            patient.uuid,
            {
              ...sanitizedData,
              baselineFhr: '',
              fhrDeceleration: '',
            },
            t,
            undefined,
            undefined,
            {
              ...saveOptions,
              twinIndex: effectiveLowerFieldsTwinIndex,
            },
          );

          if (!maternalResult.success) {
            setSaveError(maternalResult.message || t('saveError', 'Failed to save data'));
            return;
          }
        }
      } else {
        const result = await saveBabyData(patient.uuid, sanitizedData, t, undefined, undefined, {
          ...saveOptions,
          twinIndex,
        });

        if (!result.success) {
          setSaveError(result.message || t('saveError', 'Failed to save data'));
          return;
        }
      }

      setSaveSuccess(true);
      if (onDataSaved) {
        onDataSaved();
      }
      onSubmit(sanitizedData);
      reset();
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      setSaveError(t('saveError', 'Failed to save data'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    reset();
    clearErrors();
    onClose();
  };

  const decelerationOptions = [
    { value: 'L', label: t('late', 'Late') },
    { value: 'E', label: t('early', 'Early') },
    { value: 'V', label: t('variable', 'Variable') },
    { value: 'N', label: t('no', 'No') },
  ];

  const amnioticFluidOptions = [
    { value: 'C', label: t('clear', 'Clear (C)') },
    { value: 'I', label: t('intact', 'Intact (I)') },
    { value: 'B', label: t('bloody', 'Bloody (B)') },
    { value: 'M+', label: t('meconium1', 'Meconium +') },
    { value: 'M++', label: t('meconium2', 'Meconium ++') },
    { value: 'M+++', label: t('meconium3', 'Meconium +++') },
  ];

  const fetalPositionOptions = [
    { value: 'P', label: t('posterior', 'Posterior (P)') },
    { value: 'T', label: t('transverse', 'Transverse (T)') },
    { value: 'A', label: t('anterior', 'Anterior (A)') },
  ];

  const degreeOptions = [
    { value: '0', label: '0' },
    { value: '+', label: '+' },
    { value: '++', label: '++' },
    { value: '+++', label: '+++' },
  ];

  return (
    <Modal
      open={isOpen}
      onRequestClose={handleClose}
      modalHeading={t('babyWellBeingDataForTwin', `Baby Well Being Data - Twin ${twinIndex}`)}
      primaryButtonText={isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
      primaryButtonDisabled={isSaving}
      secondaryButtonText={t('cancel', 'Cancel')}
      onRequestSubmit={handleSubmit(handleFormSubmit)}
      onSecondarySubmit={handleClose}
      className={styles.cervixModal}
      size="md">
      {saveSuccess && (
        <InlineNotification
          kind="success"
          title={t('saveSuccess', 'Data saved successfully')}
          subtitle={t('babyDataSaved', 'Baby well-being data has been saved')}
          hideCloseButton
        />
      )}

      {saveError && (
        <InlineNotification
          kind="error"
          title={t('saveError', 'Error saving data')}
          subtitle={saveError}
          onCloseButtonClick={() => setSaveError(null)}
        />
      )}

      {isEmergencyMode ? (
        <InlineNotification
          kind="warning"
          title={t('emergencyModeActive', 'Emergency mode active')}
          subtitle={
            emergencyReason
              ? t('emergencyReasonDisplay', `Reason: ${emergencyReason}`)
              : t('emergencyReasonMissing', 'No reason captured')
          }
          hideCloseButton
        />
      ) : null}
      <Grid className={styles.formGrid}>
        <Column lg={12} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="time"
              control={control}
              render={({ field, fieldState }) => (
                <div>
                  <label className={styles.fieldLabel}>{t('time', 'Time')}</label>
                  <BabyTimePickerDropdown
                    id="time-picker"
                    labelText=""
                    value={field.value}
                    onChange={field.onChange}
                    existingTimeEntries={existingTimeEntries}
                    allowedTimes={displayAllowedTimes}
                    disablePastTimes={!isEmergencyMode}
                    currentTime={formatHHMM(now)}
                    disabled={!baseTime}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                  />
                </div>
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="baselineFhr"
              control={control}
              render={({ field, fieldState }) => (
                <NumberInput
                  id="baseline-fhr"
                  label={t('baselineFhr', 'Baseline FHR')}
                  min={0}
                  max={200}
                  step={1}
                  value={field.value || ''}
                  onChange={(event, data) => {
                    const nextValue = data?.value ?? (event.target as HTMLInputElement).value;
                    field.onChange(nextValue === undefined || nextValue === null ? '' : String(nextValue));
                  }}
                  disabled={upperFieldsDisabled}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}
                  allowEmpty
                />
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="fhrDeceleration"
              control={control}
              render={({ field, fieldState }) => (
                <Select
                  id="fhr-deceleration"
                  labelText={t('fhrDeceleration', 'FHR Deceleration')}
                  disabled={upperFieldsDisabled}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}>
                  <SelectItem value="" text={t('selectOption', 'Select option')} />
                  {decelerationOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} text={opt.label} />
                  ))}
                </Select>
              )}
            />
          </div>
        </Column>

        {showLowerFields ? (
          <>
            <Column lg={8} md={4} sm={2}>
              <div className={styles.formField}>
                <Controller
                  name="amnioticFluid"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Select
                      id="amniotic-fluid"
                      labelText={t('amnioticFluid', 'Amniotic Fluid')}
                      disabled={lowerFieldsDisabled}
                      invalid={!!fieldState.error}
                      invalidText={fieldState.error?.message}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}>
                      <SelectItem value="" text={t('selectOption', 'Select option')} />
                      {amnioticFluidOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} text={opt.label} />
                      ))}
                    </Select>
                  )}
                />
              </div>
            </Column>

            <Column lg={8} md={4} sm={2}>
              <div className={styles.formField}>
                <Controller
                  name="fetalPosition"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Select
                      id="fetal-position"
                      labelText={t('fetalPosition', 'Fetal Position')}
                      disabled={lowerFieldsDisabled}
                      invalid={!!fieldState.error}
                      invalidText={fieldState.error?.message}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}>
                      <SelectItem value="" text={t('selectOption', 'Select option')} />
                      {fetalPositionOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} text={opt.label} />
                      ))}
                    </Select>
                  )}
                />
              </div>
            </Column>

            <Column lg={8} md={4} sm={2}>
              <div className={styles.formField}>
                <Controller
                  name="caput"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Select
                      id="caput-degree"
                      labelText={t('caput', 'Caput')}
                      disabled={lowerFieldsDisabled}
                      invalid={!!fieldState.error}
                      invalidText={fieldState.error?.message}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}>
                      <SelectItem value="" text={t('selectOption', 'Select option')} />
                      {degreeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} text={opt.label} />
                      ))}
                    </Select>
                  )}
                />
              </div>
            </Column>

            <Column lg={8} md={4} sm={2}>
              <div className={styles.formField}>
                <Controller
                  name="moulding"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Select
                      id="moulding-degree"
                      labelText={t('moulding', 'Moulding')}
                      disabled={lowerFieldsDisabled}
                      invalid={!!fieldState.error}
                      invalidText={fieldState.error?.message}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}>
                      <SelectItem value="" text={t('selectOption', 'Select option')} />
                      {degreeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} text={opt.label} />
                      ))}
                    </Select>
                  )}
                />
              </div>
            </Column>
          </>
        ) : null}
      </Grid>
    </Modal>
  );
};

export default BabyForm;
