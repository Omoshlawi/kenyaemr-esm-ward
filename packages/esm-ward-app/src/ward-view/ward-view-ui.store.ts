import { useSyncExternalStore } from 'react';

/**
 * Shared UI state for the ward patients view.
 *
 * The ward patients tabs render through extension slots (separate React roots), so React context cannot
 * reach them. This small module-level store lets the header search box, summary cards and tab tables
 * share the same search text, selected tab and list/card view.
 */
export type WardPatientsView = 'list' | 'cards';

export type WardViewUiState = {
  search: string;
  selectedTab: number;
  view: WardPatientsView;
};

const initialState: WardViewUiState = { search: '', selectedTab: 0, view: 'list' };

let state: WardViewUiState = initialState;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getState() {
  return state;
}

export function updateWardViewUi(patch: Partial<WardViewUiState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function resetWardViewUi() {
  updateWardViewUi(initialState);
}

export function useWardViewUi<T>(selector: (current: WardViewUiState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(initialState),
  );
}

export function useWardPatientSearch() {
  return useWardViewUi((current) => current.search);
}
