import classNames from 'classnames';
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './case-followup.scss';
import {
  canEditFollowUpDay,
  toDisplayDate,
  type FollowUpDayState,
  type FollowUpMark,
  type FollowUpTimelineDay,
} from './case-followup.utils';

const dayMarkClassName = (mark: FollowUpMark, state: FollowUpDayState) =>
  classNames(styles.dayMark, {
    [styles.dayMarkZero]: mark === '0',
    [styles.dayMarkX]: mark === 'X',
    [styles.dayMarkPast]: state === 'past',
    [styles.dayMarkDisabled]: state === 'upcoming',
    [styles.dayMarkLocked]: state === 'locked',
  });

const getDayMarkLabel = (
  day: number,
  mark: FollowUpMark,
  state: FollowUpDayState,
  dayDate?: string | null,
  readOnly = false,
) => {
  const dateSuffix = dayDate ? ` (${toDisplayDate(dayDate)})` : '';
  const editable = !readOnly && canEditFollowUpDay(state);
  if (state === 'unavailable') {
    return `Day ${day}: set the contact's isolation date.`;
  }
  if (state === 'notStarted') {
    return `Day ${day}${dateSuffix}: contact has not entered isolation yet.`;
  }
  if (state === 'locked') {
    return `Day ${day}${dateSuffix}: 21-day isolation is complete.`;
  }
  if (state === 'upcoming') {
    return `Day ${day}${dateSuffix}: screening day has not started.`;
  }
  if (mark === '0') {
    return editable
      ? `Day ${day}${dateSuffix}: 0, no fever or bleeding. Open to change.`
      : `Day ${day}${dateSuffix}: 0, no fever or bleeding.`;
  }
  if (mark === 'X') {
    return editable
      ? `Day ${day}${dateSuffix}: X, died or developed fever or bleeding. Open to change.`
      : `Day ${day}${dateSuffix}: X, died or developed fever or bleeding.`;
  }
  if (!editable) {
    return `Day ${day}${dateSuffix}: not recorded.`;
  }
  return `Day ${day}${dateSuffix}: not recorded. Open to choose 0 or X.`;
};

type DayMarkPickerProps = {
  column: FollowUpTimelineDay;
  mark: FollowUpMark;
  state: FollowUpDayState;
  readOnly?: boolean;
  onSelect: (mark: FollowUpMark) => void;
};

const MENU_WIDTH = 240;

const DayMarkPicker: React.FC<DayMarkPickerProps> = ({ column, mark, state, readOnly = false, onSelect }) => {
  const { t } = useTranslation();
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, above: false });
  const editable = !readOnly && canEditFollowUpDay(state);
  const label = getDayMarkLabel(column.day, mark, state, column.date, readOnly);

  const placeMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const menuHeight = menuRef.current?.offsetHeight ?? 160;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH - 8);
    const above = rect.bottom + menuHeight + 8 > window.innerHeight && rect.top > menuHeight + 8;
    setMenuPos({
      top: above ? rect.top - 4 : rect.bottom + 4,
      left,
      above,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    placeMenu();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onReposition = () => placeMenu();
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const choose = (nextMark: FollowUpMark) => {
    onSelect(nextMark);
    setOpen(false);
    buttonRef.current?.focus();
  };

  if (state === 'notStarted' || state === 'unavailable') {
    return <span className={styles.dayMarkBlank} aria-label={label} title={label} />;
  }

  if (!editable) {
    return (
      <span className={dayMarkClassName(mark, state)} aria-label={label} title={label}>
        {mark || ''}
      </span>
    );
  }

  return (
    <div className={styles.dayPicker}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={label}
        className={classNames(styles.dayTrigger, {
          [styles.dayMarkZero]: mark === '0',
          [styles.dayMarkX]: mark === 'X',
          [styles.dayTriggerOpen]: open,
        })}
        onClick={() => setOpen((current) => !current)}>
        <span className={styles.dayMarkLabel}>
          <span>{mark || ''}</span>
          <span className={styles.dayMarkCaret} aria-hidden>
            ▾
          </span>
        </span>
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              className={classNames(styles.dayMenu, { [styles.dayMenuAbove]: menuPos.above })}
              style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}>
              <button
                type="button"
                role="menuitem"
                className={styles.dayMenuItem}
                title={t('followUpMarkZeroOption', '0 — No fever or bleeding')}
                onClick={() => choose('0')}>
                <span className={classNames(styles.dayMenuMark, styles.dayMenuMarkZero)}>0</span>
                <span>{t('followUpMarkZero', 'No fever or bleeding')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.dayMenuItem}
                title={t('followUpMarkXOption', 'X — Died or fever/bleeding')}
                onClick={() => choose('X')}>
                <span className={classNames(styles.dayMenuMark, styles.dayMenuMarkX)}>X</span>
                <span>{t('followUpMarkX', 'Died or fever/bleeding')}</span>
              </button>
              {mark ? (
                <button
                  type="button"
                  role="menuitem"
                  className={classNames(styles.dayMenuItem, styles.dayMenuItemClear)}
                  onClick={() => choose('')}>
                  {t('clearFollowUpMark', 'Clear')}
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default DayMarkPicker;
