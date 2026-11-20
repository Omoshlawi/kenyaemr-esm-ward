/**
 * Opens / leaves the embedded critical-care (ICU/HDU/NICU/PICU) patient chart from ward admissions.
 * Matches @kenyaemr/esm-icu-app `icuView` contract (no separate unit dashboard tab).
 */

import { useEffect, useState } from 'react';

export const ICU_EMBEDDED_VIEW_PARAM = 'icuView';

/** Dispatched so WardPatientsTable selects Admitted after leaving a critical-care chart. */
export const FOCUS_ADMITTED_TAB_EVENT = 'kenyaemr:focus-admitted-tab';

export function readCriticalCareEmbeddedPath(): string {
  const value = new URLSearchParams(window.location.search).get(ICU_EMBEDDED_VIEW_PARAM);
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export function isCriticalCarePatientChartPath(path: string): boolean {
  return path.startsWith('/patient/');
}

/** Syncs the `icuView` query param into React after pushState / popstate. */
export function useCriticalCareEmbeddedPath(): string {
  const [path, setPath] = useState(readCriticalCareEmbeddedPath);

  useEffect(() => {
    const sync = () => setPath(readCriticalCareEmbeddedPath());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return path;
}

function replaceSpaUrl(mutate: (url: URL) => void) {
  const url = new URL(window.location.href);
  mutate(url);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.pushState(window.history.state, '', next);
  }
}

export function openCriticalCarePatientChart(patientUuid: string) {
  if (!patientUuid) {
    return;
  }

  replaceSpaUrl((url) => {
    url.searchParams.set(ICU_EMBEDDED_VIEW_PARAM, `/patient/${patientUuid}`);
  });
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Leave the chart and show the Admitted patients list. */
export function returnToAdmittedPatients() {
  replaceSpaUrl((url) => {
    url.searchParams.delete(ICU_EMBEDDED_VIEW_PARAM);
  });
  window.dispatchEvent(new CustomEvent(FOCUS_ADMITTED_TAB_EVENT));
  window.dispatchEvent(new PopStateEvent('popstate'));
}
