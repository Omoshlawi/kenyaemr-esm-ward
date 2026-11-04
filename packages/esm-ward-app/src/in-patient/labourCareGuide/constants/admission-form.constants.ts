export const LCG_LABOUR_ONSET_CODE = {
  spontaneous: 'spontaneous',
  induction: 'induction',
  preLabourCsection: 'preLabourCsection',
} as const;

export type LcgLabourOnsetCode = (typeof LCG_LABOUR_ONSET_CODE)[keyof typeof LCG_LABOUR_ONSET_CODE];

export const LCG_ADMISSION_RISK_FACTOR_CODE = {
  chronicHypertension: 'chronicHypertension',
  preEclampsia: 'preEclampsia',
  advancedAge: 'advancedAge',
  adolescentPregnancy: 'adolescentPregnancy',
  pretermLabour: 'pretermLabour',
  multipleGestation: 'multipleGestation',
  colonization: 'colonization',
  other: 'other',
  none: 'none',
} as const;

export type LcgAdmissionRiskFactorCode =
  (typeof LCG_ADMISSION_RISK_FACTOR_CODE)[keyof typeof LCG_ADMISSION_RISK_FACTOR_CODE];

/** How long after recording admission details risk factors (and related fields) remain editable. */
export const LCG_ADMISSION_DETAILS_EDIT_WINDOW_MINUTES = 60;
