import type { TFunction } from 'react-i18next';

export type SupportiveAlertKey = 'companion' | 'painRelief' | 'oralFluid' | 'posture';
export type BabyAlertKey = 'baselineFhr' | 'fhrDeceleration' | 'amnioticFluid' | 'fetalPosition' | 'caput' | 'moulding';
export type WomanAlertKey = 'pulse' | 'systolicBp' | 'diastolicBp' | 'temperature' | 'urine';
export type LabourContractionMetric = 'contractionsPer10Mins' | 'durationOfContractions';

export type SupportiveAlertEntryLike = {
  companion?: string;
  painRelief?: string;
  oralFluid?: string;
  posture?: string;
};

export type BabyAlertEntryLike = {
  baselineFhr?: string;
  fhrDeceleration?: string;
  amnioticFluid?: string;
  fetalPosition?: string;
  caput?: string;
  moulding?: string;
};

export const isSupportiveAlertValue = (rowKey: SupportiveAlertKey, rawValue: string) => {
  const value = String(rawValue ?? '')
    .trim()
    .toUpperCase();
  if (!value) {
    return false;
  }

  switch (rowKey) {
    case 'posture':
      return value === 'SP';
    case 'companion':
    case 'painRelief':
    case 'oralFluid':
      return value === 'N';
    default:
      return false;
  }
};

export const getSupportiveAlertGuidance = (t: TFunction, rowKey: SupportiveAlertKey) => {
  switch (rowKey) {
    case 'companion':
      return t(
        'supportiveCompanionAlertGuidance',
        'Companion N: Placeholder guidance. No companion documented; add supportive-care action.',
      );
    case 'painRelief':
      return t(
        'supportivePainReliefAlertGuidance',
        'Pain relief N: Placeholder guidance. Pain-relief action not documented; add action plan.',
      );
    case 'oralFluid':
      return t(
        'supportiveOralFluidAlertGuidance',
        'Oral fluid N: Placeholder guidance. Fluid support not documented; add supportive-care action.',
      );
    case 'posture':
      return t(
        'supportivePostureAlertGuidance',
        "Posture, Supine, SP: Encourage the woman to walk around freely during first stage of labour. Support the woman's choice of position (left lateral, squatting, kneeling, standing supported by companion).",
      );
    default:
      return '';
  }
};

export const getSupportiveAlertTokens = (entry: SupportiveAlertEntryLike) => {
  const tokens: string[] = [];
  if (isSupportiveAlertValue('companion', entry.companion || '')) tokens.push('N (Companion)');
  if (isSupportiveAlertValue('painRelief', entry.painRelief || '')) tokens.push('N (Pain relief)');
  if (isSupportiveAlertValue('oralFluid', entry.oralFluid || '')) tokens.push('N (Oral fluid)');
  if (isSupportiveAlertValue('posture', entry.posture || '')) tokens.push('SP (Posture)');
  return tokens;
};

export const getAlertTokenCode = (token: string) => {
  const trimmed = String(token ?? '').trim();
  if (!trimmed) {
    return '';
  }
  const [code] = trimmed.split(' ');
  return code?.trim() ?? '';
};

export const getSupportiveAlertTokenGuidance = (t: TFunction, token: string) => {
  const normalized = String(token ?? '')
    .trim()
    .toUpperCase();

  if (normalized.includes('COMPANION')) {
    return t(
      'supportiveCompanionTokenHoverGuidance',
      'Companion N: Placeholder guidance. No companion documented; add supportive-care action.',
    );
  }

  if (normalized.includes('PAIN RELIEF')) {
    return t(
      'supportivePainReliefTokenHoverGuidance',
      'Pain relief N: Placeholder guidance. Pain-relief action not documented; add action plan.',
    );
  }

  if (normalized.includes('ORAL FLUID')) {
    return t(
      'supportiveOralFluidTokenHoverGuidance',
      'Oral fluid N: Placeholder guidance. Fluid support not documented; add supportive-care action.',
    );
  }

  if (normalized.startsWith('SP')) {
    return t(
      'supportivePostureTokenHoverGuidance',
      "Posture, Supine, SP: Encourage the woman to walk around freely during first stage of labour. Support the woman's choice of position (left lateral, squatting, kneeling, standing supported by companion).",
    );
  }

  return t('supportiveTokenHoverPlaceholder', 'Placeholder: supportive-care guidance to be added.');
};

export const getBabyAlertTokenGuidance = (t: TFunction, _token: string) => {
  const normalized = String(_token ?? '')
    .trim()
    .toUpperCase();
  const code = getAlertTokenCode(_token);

  if (normalized.includes('BASELINE FHR')) {
    return t(
      'babyBaselineFhrTokenHoverGuidance',
      `Baseline FHR ${code}: Placeholder guidance. Value is <110 or >=160; review and act.`,
    );
  }

  if (normalized.includes('FHR DECELERATION')) {
    return t('babyFhrDecelerationTokenHoverGuidance', 'FHR deceleration L: Placeholder guidance. Review and act.');
  }

  if (normalized.includes('AMNIOTIC FLUID')) {
    return t(
      'babyAmnioticFluidTokenHoverGuidance',
      `Amniotic fluid ${code}: Placeholder guidance. Alert values are M+++ or B; review and act.`,
    );
  }

  if (normalized.includes('FETAL POSITION')) {
    return t(
      'babyFetalPositionTokenHoverGuidance',
      `Fetal position ${code}: Placeholder guidance. Alert values are P or T; review and act.`,
    );
  }

  if (normalized.includes('CAPUT')) {
    return t('babyCaputTokenHoverGuidance', 'Caput +++: Placeholder guidance. Marked caput detected; review and act.');
  }

  if (normalized.includes('MOULDING')) {
    return t(
      'babyMouldingTokenHoverGuidance',
      'Moulding +++: Placeholder guidance. Significant moulding detected; review and act.',
    );
  }

  return t('babyTokenHoverPlaceholder', 'Placeholder: baby-alert guidance to be added.');
};

export const isBabyAlertValue = (rowKey: BabyAlertKey, rawValue: string) => {
  const value = String(rawValue ?? '')
    .trim()
    .toUpperCase();
  if (!value) {
    return false;
  }

  switch (rowKey) {
    case 'baselineFhr': {
      const numericValue = Number(rawValue);
      return Number.isFinite(numericValue) && (numericValue < 110 || numericValue >= 160);
    }
    case 'fhrDeceleration':
      return value === 'L';
    case 'amnioticFluid':
      return value === 'M+++' || value === 'B';
    case 'fetalPosition':
      return value === 'P' || value === 'T';
    case 'caput':
    case 'moulding':
      return value === '+++';
    default:
      return false;
  }
};

export const getBabyAlertGuidance = (t: TFunction, rowKey: BabyAlertKey) => {
  switch (rowKey) {
    case 'baselineFhr':
      return t(
        'babyBaselineFhrAlertGuidance',
        'Baseline FHR: Placeholder guidance. Value is <110 or >=160; review and act.',
      );
    case 'fhrDeceleration':
      return t(
        'babyFhrDecelerationAlertGuidance',
        'FHR deceleration L: Placeholder guidance. Deceleration documented; review and act.',
      );
    case 'amnioticFluid':
      return t(
        'babyAmnioticFluidAlertGuidance',
        'Amniotic fluid M+++ or B: Placeholder guidance. Abnormal fluid status; review and act.',
      );
    case 'fetalPosition':
      return t(
        'babyFetalPositionAlertGuidance',
        'Fetal position P or T: Placeholder guidance. Position alert documented; review and act.',
      );
    case 'caput':
      return t('babyCaputAlertGuidance', 'Caput +++: Placeholder guidance. Marked caput detected; review and act.');
    case 'moulding':
      return t(
        'babyMouldingAlertGuidance',
        'Moulding +++: Placeholder guidance. Significant moulding detected; review and act.',
      );
    default:
      return '';
  }
};

export const getBabyAlertTokens = (entry: BabyAlertEntryLike) => {
  const tokens: string[] = [];

  if (isBabyAlertValue('baselineFhr', entry.baselineFhr || '')) tokens.push(`${entry.baselineFhr} (Baseline FHR)`);
  if (isBabyAlertValue('fhrDeceleration', entry.fhrDeceleration || '')) tokens.push('L (FHR deceleration)');
  if (isBabyAlertValue('amnioticFluid', entry.amnioticFluid || ''))
    tokens.push(`${entry.amnioticFluid} (Amniotic fluid)`);
  if (isBabyAlertValue('fetalPosition', entry.fetalPosition || ''))
    tokens.push(`${entry.fetalPosition} (Fetal position)`);
  if (isBabyAlertValue('caput', entry.caput || '')) tokens.push('+++ (Caput)');
  if (isBabyAlertValue('moulding', entry.moulding || '')) tokens.push('+++ (Moulding)');

  return tokens;
};

export type WomanAlertEntryLike = {
  pulse?: string;
  systolicBp?: string;
  diastolicBp?: string;
  temperature?: string;
  urine?: string;
};

export const isWomanAlertValue = (rowKey: WomanAlertKey, rawValue: string) => {
  const value = String(rawValue ?? '')
    .trim()
    .toUpperCase();
  if (!value) {
    return false;
  }

  switch (rowKey) {
    case 'pulse': {
      const numericValue = Number(rawValue);
      return Number.isFinite(numericValue) && (numericValue < 60 || numericValue >= 120);
    }
    case 'systolicBp': {
      const numericValue = Number(rawValue);
      return Number.isFinite(numericValue) && (numericValue < 80 || numericValue >= 140);
    }
    case 'diastolicBp': {
      const numericValue = Number(rawValue);
      return Number.isFinite(numericValue) && numericValue >= 90;
    }
    case 'temperature': {
      const numericValue = Number(rawValue);
      return Number.isFinite(numericValue) && (numericValue < 35 || numericValue >= 37.5);
    }
    case 'urine':
      return value.includes('P++') || value.includes('A++');
    default:
      return false;
  }
};

export const getWomanAlertGuidance = (t: TFunction, rowKey: WomanAlertKey) => {
  switch (rowKey) {
    case 'pulse':
      return t('womanPulseAlertGuidance', 'Pulse alert: Placeholder guidance. Value is <60 or >=120; review and act.');
    case 'systolicBp':
      return t(
        'womanSystolicAlertGuidance',
        'Systolic BP alert: Placeholder guidance. Value is <80 or >=140; review and act.',
      );
    case 'diastolicBp':
      return t(
        'womanDiastolicAlertGuidance',
        'Diastolic BP alert: Placeholder guidance. Value is >=90; review and act.',
      );
    case 'temperature':
      return t(
        'womanTemperatureAlertGuidance',
        'Temperature alert: Placeholder guidance. Value is <35 or >=37.5; review and act.',
      );
    case 'urine':
      return t(
        'womanUrineAlertGuidance',
        'Urine alert: Placeholder guidance. Alert values are P++ or A++; review and act.',
      );
    default:
      return '';
  }
};

export const getLabourContractionAlertInfo = (
  t: TFunction,
  metric: LabourContractionMetric,
  rawValue: string,
): { isAlert: boolean; guidance: string } => {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return { isAlert: false, guidance: '' };
  }

  if (metric === 'contractionsPer10Mins') {
    const isAlert = numericValue <= 2 || numericValue > 5;
    return {
      isAlert,
      guidance: isAlert
        ? t(
            'contractionsPer10AlertGuidance',
            'Contractions per 10 min alert: Placeholder guidance. Value is <=2 or >5; review and act.',
          )
        : '',
    };
  }

  const isAlert = numericValue < 20 || numericValue > 60;
  return {
    isAlert,
    guidance: isAlert
      ? t(
          'contractionDurationAlertGuidance',
          'Duration of contractions alert: Placeholder guidance. Value is <20 or >60; review and act.',
        )
      : '',
  };
};

// ─── Woman alert tokens ──────────────────────────────────────────────────────

export const getWomanAlertTokens = (entry: WomanAlertEntryLike): string[] => {
  const tokens: string[] = [];
  if (entry.pulse && isWomanAlertValue('pulse', entry.pulse)) tokens.push(`${entry.pulse} (Pulse)`);
  if (entry.systolicBp && isWomanAlertValue('systolicBp', entry.systolicBp))
    tokens.push(`${entry.systolicBp} (Systolic BP)`);
  if (entry.diastolicBp && isWomanAlertValue('diastolicBp', entry.diastolicBp))
    tokens.push(`${entry.diastolicBp} (Diastolic BP)`);
  if (entry.temperature && isWomanAlertValue('temperature', entry.temperature))
    tokens.push(`${entry.temperature} (Temperature)`);
  if (entry.urine && isWomanAlertValue('urine', entry.urine)) tokens.push(`${entry.urine} (Urine)`);
  return tokens;
};

export const getWomanAlertTokenGuidance = (t: TFunction, token: string): string => {
  const normalized = String(token ?? '')
    .trim()
    .toUpperCase();
  if (normalized.includes('PULSE'))
    return t('womanPulseTokenGuidance', 'Pulse <60 or ≥120 bpm: Abnormal pulse rate detected; review and act.');
  if (normalized.includes('SYSTOLIC'))
    return t(
      'womanSystolicTokenGuidance',
      'Systolic BP <80 or ≥140 mmHg: Abnormal systolic blood pressure; review and act.',
    );
  if (normalized.includes('DIASTOLIC'))
    return t('womanDiastolicTokenGuidance', 'Diastolic BP ≥90 mmHg: Elevated diastolic pressure; review and act.');
  if (normalized.includes('TEMPERATURE'))
    return t(
      'womanTemperatureTokenGuidance',
      'Temperature <35.0°C or ≥37.5°C: Abnormal maternal temperature; review and act.',
    );
  if (normalized.includes('URINE'))
    return t(
      'womanUrineTokenGuidance',
      'Urine P++ or A++: Significant proteinuria or ketonuria detected; review and act.',
    );
  return t('womanAlertTokenGuidancePlaceholder', 'Woman vital-sign alert: review and act.');
};

// ─── Contraction alert tokens ────────────────────────────────────────────────

export type ContractionAlertEntryLike = {
  contractionsPer10Mins?: string;
  durationOfContractions?: string;
};

export const isContractionAlertValue = (metric: LabourContractionMetric, rawValue: string): boolean => {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) return false;
  if (metric === 'contractionsPer10Mins') return numericValue <= 2 || numericValue > 5;
  return numericValue < 20 || numericValue > 60;
};

export const getContractionAlertTokens = (entry: ContractionAlertEntryLike): string[] => {
  const tokens: string[] = [];
  if (entry.contractionsPer10Mins && isContractionAlertValue('contractionsPer10Mins', entry.contractionsPer10Mins)) {
    tokens.push(`${entry.contractionsPer10Mins} (Contractions/10min)`);
  }
  if (entry.durationOfContractions && isContractionAlertValue('durationOfContractions', entry.durationOfContractions)) {
    tokens.push(`${entry.durationOfContractions}s (Contraction duration)`);
  }
  return tokens;
};

export const getContractionAlertTokenGuidance = (t: TFunction, token: string): string => {
  const normalized = String(token ?? '')
    .trim()
    .toUpperCase();
  if (normalized.includes('CONTRACTIONS/10MIN'))
    return t(
      'contractionCountTokenGuidance',
      'Contractions ≤2 or >5 per 10 min: Abnormal contraction frequency; review and act.',
    );
  if (normalized.includes('CONTRACTION DURATION'))
    return t(
      'contractionDurationTokenGuidance',
      'Contraction duration <20s or >60s: Abnormal contraction duration; review and act.',
    );
  return t('contractionAlertTokenGuidancePlaceholder', 'Contraction alert: review and act.');
};

// ─── Cervical dilation stall guidance ────────────────────────────────────────

export const getCervixStallTokenGuidance = (t: TFunction, token: string): string => {
  const normalized = String(token ?? '')
    .trim()
    .toUpperCase();
  if (normalized.includes('CM') && normalized.includes('NO PROGRESS'))
    return t(
      'cervixStallTokenGuidance',
      'Cervical dilation stall: No progress at this dilation level for the expected duration; review and consider action.',
    );
  return t('cervixStallTokenGuidancePlaceholder', 'Labour progress alert: review and act.');
};
