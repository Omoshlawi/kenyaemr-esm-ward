import React, { useEffect, useMemo, useCallback, useId, useRef } from 'react';
import { Select, SelectItem, FormGroup } from '@carbon/react';
import styles from './time-picker-dropdown.scss';
import { LCG_TIME_INCREMENT_MINUTES } from '../types';

export interface TimePickerDropdownProps {
  id: string;
  labelText: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  invalidText?: string;
  disabled?: boolean;
  existingTimeEntries?: Array<{ time: string; hour?: number }>;
  allowedTimes?: string[];
  currentTime?: string;
  /** When true, times before or after currentTime are disabled; defaults to current time. */
  disablePastTimes?: boolean;
}

const toTotalMinutes = (time: string): number | null => {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

const TimePickerDropdown: React.FC<TimePickerDropdownProps> = ({
  id,
  labelText,
  value,
  onChange,
  invalid = false,
  invalidText,
  disabled = false,
  existingTimeEntries = [],
  allowedTimes,
  currentTime,
  disablePastTimes = false,
}) => {
  const instanceId = useId().replace(/:/g, '_');
  const resolvedId = `${id}-${instanceId}`;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [hours, minutes] = value && value.includes(':') ? value.split(':') : ['', ''];

  const hasRestrictedTimes = Array.isArray(allowedTimes);
  const hasRestrictedOptions = hasRestrictedTimes && (allowedTimes?.length ?? 0) > 0;

  const currentTotalMinutes = useMemo(() => (currentTime ? toTotalMinutes(currentTime) : null), [currentTime]);

  const isTimeInPast = useCallback(
    (time: string) => {
      if (!disablePastTimes || currentTotalMinutes === null) {
        return false;
      }
      const timeMinutes = toTotalMinutes(time);
      return timeMinutes !== null && timeMinutes < currentTotalMinutes;
    },
    [currentTotalMinutes, disablePastTimes],
  );

  const isTimeInFuture = useCallback(
    (time: string) => {
      if (!disablePastTimes || currentTotalMinutes === null) {
        return false;
      }
      const timeMinutes = toTotalMinutes(time);
      return timeMinutes !== null && timeMinutes > currentTotalMinutes;
    },
    [currentTotalMinutes, disablePastTimes],
  );

  const restrictedTimeIndex = useMemo(() => {
    if (!hasRestrictedOptions) {
      return null;
    }

    const byHour = new Map<string, string[]>();

    for (const time of allowedTimes ?? []) {
      const [hour, minute] = time.split(':');
      if (!hour || !minute) {
        continue;
      }

      const hourMinutes = byHour.get(hour) ?? [];
      if (!hourMinutes.includes(minute)) {
        hourMinutes.push(minute);
      }
      byHour.set(hour, hourMinutes);
    }

    return byHour;
  }, [allowedTimes, hasRestrictedOptions]);

  const restrictedMinuteStep = useMemo(() => {
    if (!hasRestrictedOptions || !allowedTimes?.length) {
      return LCG_TIME_INCREMENT_MINUTES;
    }

    const minuteValues = allowedTimes
      .map(toTotalMinutes)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    if (minuteValues.length < 2) {
      return LCG_TIME_INCREMENT_MINUTES;
    }

    const gcd = (a: number, b: number): number => {
      let x = Math.abs(a);
      let y = Math.abs(b);
      while (y !== 0) {
        const temp = x % y;
        x = y;
        y = temp;
      }
      return x;
    };

    let computedStep = 0;
    for (let i = 1; i < minuteValues.length; i += 1) {
      const delta = minuteValues[i] - minuteValues[i - 1];
      if (delta > 0) {
        computedStep = computedStep === 0 ? delta : gcd(computedStep, delta);
      }
    }

    return computedStep > 0 ? computedStep : LCG_TIME_INCREMENT_MINUTES;
  }, [allowedTimes, hasRestrictedOptions]);

  const defaultTime = useMemo(() => {
    if (!hasRestrictedOptions || !allowedTimes?.length) {
      return null;
    }

    if (disablePastTimes && currentTime && allowedTimes.includes(currentTime)) {
      return currentTime;
    }

    if (!currentTime) {
      return allowedTimes[0] ?? null;
    }

    if (currentTotalMinutes === null) {
      return allowedTimes[0] ?? null;
    }

    const atOrBeforeNow = allowedTimes.filter((time) => {
      const timeMinutes = toTotalMinutes(time);
      return timeMinutes !== null && timeMinutes <= currentTotalMinutes;
    });

    if (atOrBeforeNow.length > 0) {
      return atOrBeforeNow[atOrBeforeNow.length - 1];
    }

    return allowedTimes[0] ?? null;
  }, [allowedTimes, currentTime, currentTotalMinutes, disablePastTimes, hasRestrictedOptions]);

  const syncTimeValue = useCallback(
    (nextTime: string) => {
      if (!nextTime || nextTime === value) {
        return;
      }
      onChangeRef.current(nextTime);
    },
    [value],
  );

  useEffect(() => {
    if (disabled || !defaultTime) {
      return;
    }

    if (disablePastTimes && currentTime) {
      if (!value) {
        syncTimeValue(defaultTime ?? currentTime);
        return;
      }

      if (isTimeInPast(value) || isTimeInFuture(value)) {
        const fallback = allowedTimes?.includes(currentTime)
          ? currentTime
          : (defaultTime ?? allowedTimes?.[0] ?? currentTime);
        syncTimeValue(fallback);
        return;
      }

      if (allowedTimes?.includes(currentTime) && value !== currentTime) {
        syncTimeValue(currentTime);
      }
      return;
    }

    if (!value) {
      syncTimeValue(defaultTime);
    }
  }, [
    allowedTimes,
    currentTime,
    defaultTime,
    disablePastTimes,
    disabled,
    isTimeInFuture,
    isTimeInPast,
    syncTimeValue,
    value,
  ]);

  const latestEntry = useMemo(() => {
    if (hasRestrictedTimes) return null;
    if (!existingTimeEntries || existingTimeEntries.length === 0) return null;

    const sorted = existingTimeEntries.slice().sort((a, b) => {
      const aTime = a.time.split(':').map(Number);
      const bTime = b.time.split(':').map(Number);
      return aTime[0] * 60 + aTime[1] - (bTime[0] * 60 + bTime[1]);
    });
    return sorted[sorted.length - 1];
  }, [existingTimeEntries, hasRestrictedTimes]);

  const hourOptions = useMemo(() => {
    if (hasRestrictedTimes) {
      if (!hasRestrictedOptions) {
        return [];
      }

      return Array.from(restrictedTimeIndex?.keys() ?? []).map((hour) => {
        const hourMinutes = restrictedTimeIndex?.get(hour) ?? [];
        const allUnavailable =
          disablePastTimes &&
          currentTotalMinutes !== null &&
          hourMinutes.length > 0 &&
          hourMinutes.every((minute) => {
            const time = `${hour}:${minute}`;
            return isTimeInPast(time) || isTimeInFuture(time);
          });

        return {
          value: hour,
          text: hour,
          disabled: allUnavailable,
        };
      });
    }

    if (!latestEntry) {
      return Array.from({ length: 24 }, (_, i) => ({
        value: i.toString().padStart(2, '0'),
        text: i.toString().padStart(2, '0'),
        disabled: false,
      }));
    }

    const [latestHour, latestMinute] = latestEntry.time.split(':').map(Number);
    return Array.from({ length: 24 }, (_, i) => {
      const hour = i.toString().padStart(2, '0');
      let isDisabled = i < latestHour || (i === latestHour && latestMinute >= 55);
      return { value: hour, text: hour, disabled: isDisabled };
    });
  }, [
    currentTotalMinutes,
    disablePastTimes,
    hasRestrictedOptions,
    hasRestrictedTimes,
    isTimeInFuture,
    isTimeInPast,
    latestEntry,
    restrictedTimeIndex,
  ]);

  const minuteOptions = useMemo(() => {
    if (hasRestrictedTimes) {
      if (!hasRestrictedOptions) {
        return [];
      }

      const allowedMinutesSet = new Set(restrictedTimeIndex?.get(hours) ?? []);
      const baseMinuteValues = new Set<string>();

      for (let minute = 0; minute < 60; minute += restrictedMinuteStep) {
        baseMinuteValues.add(String(minute).padStart(2, '0'));
      }

      for (const minute of allowedMinutesSet) {
        baseMinuteValues.add(minute);
      }

      return Array.from(baseMinuteValues)
        .sort((left, right) => Number(left) - Number(right))
        .map((minute) => {
          const time = `${hours || '00'}:${minute}`;
          const notAllowed = !allowedMinutesSet.has(minute);

          return {
            value: minute,
            text: minute,
            disabled: notAllowed || isTimeInPast(time) || isTimeInFuture(time),
          };
        });
    }

    if (!latestEntry || !hours) {
      return Array.from({ length: 60 }, (_, i) => ({
        value: i.toString().padStart(2, '0'),
        text: i.toString().padStart(2, '0'),
        disabled: false,
      }));
    }

    const [latestHour, latestMinute] = latestEntry.time.split(':').map(Number);
    const currentHour = parseInt(hours);
    return Array.from({ length: 60 }, (_, i) => {
      const minute = i.toString().padStart(2, '0');
      const isDisabled = currentHour < latestHour || (currentHour === latestHour && i <= latestMinute);
      return { value: minute, text: minute, disabled: isDisabled };
    });
  }, [
    hasRestrictedOptions,
    hasRestrictedTimes,
    hours,
    isTimeInFuture,
    isTimeInPast,
    latestEntry,
    restrictedMinuteStep,
    restrictedTimeIndex,
  ]);

  const pickFirstSelectableMinute = useCallback(
    (selectedHour: string) => {
      const hourMinutes = restrictedTimeIndex?.get(selectedHour) ?? [];
      const selectable = hourMinutes.filter((minute) => {
        const time = `${selectedHour}:${minute}`;
        return !isTimeInPast(time) && !isTimeInFuture(time);
      });
      return selectable[0] ?? hourMinutes[0] ?? null;
    },
    [isTimeInFuture, isTimeInPast, restrictedTimeIndex],
  );

  const handleHourChange = useCallback(
    (selectedHour: string) => {
      if (!selectedHour || disabled) return;

      if (hasRestrictedTimes) {
        const minute = pickFirstSelectableMinute(selectedHour);
        if (minute) {
          onChange(`${selectedHour}:${minute}`);
        }
        return;
      }

      onChange(`${selectedHour}:00`);
    },
    [disabled, hasRestrictedTimes, onChange, pickFirstSelectableMinute],
  );

  const handleMinuteChange = useCallback(
    (selectedMinute: string) => {
      if (disabled) return;
      onChange(`${hours || '00'}:${selectedMinute}`);
    },
    [disabled, hours, onChange],
  );

  const pickerDisabled =
    disabled || (hasRestrictedTimes && !hasRestrictedOptions) || hourOptions.every((option) => option.disabled);

  return (
    <div className={styles.timePickerContainer}>
      <FormGroup legendText={labelText} invalid={invalid === true}>
        <div className={styles.timeInputsWrapper}>
          <div className={styles.timeInput}>
            <Select
              id={`${resolvedId}-hours`}
              labelText="Hours (HH)"
              value={hours}
              onChange={(e) => handleHourChange((e.target as HTMLSelectElement).value)}
              disabled={pickerDisabled}
              invalid={invalid === true}>
              <SelectItem value="" text={hasRestrictedTimes && !hasRestrictedOptions ? 'No times' : 'HH'} />
              {hourOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} text={option.text} disabled={option.disabled} />
              ))}
            </Select>
          </div>

          <div className={styles.separator}>:</div>

          <div className={styles.timeInput}>
            <Select
              id={`${resolvedId}-minutes`}
              labelText="Minutes (MM)"
              value={minutes}
              onChange={(e) => handleMinuteChange((e.target as HTMLSelectElement).value)}
              disabled={
                pickerDisabled ||
                !hours ||
                minuteOptions.length === 0 ||
                minuteOptions.every((option) => option.disabled)
              }
              invalid={invalid === true}>
              <SelectItem value="" text="MM" />
              {minuteOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} text={option.text} disabled={option.disabled} />
              ))}
            </Select>
          </div>
        </div>

        {invalid && invalidText && <div className={styles.errorText}>{invalidText}</div>}
      </FormGroup>
    </div>
  );
};

export default React.memo(TimePickerDropdown);
