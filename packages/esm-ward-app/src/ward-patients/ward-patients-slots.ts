/**
 * Extension slot names for ward patient table tab panels.
 *
 * Each slot renders inside a fixed Carbon tab in the ward table view. The default
 * ward app registers one extension per slot. To replace a tab table, remove the
 * default extension and register your own component targeting the same slot.
 *
 * Custom components must render under DefaultWardView so `useAppContext('ward-view-context')`
 * provides ward patient data. See the Ward App README for configuration examples.
 */
export const WARD_PATIENTS_AWAITING_ADMISSION_SLOT = 'ward-patients-awaiting-admission-slot';
export const WARD_PATIENTS_ADMITTED_SLOT = 'ward-patients-admitted-slot';
export const WARD_PATIENTS_UNASSIGNED_SLOT = 'ward-patients-unassigned-slot';
export const WARD_PATIENTS_DISCHARGE_IN_SLOT = 'ward-patients-discharge-in-slot';
export const WARD_PATIENTS_DISCHARGED_SLOT = 'ward-patients-discharged-slot';

/** Capacity tiles (total beds, occupied, ventilated, …) above Ward Patients on ICU/HDU/NICU/PICU. */
export const WARD_CRITICAL_CARE_METRICS_SLOT = 'ward-critical-care-metrics-slot';

export const WARD_PATIENTS_TAB_SLOTS = [
  WARD_PATIENTS_AWAITING_ADMISSION_SLOT,
  WARD_PATIENTS_ADMITTED_SLOT,
  WARD_PATIENTS_UNASSIGNED_SLOT,
  WARD_PATIENTS_DISCHARGE_IN_SLOT,
  WARD_PATIENTS_DISCHARGED_SLOT,
] as const;

/** Tab positions in the ward patients table. Critical-care charts open from Admitted (no extra tab). */
export const WARD_PATIENTS_TAB_INDEX = {
  awaitingAdmission: 0,
  admitted: 1,
  unassigned: 2,
  dischargeIn: 3,
  discharged: 4,
} as const;
