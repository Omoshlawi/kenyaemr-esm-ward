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
}

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
}) => {
  const instanceId = useId().replace(/:/g, '_');
  const resolvedId = `${id}-${instanceId}`;
  const lastAutoSelectionRef = useRef<string | null>(null);
  const [hours, minutes] = value && value.includes(':') ? value.split(':') : ['', ''];
  const hasRestrictedTimes = Array.isArray(allowedTimes);
  const hasRestrictedOptions = hasRestrictedTimes && (allowedTimes?.length ?? 0) > 0;

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

    const toMinutes = (time: string) => {
      const [hh, mm] = time.split(':').map(Number);
      if (Number.isNaN(hh) || Number.isNaN(mm)) {
        return null;
      }
      return hh * 60 + mm;
    };

    const minuteValues = allowedTimes
      .map(toMinutes)
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

  const preferredAllowedTime = useMemo(() => {
    if (!hasRestrictedOptions || !allowedTimes?.length) {
      return null;
    }

    if (!currentTime) {
      return allowedTimes[0] ?? null;
    }

    const currentMinutes = currentTime.split(':').map(Number);
    if (currentMinutes.length !== 2 || currentMinutes.some((part) => Number.isNaN(part))) {
      return allowedTimes[0] ?? null;
    }

    const currentTotalMinutes = currentMinutes[0] * 60 + currentMinutes[1];

    return allowedTimes.reduce<string | null>((closestTime, candidateTime) => {
      const [candidateHour, candidateMinute] = candidateTime.split(':').map(Number);
      const candidateTotalMinutes = candidateHour * 60 + candidateMinute;

      if (!closestTime) {
        return candidateTime;
      }

      const [closestHour, closestMinute] = closestTime.split(':').map(Number);
      const closestTotalMinutes = closestHour * 60 + closestMinute;

      const candidateDistance = Math.abs(candidateTotalMinutes - currentTotalMinutes);
      const closestDistance = Math.abs(closestTotalMinutes - currentTotalMinutes);

      return candidateDistance < closestDistance ? candidateTime : closestTime;
    }, null);
  }, [allowedTimes, currentTime, hasRestrictedOptions]);

  useEffect(() => {
    if (disabled || value || !preferredAllowedTime) {
      return;
    }

    if (lastAutoSelectionRef.current === preferredAllowedTime) {
      return;
    }

    lastAutoSelectionRef.current = preferredAllowedTime;
    onChange(preferredAllowedTime);
  }, [disabled, onChange, preferredAllowedTime, value]);

  useEffect(() => {
    if (value) {
      lastAutoSelectionRef.current = null;
    }
  }, [value]);

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

      return Array.from(restrictedTimeIndex?.keys() ?? []).map((hour) => ({
        value: hour,
        text: hour,
        disabled: false,
      }));
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
  }, [hasRestrictedOptions, hasRestrictedTimes, latestEntry, restrictedTimeIndex]);

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
        .map((minute) => ({
          value: minute,
          text: minute,
          disabled: !allowedMinutesSet.has(minute),
        }));
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
  }, [hasRestrictedOptions, hasRestrictedTimes, hours, latestEntry, restrictedMinuteStep, restrictedTimeIndex]);

  const handleHourChange = useCallback(
    (selectedHour: string) => {
      if (!selectedHour || disabled) return;

      if (hasRestrictedTimes) {
        const firstAllowedMinute = restrictedTimeIndex?.get(selectedHour)?.[0];
        if (firstAllowedMinute) {
          onChange(`${selectedHour}:${firstAllowedMinute}`);
        }
        return;
      }

      onChange(`${selectedHour}:00`);
    },
    [disabled, hasRestrictedTimes, restrictedTimeIndex, onChange],
  );

  const handleMinuteChange = useCallback(
    (selectedMinute: string) => {
      if (disabled) return;
      onChange(`${hours || '00'}:${selectedMinute}`);
    },
    [disabled, hours, onChange],
  );

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
              disabled={
                disabled ||
                (hasRestrictedTimes && !hasRestrictedOptions) ||
                hourOptions.every((option) => option.disabled)
              }
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
                disabled ||
                (hasRestrictedTimes && !hasRestrictedOptions) ||
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
