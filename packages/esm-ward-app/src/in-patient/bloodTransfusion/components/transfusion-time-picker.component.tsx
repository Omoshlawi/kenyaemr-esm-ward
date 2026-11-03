import React, { useId, useMemo } from 'react';
import { Button, Select, SelectItem } from '@carbon/react';
import { Time } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './transfusion-time-picker.scss';

export type TransfusionTimePickerProps = {
  id: string;
  labelText: React.ReactNode;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  invalid?: boolean;
  invalidText?: string;
  hideLabel?: boolean;
  compact?: boolean;
  /** `HH:MM` — times before this are disabled (e.g. earlier observation rows). */
  minTime?: string;
  /** `HH:MM` — times after this are disabled (same-day future guard). */
  maxTime?: string;
  showNowButton?: boolean;
  /** Used by the Now button when `maxTime` is not set. `YYYY-MM-DDTHH:MM` or `HH:MM`. */
  nowLocal?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function parseParts(value: string | undefined): { hour: string; minute: string } {
  if (value?.includes(':')) {
    const [hour = '', minute = ''] = value.split(':');
    return { hour, minute: minute.slice(0, 2) };
  }
  return { hour: '', minute: '' };
}

function toMinutes(time: string | undefined): number | null {
  if (!time?.includes(':')) {
    return null;
  }
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return null;
  }
  return h * 60 + m;
}

function clockFromNowLocal(nowLocal: string | undefined): string | undefined {
  if (!nowLocal) {
    return undefined;
  }
  return nowLocal.includes('T') ? nowLocal.slice(11, 16) : nowLocal.slice(0, 5);
}

function clampToRange(totalMinutes: number, minMinutes: number | null, maxMinutes: number | null): number {
  let next = totalMinutes;
  if (minMinutes !== null) {
    next = Math.max(next, minMinutes);
  }
  if (maxMinutes !== null) {
    next = Math.min(next, maxMinutes);
  }
  return next;
}

function formatMinutes(totalMinutes: number): { hour: string; minute: string } {
  const bounded = ((totalMinutes % 1440) + 1440) % 1440;
  return {
    hour: String(Math.floor(bounded / 60)).padStart(2, '0'),
    minute: String(bounded % 60).padStart(2, '0'),
  };
}

const TransfusionTimePicker: React.FC<TransfusionTimePickerProps> = ({
  id,
  labelText,
  value,
  onChange,
  disabled = false,
  invalid = false,
  invalidText,
  hideLabel = false,
  compact = false,
  minTime,
  maxTime,
  showNowButton = false,
  nowLocal,
}) => {
  const { t } = useTranslation();
  const instanceId = useId().replace(/:/g, '');
  const resolvedId = `${id}-${instanceId}`;
  const { hour, minute } = parseParts(value);
  const minMinutes = toMinutes(minTime);
  const maxMinutes = toMinutes(maxTime);
  const nowClock = maxTime ?? clockFromNowLocal(nowLocal);
  const nowMinutes = toMinutes(nowClock);
  const nowAllowed =
    nowMinutes !== null &&
    (minMinutes === null || nowMinutes >= minMinutes) &&
    (maxMinutes === null || nowMinutes <= maxMinutes);

  const hourOptions = useMemo(
    () =>
      HOURS.map((option) => {
        const hourStart = Number(option) * 60;
        const hourEnd = hourStart + 59;
        const beforeMin = minMinutes !== null && hourEnd < minMinutes;
        const afterMax = maxMinutes !== null && hourStart > maxMinutes;
        return { value: option, disabled: beforeMin || afterMax };
      }),
    [maxMinutes, minMinutes],
  );

  const minuteOptions = useMemo(
    () =>
      MINUTES.map((option) => {
        if (!hour) {
          return { value: option, disabled: false };
        }
        const total = Number(hour) * 60 + Number(option);
        const beforeMin = minMinutes !== null && total < minMinutes;
        const afterMax = maxMinutes !== null && total > maxMinutes;
        return { value: option, disabled: beforeMin || afterMax };
      }),
    [hour, maxMinutes, minMinutes],
  );

  const emit = (nextHour: string, nextMinute: string) => {
    if (!nextHour && !nextMinute) {
      onChange(undefined);
      return;
    }
    const total = Number(nextHour || '00') * 60 + Number(nextMinute || '00');
    const clamped = clampToRange(total, minMinutes, maxMinutes);
    const parts = formatMinutes(clamped);
    onChange(`${parts.hour}:${parts.minute}`);
  };

  const handleHourChange = (nextHour: string) => {
    if (!nextHour) {
      onChange(undefined);
      return;
    }
    emit(nextHour, minute || '00');
  };

  const handleMinuteChange = (nextMinute: string) => {
    if (!nextMinute && !hour) {
      onChange(undefined);
      return;
    }
    emit(hour || '00', nextMinute);
  };

  const handleNow = () => {
    if (!nowClock || disabled || !nowAllowed) {
      return;
    }
    onChange(nowClock);
  };

  return (
    <div className={`${styles.wrapper} ${compact ? styles.compact : ''} ${invalid ? styles.invalid : ''}`}>
      {!hideLabel ? <div className={styles.label}>{labelText}</div> : null}
      {value ? (
        <div className={styles.selectedValue} aria-live="polite">
          <Time size={12} aria-hidden />
          <strong>{value}</strong>
        </div>
      ) : (
        <div className={styles.selectedValueEmpty}>{t('noTimeSelected', 'No time selected')}</div>
      )}
      <div
        className={styles.controls}
        role="group"
        aria-label={typeof labelText === 'string' ? labelText : t('time', 'Time')}>
        <div className={styles.hourSelect}>
          <Select
            id={`${resolvedId}-hour`}
            size="sm"
            labelText={t('hours', 'Hours')}
            hideLabel
            value={hour}
            disabled={disabled}
            invalid={invalid}
            onChange={(event) => handleHourChange(event.target.value)}>
            <SelectItem value="" text={t('hh', 'HH')} />
            {hourOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} text={option.value} disabled={option.disabled} />
            ))}
          </Select>
        </div>
        <span className={styles.separator} aria-hidden>
          :
        </span>
        <div className={styles.minuteSelect}>
          <Select
            id={`${resolvedId}-minute`}
            size="sm"
            labelText={t('minutes', 'Minutes')}
            hideLabel
            value={minute}
            disabled={disabled || !hour}
            invalid={invalid}
            onChange={(event) => handleMinuteChange(event.target.value)}>
            <SelectItem value="" text={t('mm', 'MM')} />
            {minuteOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} text={option.value} disabled={option.disabled} />
            ))}
          </Select>
        </div>
        {showNowButton && !disabled ? (
          <Button
            kind="ghost"
            size="sm"
            className={styles.nowButton}
            renderIcon={Time}
            hasIconOnly
            iconDescription={t('useCurrentTime', 'Use current time')}
            disabled={!nowClock || !nowAllowed}
            onClick={handleNow}
          />
        ) : null}
      </div>
      {invalid && invalidText ? <div className={styles.errorText}>{invalidText}</div> : null}
    </div>
  );
};

export default TransfusionTimePicker;
