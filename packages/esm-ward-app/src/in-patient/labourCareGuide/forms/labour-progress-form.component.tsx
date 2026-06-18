import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { Modal, Grid, Column, NumberInput, Select, SelectItem, InlineNotification } from '@carbon/react';
import { LabourProgressTimePickerDropdown } from './form-scoped-time-pickers.component';
import styles from '../partography-data-form.scss';
import { useLcgFormClock } from '../hooks/use-lcg-form-clock';
import {
  formatMinutesToHHMM,
  getForwardMinutesDelta,
  getAllowedEmergencyTimes,
  getAllowedPointTimesForSlots,
  getPointSlotIndexForTime,
  getPointSlotState,
  getSlotState,
  getStageAwareSlotIndexForTime,
  parseHHMMToMinutes,
  formatHHMM,
} from '../time-slot-utils';
import {
  LCG_FIRST_STAGE_CONTRACTION_INTERVAL_MINUTES,
  LCG_FIRST_STAGE_VAGINAL_EXAM_INTERVAL_MINUTES,
  LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES,
  LCG_SECOND_STAGE_DESCENT_INTERVAL_MINUTES,
  LCG_TIME_INCREMENT_MINUTES,
} from '../types';

const BABY_PRIMARY_FHR_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_FIRST_STAGE_CONTRACTION_INTERVAL_MINUTES - 1,
};

const BABY_HALF_GRID_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
  offsetMinutes: LCG_FIRST_STAGE_CONTRACTION_INTERVAL_MINUTES,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_FIRST_STAGE_CONTRACTION_INTERVAL_MINUTES - 1,
};

const LABOUR_PROGRESS_LOWER_SLOT_OPTIONS = {
  slotIntervalMinutes: LCG_FIRST_STAGE_VAGINAL_EXAM_INTERVAL_MINUTES,
  offsetMinutes: 0,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_FIRST_STAGE_VAGINAL_EXAM_INTERVAL_MINUTES - 1,
};

const LABOUR_PROGRESS_SECOND_STAGE_UPPER_SLOT_OPTIONS = Array.from({ length: 4 }, (_, segmentIndex) => ({
  slotIntervalMinutes: LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES,
  offsetMinutes: segmentIndex * LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES,
  earlyAllowanceMinutes: 0,
  lateAllowanceMinutes: LCG_SECOND_STAGE_CONTRACTION_INTERVAL_MINUTES - 1,
}));

const LABOUR_PROGRESS_SECOND_STAGE_LOWER_SLOT_OPTIONS = [
  {
    slotIntervalMinutes: LCG_SECOND_STAGE_DESCENT_INTERVAL_MINUTES,
    offsetMinutes: 0,
    earlyAllowanceMinutes: 0,
    lateAllowanceMinutes: LCG_SECOND_STAGE_DESCENT_INTERVAL_MINUTES - 1,
  },
];

export type LabourProgressFormData = {
  hour: number;
  time: string;
  contractionsPer10Mins: string;
  durationOfContractions: string;
  cervicalDilation: number | '';
  descentOfHead: number | '';
  urgeToPush: '' | 'yes' | 'no';
};

export type LabourProgressFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LabourProgressFormData) => void;
  onDataSaved?: () => void;
  existingTimeEntries?: Array<{ hour: number; time: string }>;
  baseTime?: string;
  secondStageStartTime?: string;
  secondStageSlotCount?: number;
  slotCount?: number;
  selectedHours?: number[];
  existingLabourProgressFormData?: any[];
  patient?: {
    uuid: string;
    name: string;
    gender: string;
    age: string;
  };
  isEmergencyMode?: boolean;
  emergencyReason?: string;
};

const LabourProgressForm: React.FC<LabourProgressFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDataSaved,
  existingTimeEntries = [],
  baseTime,
  secondStageStartTime,
  secondStageSlotCount = 0,
  slotCount = 0,
  selectedHours = [],
  existingLabourProgressFormData = [],
  patient,
  isEmergencyMode = false,
  emergencyReason,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const now = useLcgFormClock(isOpen);
  const showScheduleDebug = process.env.NODE_ENV !== 'production';

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<LabourProgressFormData>({
    defaultValues: {
      hour: 0,
      time: '',
      contractionsPer10Mins: '',
      durationOfContractions: '',
      cervicalDilation: '',
      descentOfHead: '',
      urgeToPush: '',
    },
  });

  const selectedCervicalDilation = watch('cervicalDilation');
  const selectedTime = watch('time');
  const shouldShowUrgeToPush = selectedCervicalDilation === 10;
  const contractionsNumericValue = Number(watch('contractionsPer10Mins'));
  const durationNumericValue = Number(watch('durationOfContractions'));
  const showContractionsAlert =
    Number.isFinite(contractionsNumericValue) &&
    contractionsNumericValue !== 0 &&
    (contractionsNumericValue <= 2 || contractionsNumericValue > 5);
  const showDurationAlert =
    Number.isFinite(durationNumericValue) &&
    durationNumericValue !== 0 &&
    (durationNumericValue < 20 || durationNumericValue > 60);
  const hasUpperEntryData = React.useCallback(
    (entry: any) => Boolean(entry?.contractionsPer10Mins || entry?.durationOfContractions),
    [],
  );
  const hasFirstStageLowerEntryData = React.useCallback((entry: any) => {
    const hasCervicalDilation = entry?.cervicalDilation !== undefined && entry?.cervicalDilation !== '';
    const hasDescent = entry?.descentOfHead !== undefined && entry?.descentOfHead !== '';
    return hasCervicalDilation || hasDescent;
  }, []);
  const hasSecondStageDescentData = React.useCallback(
    (entry: any) => entry?.descentOfHead !== undefined && entry?.descentOfHead !== '',
    [],
  );

  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const secondStageElapsedMinutes = secondStageStartTime ? getForwardMinutesDelta(secondStageStartTime, nowHHMM) : null;
  const isSecondStageActive =
    Boolean(secondStageStartTime) &&
    secondStageElapsedMinutes !== null &&
    secondStageElapsedMinutes >= 0 &&
    secondStageElapsedMinutes <= 180;

  // Reset form when it opens
  React.useEffect(() => {
    if (isOpen) {
      reset({
        hour: 0,
        time: '',
        contractionsPer10Mins: '',
        durationOfContractions: '',
        cervicalDilation: '',
        descentOfHead: '',
        urgeToPush: '',
      });
      clearErrors();
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [isOpen, reset, clearErrors]);

  React.useEffect(() => {
    if (!(isSecondStageActive || shouldShowUrgeToPush)) {
      setValue('urgeToPush', '');
    }
  }, [isSecondStageActive, setValue, shouldShowUrgeToPush]);

  const generateHourOptions = () => {
    const options = [];
    options.push({ value: '0', label: '0hr' });
    for (let i = 1; i <= 48; i++) {
      const value = (i * 0.5).toString();
      const label = i % 2 === 0 ? `${i / 2}hr` : `${i * 0.5}hr`;
      options.push({ value, label });
    }
    return options;
  };

  const latestHour = React.useMemo(() => {
    if (!existingTimeEntries || existingTimeEntries.length === 0) {
      return null;
    }
    const hours = existingTimeEntries.map((e) => {
      const hourNum = typeof e.hour === 'number' ? e.hour : parseFloat(e.hour as any);
      return isNaN(hourNum) ? 0 : hourNum;
    });
    return Math.max(...hours);
  }, [existingTimeEntries]);

  const hourOptionsWithDisabled = React.useMemo(() => {
    return generateHourOptions().map((option) => {
      const hourValue = parseFloat(option.value);
      const isAlreadyInSelected = selectedHours.includes(hourValue);
      const isDisabled = (latestHour !== null && hourValue <= latestHour + 0.001) || isAlreadyInSelected;
      return {
        ...option,
        disabled: isDisabled,
        displayLabel: isDisabled ? `${option.label} (used)` : option.label,
      };
    });
  }, [latestHour, selectedHours]);

  const firstStageSlotCount = React.useMemo(() => {
    if (!secondStageStartTime || !baseTime) {
      return slotCount;
    }

    const minutesToSecondStage = getForwardMinutesDelta(baseTime, secondStageStartTime);
    if (minutesToSecondStage === null || minutesToSecondStage <= 0) {
      return slotCount;
    }

    return Math.min(slotCount, Math.max(0, Math.round(minutesToSecondStage / LCG_TIME_INCREMENT_MINUTES)));
  }, [baseTime, secondStageStartTime, slotCount]);

  const availableUpperSlotKeys = React.useMemo(() => {
    if (!baseTime || slotCount === 0) {
      return [];
    }

    if (secondStageStartTime && secondStageSlotCount > 0) {
      const availableSlots: string[] = [];

      Array.from({ length: secondStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
        LABOUR_PROGRESS_SECOND_STAGE_UPPER_SLOT_OPTIONS.forEach((option, segmentIndex) => {
          const slotKey = `second-stage-${segmentIndex}-${slotIndex}`;
          if (getPointSlotState(secondStageStartTime, slotIndex, now, option) === 'active') {
            availableSlots.push(slotKey);
          }
        });
      });

      return availableSlots;
    }

    if (firstStageSlotCount === 0) {
      return [];
    }

    const availableSlots: string[] = [];

    Array.from({ length: firstStageSlotCount }, (_, slotIndex) => slotIndex).forEach((slotIndex) => {
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
  const vaginalExamFilledSlotIndices = React.useMemo(() => {
    if (!baseTime || firstStageSlotCount <= 0) {
      return [] as number[];
    }

    const filledSlots = new Set<number>();

    existingLabourProgressFormData.forEach((entry) => {
      const hasVaginalExamData = entry?.cervicalDilation !== undefined || entry?.descentOfHead !== undefined;
      if (!hasVaginalExamData || !entry?.time) {
        return;
      }

      const slotIndex = getStageAwareSlotIndexForTime(
        baseTime,
        entry.time,
        firstStageSlotCount,
        0,
        secondStageStartTime,
      );

      if (slotIndex !== null && slotIndex >= 0 && slotIndex < firstStageSlotCount) {
        filledSlots.add(slotIndex);
      }
    });

    return Array.from(filledSlots).sort((left, right) => left - right);
  }, [baseTime, existingLabourProgressFormData, firstStageSlotCount, secondStageStartTime]);

  const firstStageLowerIntervalSlots = React.useMemo(
    () => Math.max(1, Math.round(LCG_FIRST_STAGE_VAGINAL_EXAM_INTERVAL_MINUTES / LCG_TIME_INCREMENT_MINUTES)),
    [],
  );

  const firstStageCurrentSlotIndex = React.useMemo(() => {
    if (!baseTime || firstStageSlotCount <= 0) {
      return null;
    }

    return getStageAwareSlotIndexForTime(baseTime, nowHHMM, firstStageSlotCount, 0);
  }, [baseTime, firstStageSlotCount, nowHHMM]);

  const firstStageLowerCandidateSlotIndex = React.useMemo(() => {
    if (firstStageCurrentSlotIndex === null || firstStageSlotCount <= 0) {
      return null;
    }

    if (vaginalExamFilledSlotIndices.length === 0) {
      return Math.min(firstStageCurrentSlotIndex, firstStageSlotCount - 1);
    }

    const latestFilledSlotIndex = Math.max(...vaginalExamFilledSlotIndices);
    const nextDueSlotIndex = latestFilledSlotIndex + firstStageLowerIntervalSlots;
    const candidateSlotIndex =
      firstStageCurrentSlotIndex < nextDueSlotIndex ? nextDueSlotIndex : firstStageCurrentSlotIndex;

    if (candidateSlotIndex < 0 || candidateSlotIndex >= firstStageSlotCount) {
      return null;
    }

    return candidateSlotIndex;
  }, [firstStageCurrentSlotIndex, firstStageLowerIntervalSlots, firstStageSlotCount, vaginalExamFilledSlotIndices]);

  const availableLowerFirstStageSlotIndices = React.useMemo(() => {
    if (!baseTime || firstStageCurrentSlotIndex === null || firstStageSlotCount <= 0) {
      return [] as number[];
    }

    if (getSlotState(baseTime, firstStageCurrentSlotIndex, now) === 'active') {
      return [firstStageCurrentSlotIndex];
    }

    if (firstStageLowerCandidateSlotIndex === null || firstStageCurrentSlotIndex < firstStageLowerCandidateSlotIndex) {
      return [] as number[];
    }

    return [firstStageLowerCandidateSlotIndex];
  }, [baseTime, firstStageCurrentSlotIndex, firstStageLowerCandidateSlotIndex, firstStageSlotCount, now]);

  const availableLowerSlotIndices = React.useMemo(() => {
    if (!baseTime || slotCount === 0) {
      return [] as Array<
        | number
        | {
            slotIndex: number;
            segmentIndex: number;
            option: (typeof LABOUR_PROGRESS_SECOND_STAGE_LOWER_SLOT_OPTIONS)[0];
          }
      >;
    }

    if (secondStageStartTime && secondStageSlotCount > 0) {
      return Array.from({ length: secondStageSlotCount }, (_, slotIndex) => slotIndex)
        .flatMap((slotIndex) =>
          LABOUR_PROGRESS_SECOND_STAGE_LOWER_SLOT_OPTIONS.map((option, segmentIndex) => ({
            slotIndex,
            segmentIndex,
            option,
          })),
        )
        .filter(
          ({ slotIndex, option }) => getPointSlotState(secondStageStartTime, slotIndex, now, option) === 'active',
        );
    }

    return availableLowerFirstStageSlotIndices;
  }, [availableLowerFirstStageSlotIndices, baseTime, now, secondStageSlotCount, secondStageStartTime, slotCount]);

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
          LABOUR_PROGRESS_SECOND_STAGE_UPPER_SLOT_OPTIONS.flatMap((option, segmentIndex) => {
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
          LABOUR_PROGRESS_SECOND_STAGE_LOWER_SLOT_OPTIONS.flatMap((option, segmentIndex) => {
            const slotIndices = (availableLowerSlotIndices as Array<{ slotIndex: number; segmentIndex: number }>)
              .filter((item) => item.segmentIndex === segmentIndex)
              .map((item) => item.slotIndex);

            return getAllowedPointTimesForSlots(secondStageStartTime, slotIndices, option, now);
          }),
        ),
      ).sort();
    }

    return getAllowedPointTimesForSlots(
      baseTime,
      availableLowerSlotIndices as number[],
      LABOUR_PROGRESS_LOWER_SLOT_OPTIONS,
      now,
    );
  }, [availableLowerSlotIndices, baseTime, isEmergencyMode, now, secondStageSlotCount, secondStageStartTime]);

  const latestFirstStageLowerEntryTime = React.useMemo(() => {
    const orderedLowerEntries = [...existingLabourProgressFormData]
      .filter((entry) => hasFirstStageLowerEntryData(entry) && entry?.time)
      .sort(
        (left, right) =>
          new Date(left?.encounterDatetime ?? 0).getTime() - new Date(right?.encounterDatetime ?? 0).getTime(),
      );

    let lastTime: string | null = null;

    for (const entry of orderedLowerEntries) {
      const slotIndex = getStageAwareSlotIndexForTime(
        baseTime ?? '',
        entry.time,
        firstStageSlotCount,
        0,
        secondStageStartTime,
      );
      if (slotIndex !== null && slotIndex >= 0 && slotIndex < firstStageSlotCount) {
        lastTime = entry.time;
      }
    }

    return lastTime;
  }, [
    baseTime,
    existingLabourProgressFormData,
    firstStageSlotCount,
    hasFirstStageLowerEntryData,
    secondStageStartTime,
  ]);

  const nextLowerDueTime = React.useMemo(() => {
    if (!latestFirstStageLowerEntryTime) {
      return null;
    }

    const lastMinutes = parseHHMMToMinutes(latestFirstStageLowerEntryTime);
    if (lastMinutes === null) {
      return null;
    }

    return formatMinutesToHHMM(lastMinutes + LCG_FIRST_STAGE_VAGINAL_EXAM_INTERVAL_MINUTES);
  }, [latestFirstStageLowerEntryTime]);

  const currentLowerCatchUpOpenTime = React.useMemo(() => {
    if (lowerAllowedTimes.length === 0) {
      return null;
    }

    return lowerAllowedTimes[0];
  }, [lowerAllowedTimes]);

  const slotAllowedTimes = React.useMemo(() => {
    return Array.from(new Set([...upperAllowedTimes, ...lowerAllowedTimes])).sort();
  }, [lowerAllowedTimes, upperAllowedTimes]);

  const displayAllowedTimes = React.useMemo(() => {
    if (slotAllowedTimes.length > 0) {
      return slotAllowedTimes;
    }
    const nowHHMM = formatHHMM(now);
    return nowHHMM ? [nowHHMM] : [];
  }, [now, slotAllowedTimes]);

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
    if (!baseTime || firstStageCurrentSlotIndex === null || firstStageSlotCount <= 0) {
      return false;
    }
    if (secondStageStartTime && secondStageSlotCount > 0) {
      return false;
    }
    return getSlotState(baseTime, firstStageCurrentSlotIndex, now) === 'active';
  }, [baseTime, firstStageCurrentSlotIndex, firstStageSlotCount, now, secondStageSlotCount, secondStageStartTime]);

  const isSelectedTimeInActiveFirstStageGridSlot = React.useMemo(() => {
    if (!isActiveFirstStageGridSlotOpen || !selectedTime || !baseTime) {
      return false;
    }
    const slotIndex = getStageAwareSlotIndexForTime(
      baseTime,
      selectedTime,
      firstStageSlotCount,
      0,
      secondStageStartTime,
    );
    return slotIndex === firstStageCurrentSlotIndex;
  }, [
    baseTime,
    firstStageCurrentSlotIndex,
    firstStageSlotCount,
    isActiveFirstStageGridSlotOpen,
    secondStageStartTime,
    selectedTime,
  ]);

  const canEditUpper = isEmergencyMode || selectedAllowsUpper || isActiveFirstStageGridSlotOpen;
  const canEditLower = isEmergencyMode || selectedAllowsLower || isActiveFirstStageGridSlotOpen;

  const isInputLocked =
    !isEmergencyMode && Boolean(baseTime) && slotAllowedTimes.length === 0 && !isActiveFirstStageGridSlotOpen;

  const shouldShowUrgeToPushField = isSecondStageActive || shouldShowUrgeToPush;
  const minutesFromBaseAtSelectedTime = React.useMemo(() => {
    if (!baseTime || !selectedTime) {
      return null;
    }

    return getForwardMinutesDelta(baseTime, selectedTime);
  }, [baseTime, selectedTime]);

  const isFirstStageVaginalExamTime = React.useMemo(() => {
    if (isSecondStageActive || !baseTime || firstStageSlotCount <= 0) {
      return false;
    }

    if (isActiveFirstStageGridSlotOpen) {
      return true;
    }

    if (!selectedTime) {
      return false;
    }

    const slotIndex = getPointSlotIndexForTime(
      baseTime,
      selectedTime,
      firstStageSlotCount,
      LABOUR_PROGRESS_LOWER_SLOT_OPTIONS,
    );
    return slotIndex !== null && availableLowerFirstStageSlotIndices.includes(slotIndex);
  }, [
    availableLowerFirstStageSlotIndices,
    baseTime,
    firstStageSlotCount,
    isActiveFirstStageGridSlotOpen,
    isSecondStageActive,
    selectedTime,
  ]);

  const isSecondStageDescentTime = React.useMemo(() => {
    if (!isSecondStageActive || !secondStageStartTime || !selectedTime) {
      return false;
    }

    return lowerAllowedTimes.includes(selectedTime);
  }, [isSecondStageActive, lowerAllowedTimes, secondStageStartTime, selectedTime]);

  const upperFieldsDisabled = !canEditUpper;
  const cervicalFieldDisabled = !canEditLower || isSecondStageActive || !isFirstStageVaginalExamTime;
  const descentFieldDisabled = isSecondStageActive ? !canEditLower : !canEditLower || !isFirstStageVaginalExamTime;
  const urgeFieldDisabled = isSecondStageActive ? !canEditUpper : !canEditLower;

  const handleFormSubmit = async (data: LabourProgressFormData) => {
    clearErrors();
    setSaveError(null);
    setSaveSuccess(false);

    if (data.hour === undefined || data.hour === null) {
      setError('hour', { type: 'manual', message: t('hourRequired', 'Please select a valid hour') });
      return;
    }

    if (!data.time) {
      setError('time', { type: 'manual', message: t('timeRequired', 'Time is required') });
      return;
    }

    if (!isEmergencyMode && (!baseTime || slotCount === 0)) {
      setError('time', {
        type: 'manual',
        message: t(
          'labourCareGuideTimeRequired',
          'Set the labour care guide time before entering labour progress data',
        ),
      });
      return;
    }

    const isUpperTime = upperAllowedTimes.includes(data.time) || isSelectedTimeInActiveFirstStageGridSlot;
    const isLowerTime = lowerAllowedTimes.includes(data.time) || isSelectedTimeInActiveFirstStageGridSlot;
    const hasUpperInput = Boolean(data.contractionsPer10Mins || data.durationOfContractions);
    const hasLowerMeasurementInput = data.cervicalDilation !== '' || data.descentOfHead !== '';
    const hasUrgeInput = Boolean(data.urgeToPush);
    const hasLowerInput = hasLowerMeasurementInput || hasUrgeInput;

    if (!isEmergencyMode && !isUpperTime && !isLowerTime) {
      setError('time', {
        type: 'manual',
        message: t('labourProgressTimeOutOfRange', 'Select a time within the currently allowed labour progress window'),
      });
      return;
    }

    if (!hasUpperInput && !hasLowerInput) {
      setSaveError(
        t('enterAtLeastOneLabourSection', 'Enter at least one complete labour progress section before saving'),
      );
      return;
    }

    if (!isEmergencyMode && hasUpperInput && !isUpperTime) {
      setError('time', {
        type: 'manual',
        message: t('labourUpperTimeOutOfRange', 'Selected time is not open for contractions entry'),
      });
      return;
    }

    if (!isEmergencyMode && hasLowerMeasurementInput && !isLowerTime) {
      setError('time', {
        type: 'manual',
        message: t('labourLowerTimeOutOfRange', 'Selected time is not open for cervix/descent entry'),
      });
      return;
    }

    if (!isEmergencyMode && hasUrgeInput && isSecondStageActive && !isUpperTime) {
      setError('time', {
        type: 'manual',
        message: t('urgeToPushSecondStageTimeOutOfRange', 'Urge to Push in second stage is entered every 15 minutes'),
      });
      return;
    }

    if (!isEmergencyMode && hasUrgeInput && !isSecondStageActive && !isLowerTime) {
      setError('time', {
        type: 'manual',
        message: t('urgeToPushFirstStageTimeOutOfRange', 'Urge to Push in first stage follows vaginal exam timing'),
      });
      return;
    }

    const minutesFromBaseTime = baseTime ? getForwardMinutesDelta(baseTime, data.time) : null;

    if (hasUpperInput && !data.contractionsPer10Mins) {
      setError('contractionsPer10Mins', {
        type: 'manual',
        message: t('contractionsRequired', 'Contractions per 10 min is required'),
      });
      return;
    }

    if (hasUpperInput && !data.durationOfContractions) {
      setError('durationOfContractions', {
        type: 'manual',
        message: t('durationRequired', 'Duration of contractions is required'),
      });
      return;
    }

    if (data.cervicalDilation !== '' && (Number(data.cervicalDilation) < 5 || Number(data.cervicalDilation) > 10)) {
      setError('cervicalDilation', {
        type: 'manual',
        message: t('cervixRangeValidation', 'Cervix must be between 5 and 10 cm'),
      });
      return;
    }

    if (data.descentOfHead !== '' && (Number(data.descentOfHead) < 0 || Number(data.descentOfHead) > 5)) {
      setError('descentOfHead', {
        type: 'manual',
        message: t('descentRangeValidation', 'Descent of head must be between 0 and 5'),
      });
      return;
    }

    if (shouldShowUrgeToPushField && (hasLowerMeasurementInput || isSecondStageActive) && !data.urgeToPush) {
      setError('urgeToPush', {
        type: 'manual',
        message: t('urgeToPushRequired', 'Select Yes or No for Urge to Push'),
      });
      return;
    }

    if (hasLowerMeasurementInput && isSecondStageActive && data.cervicalDilation !== '') {
      setError('cervicalDilation', {
        type: 'manual',
        message: t('cervixClosedInSecondStage', 'Cervix entry is closed in second stage'),
      });
      return;
    }

    if (hasLowerMeasurementInput && !isSecondStageActive && data.cervicalDilation !== '') {
      if (!isFirstStageVaginalExamTime) {
        setError('cervicalDilation', {
          type: 'manual',
          message: t('cervixHourlyRule', 'Cervical dilation reopens on the next 1-hour labour progress slot'),
        });
        return;
      }
    }

    if (hasLowerMeasurementInput && !isSecondStageActive && data.descentOfHead !== '') {
      if (!isFirstStageVaginalExamTime) {
        setError('descentOfHead', {
          type: 'manual',
          message: t('descentHourlyRule', 'Descent reopens on the next 1-hour labour progress slot'),
        });
        return;
      }
    }

    if (hasLowerMeasurementInput && isSecondStageActive && !isSecondStageDescentTime && data.descentOfHead !== '') {
      setError('descentOfHead', {
        type: 'manual',
        message: t('descent30MinuteRule', 'Descent of head can only be entered every 30 minutes in second stage'),
      });
      return;
    }

    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSaveSuccess(true);

      if (onDataSaved) {
        onDataSaved();
      }

      onSubmit(data);

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

  return (
    <Modal
      open={isOpen}
      onRequestClose={handleClose}
      modalHeading={t('labourProgressData', 'Labour Progress: Cervix & Descent')}
      primaryButtonText={isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
      primaryButtonDisabled={isSaving || isInputLocked}
      secondaryButtonText={t('cancel', 'Cancel')}
      onRequestSubmit={handleSubmit(handleFormSubmit)}
      onSecondarySubmit={handleClose}
      className={styles.cervixModal}
      size="md">
      {saveSuccess && (
        <InlineNotification
          kind="success"
          title={t('saveSuccess', 'Data saved successfully')}
          subtitle={t('labourProgressDataSaved', 'LabourProgress and descent data has been saved')}
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
        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="time"
              control={control}
              render={({ field, fieldState }) => (
                <div>
                  <label className={styles.fieldLabel}>{t('time', 'Time')}</label>
                  <LabourProgressTimePickerDropdown
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
              name="contractionsPer10Mins"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="contractions-per-10-mins"
                  label={t('contractionsPer10Mins', 'Contractions per 10 min')}
                  helperText={
                    showContractionsAlert
                      ? t('contractionsAlertRange', 'Alert range is <= 2 or > 5')
                      : t('numericalOnly', 'Numerical entry')
                  }
                  min={0}
                  max={10}
                  value={field.value}
                  disabled={upperFieldsDisabled}
                  onChange={(event, { value }) => field.onChange(String(value ?? ''))}
                />
              )}
            />
          </div>
        </Column>

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="durationOfContractions"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="duration-of-contractions"
                  label={t('durationOfContractions', 'Duration of contractions (seconds)')}
                  helperText={
                    showDurationAlert
                      ? t('durationAlertRange', 'Alert range is < 20 or > 60 seconds')
                      : t('numericalOnly', 'Numerical entry')
                  }
                  min={0}
                  value={field.value}
                  disabled={upperFieldsDisabled}
                  onChange={(event, { value }) => field.onChange(String(value ?? ''))}
                />
              )}
            />
          </div>
        </Column>

        {!isSecondStageActive ? (
          <Column lg={8} md={4} sm={2}>
            <div className={styles.formField}>
              <Controller
                name="cervicalDilation"
                control={control}
                render={({ field }) => (
                  <NumberInput
                    id="cervical-dilation"
                    label={t('cervicalDilation', 'Cervical Dilation (cm)')}
                    min={5}
                    max={10}
                    value={field.value}
                    disabled={cervicalFieldDisabled}
                    invalid={Boolean(errors.cervicalDilation)}
                    invalidText={
                      errors.cervicalDilation?.message ||
                      (!isInputLocked && !isSecondStageActive && !isFirstStageVaginalExamTime
                        ? t('cervixHourlyWindow', 'Cervical dilation opens every 1 hour in first stage')
                        : undefined)
                    }
                    onChange={(event, { value }) => {
                      const nextValue = String(value ?? '');
                      field.onChange(nextValue === '' ? '' : parseFloat(nextValue));
                    }}
                  />
                )}
              />
            </div>
          </Column>
        ) : null}

        <Column lg={8} md={4} sm={2}>
          <div className={styles.formField}>
            <Controller
              name="descentOfHead"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="descent-of-head"
                  label={t('descentOfHead', 'Descent of Head')}
                  min={0}
                  max={5}
                  value={field.value}
                  disabled={descentFieldDisabled}
                  invalid={Boolean(errors.descentOfHead)}
                  invalidText={
                    errors.descentOfHead?.message ||
                    (isSecondStageActive && !isSecondStageDescentTime
                      ? t('descentSecondStageWindow', 'Descent of head opens every 30 minutes in second stage')
                      : !isInputLocked && !isSecondStageActive && !isFirstStageVaginalExamTime
                        ? t('descentFirstStageWindow', 'Descent of head opens every 1 hour in first stage')
                        : undefined)
                  }
                  onChange={(event, { value }) => {
                    const nextValue = String(value ?? '');
                    field.onChange(nextValue === '' ? '' : parseFloat(nextValue));
                  }}
                />
              )}
            />
          </div>
        </Column>
        {shouldShowUrgeToPushField ? (
          <Column lg={8} md={4} sm={4}>
            <div className={styles.formField}>
              <Controller
                name="urgeToPush"
                control={control}
                render={({ field }) => (
                  <Select
                    id="urge-to-push"
                    labelText={t('urgeToPush', 'Urge to Push')}
                    disabled={urgeFieldDisabled}
                    invalid={Boolean(errors.urgeToPush)}
                    invalidText={errors.urgeToPush?.message}
                    {...field}>
                    <SelectItem value="" text={t('selectOption', 'Select an option')} />
                    <SelectItem value="yes" text={t('yes', 'Yes')} />
                    <SelectItem value="no" text={t('no', 'No')} />
                  </Select>
                )}
              />
            </div>
          </Column>
        ) : null}
      </Grid>
    </Modal>
  );
};

export default LabourProgressForm;
