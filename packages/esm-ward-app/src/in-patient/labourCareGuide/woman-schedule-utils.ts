import { LCG_TIME_INCREMENT_MINUTES } from './types';
import { getSlotState } from './time-slot-utils';

export type WomanScheduleMarker = {
  slotIndex: number;
  type: 'actual' | 'placeholder';
};

export type WomanScheduleState = {
  markers: WomanScheduleMarker[];
  placeholderSlotIndices: Set<number>;
  lockedSlotIndices: Set<number>;
  activeSlotIndices: Set<number>;
  nextDueSlotIndex: number | null;
};

const emptyScheduleState = (): WomanScheduleState => ({
  markers: [],
  placeholderSlotIndices: new Set<number>(),
  lockedSlotIndices: new Set<number>(),
  activeSlotIndices: new Set<number>(),
  nextDueSlotIndex: null,
});

export const getWomanIntervalSlotSpan = (intervalMinutes: number) => {
  const slotSpan = Math.round(intervalMinutes / LCG_TIME_INCREMENT_MINUTES);
  return Math.max(1, slotSpan);
};

export const buildWomanScheduleState = ({
  baseTime,
  slotCount,
  actualFilledSlotIndices,
  intervalMinutes,
  now,
  firstStageSlotCount,
  secondStageStartTime,
}: {
  baseTime?: string;
  slotCount: number;
  actualFilledSlotIndices: number[];
  intervalMinutes: number;
  now: Date;
  firstStageSlotCount?: number;
  secondStageStartTime?: string;
}): WomanScheduleState => {
  if (!baseTime || slotCount <= 0) {
    return emptyScheduleState();
  }

  const intervalSlotSpan = getWomanIntervalSlotSpan(intervalMinutes);
  const resolveSlotState = (slotIndex: number) => {
    if (secondStageStartTime && typeof firstStageSlotCount === 'number' && slotIndex >= firstStageSlotCount) {
      return getSlotState(secondStageStartTime, slotIndex - firstStageSlotCount, now);
    }

    return getSlotState(baseTime, slotIndex, now);
  };
  const markers: WomanScheduleMarker[] = [];
  const placeholderSlotIndices = new Set<number>();
  const lockedSlotIndices = new Set<number>();
  const activeSlotIndices = new Set<number>();
  const uniqueActualIndices = Array.from(new Set(actualFilledSlotIndices))
    .filter((slotIndex) => slotIndex >= 0 && slotIndex < slotCount)
    .sort((left, right) => left - right);

  if (uniqueActualIndices.length === 0) {
    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const state = resolveSlotState(slotIndex);
      if (state === 'locked') {
        lockedSlotIndices.add(slotIndex);
      }
      if (state === 'active') {
        activeSlotIndices.add(slotIndex);
      }
    }

    return {
      markers,
      placeholderSlotIndices,
      lockedSlotIndices,
      activeSlotIndices,
      nextDueSlotIndex: null,
    };
  }

  const firstActualIndex = uniqueActualIndices[0];
  for (let slotIndex = 0; slotIndex < firstActualIndex; slotIndex += 1) {
    const state = resolveSlotState(slotIndex);
    if (state === 'locked') {
      lockedSlotIndices.add(slotIndex);
    }
  }

  markers.push({ slotIndex: firstActualIndex, type: 'actual' });

  for (const actualSlotIndex of uniqueActualIndices.slice(1)) {
    while (markers[markers.length - 1].slotIndex + intervalSlotSpan < actualSlotIndex) {
      const placeholderSlotIndex = markers[markers.length - 1].slotIndex + intervalSlotSpan;
      if (placeholderSlotIndex >= slotCount) {
        break;
      }

      markers.push({ slotIndex: placeholderSlotIndex, type: 'placeholder' });
      placeholderSlotIndices.add(placeholderSlotIndex);
    }

    if (markers[markers.length - 1].slotIndex !== actualSlotIndex) {
      markers.push({ slotIndex: actualSlotIndex, type: 'actual' });
    }
  }

  let nextDueSlotIndex = markers[markers.length - 1].slotIndex + intervalSlotSpan;
  while (nextDueSlotIndex < slotCount && resolveSlotState(nextDueSlotIndex) === 'locked') {
    markers.push({ slotIndex: nextDueSlotIndex, type: 'placeholder' });
    placeholderSlotIndices.add(nextDueSlotIndex);
    nextDueSlotIndex = markers[markers.length - 1].slotIndex + intervalSlotSpan;
  }

  markers.forEach((marker) => {
    lockedSlotIndices.add(marker.slotIndex);
  });

  for (let markerIndex = 1; markerIndex < markers.length; markerIndex += 1) {
    const previous = markers[markerIndex - 1].slotIndex;
    const current = markers[markerIndex].slotIndex;
    for (let slotIndex = previous; slotIndex <= current; slotIndex += 1) {
      lockedSlotIndices.add(slotIndex);
    }
  }

  const lastMarker = markers[markers.length - 1];
  const upcomingDueSlotIndex = lastMarker.slotIndex + intervalSlotSpan;

  if (lastMarker.type === 'actual') {
    if (upcomingDueSlotIndex < slotCount) {
      if (resolveSlotState(upcomingDueSlotIndex) === 'active') {
        activeSlotIndices.add(upcomingDueSlotIndex);
      }
    }
  } else if (upcomingDueSlotIndex < slotCount) {
    for (let slotIndex = lastMarker.slotIndex + 1; slotIndex < upcomingDueSlotIndex; slotIndex += 1) {
      const state = resolveSlotState(slotIndex);
      if (state === 'locked') {
        lockedSlotIndices.add(slotIndex);
      }
      if (state === 'active') {
        activeSlotIndices.add(slotIndex);
      }
    }
  }

  return {
    markers,
    placeholderSlotIndices,
    lockedSlotIndices,
    activeSlotIndices,
    nextDueSlotIndex: upcomingDueSlotIndex < slotCount ? upcomingDueSlotIndex : null,
  };
};
