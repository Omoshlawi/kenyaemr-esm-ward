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

  const isNoValue = value === 'N' || value === 'NO' || value.includes('1066');

  switch (rowKey) {
    case 'posture':
      return value === 'SP' || value.includes('SUPINE');
    case 'companion':
    case 'painRelief':
    case 'oralFluid':
      return isNoValue;
    default:
      return false;
  }
};

export const getSupportiveAlertGuidance = (t: TFunction, rowKey: SupportiveAlertKey) => {
  switch (rowKey) {
    case 'companion':
      return t(
        'supportiveCompanionAlertGuidance',
        "Companion N: Immediately facilitate the woman's chosen companion to be present and oriented in the room. If unavailable, assign a dedicated midwife, nurse, or doula for continuous one-on-one support.",
      );
    case 'painRelief':
      return t(
        'supportivePainReliefAlertGuidance',
        'Pain relief N: Assess pain using a standard scale, offer non-pharmacological options first (breathing, massage, warm compress, position changes), and give prescribed pharmacological analgesia if needed per protocol.',
      );
    case 'oralFluid':
      return t(
        'supportiveOralFluidAlertGuidance',
        'Oral fluid N: Encourage oral hydration and energy fluids (water, clear juice, isotonic drinks) unless there is a clear documented contraindication such as imminent general anesthesia.',
      );
    case 'posture':
      return t(
        'supportivePostureAlertGuidance',
        'Posture SP: Encourage walking or upright mobility; if in bed, support lateral, upright, or semi-recumbent positions. Avoid prolonged supine position to reduce aortocaval compression risk.',
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
      "Companion N: Immediately facilitate the woman's chosen companion to be present and oriented in the room. If unavailable, assign a dedicated midwife, nurse, or doula for continuous one-on-one support.",
    );
  }

  if (normalized.includes('PAIN RELIEF')) {
    return t(
      'supportivePainReliefTokenHoverGuidance',
      'Pain relief N: Assess pain using a standard scale, offer non-pharmacological options first (breathing, massage, warm compress, position changes), and give prescribed pharmacological analgesia if needed per protocol.',
    );
  }

  if (normalized.includes('ORAL FLUID')) {
    return t(
      'supportiveOralFluidTokenHoverGuidance',
      'Oral fluid N: Encourage oral hydration and energy fluids (water, clear juice, isotonic drinks) unless there is a clear documented contraindication such as imminent general anesthesia.',
    );
  }

  if (normalized.startsWith('SP')) {
    return t(
      'supportivePostureTokenHoverGuidance',
      'Posture SP: Encourage walking or upright mobility; if in bed, support lateral, upright, or semi-recumbent positions. Avoid prolonged supine position to reduce aortocaval compression risk.',
    );
  }

  return t('supportiveTokenHoverPlaceholder', 'Supportive-care alert: correct the identified care gap immediately.');
};

export const getBabyAlertTokenGuidance = (t: TFunction, _token: string) => {
  const normalized = String(_token ?? '')
    .trim()
    .toUpperCase();
  const code = getAlertTokenCode(_token);

  if (normalized.includes('BASELINE FHR')) {
    return t(
      'babyBaselineFhrTokenHoverGuidance',
      `Baseline FHR ${code}: Reposition mother to left lateral, give IV fluids if hypotensive, and reduce/stop oxytocin if hyperstimulation is present. Reassess FHR promptly; if persistent, start continuous fetal monitoring and prepare for expedited delivery if distress is confirmed.`,
    );
  }

  if (normalized.includes('FHR DECELERATION')) {
    return t(
      'babyFhrDecelerationTokenHoverGuidance',
      'FHR deceleration: optimize maternal position and perfusion, reassess immediately, and escalate to continuous monitoring. Prepare expedited delivery if abnormal tracing persists.',
    );
  }

  if (normalized.includes('AMNIOTIC FLUID')) {
    return t(
      'babyAmnioticFluidTokenHoverGuidance',
      `Amniotic fluid ${code}: For thick meconium, increase FHR surveillance or initiate continuous CTG. For foul-smelling liquor, start broad-spectrum IV antibiotics for suspected chorioamnionitis, monitor maternal temperature closely, and prepare neonatal resuscitation support.`,
    );
  }

  if (normalized.includes('FETAL POSITION')) {
    return t(
      'babyFetalPositionTokenHoverGuidance',
      `Fetal position ${code}: reassess position and descent trend, support corrective maternal positioning, and escalate obstetric review if persistent malposition is associated with poor progress.`,
    );
  }

  if (normalized.includes('CAPUT')) {
    return t(
      'babyCaputTokenHoverGuidance',
      'Caput +++: reassess for possible cephalopelvic disproportion or malposition, correlate with cervical progress/descent, and prepare operative delivery if labour is not progressing safely.',
    );
  }

  if (normalized.includes('MOULDING')) {
    return t(
      'babyMouldingTokenHoverGuidance',
      'Moulding +++: reassess for possible cephalopelvic disproportion or malposition, correlate with cervical progress/descent, and prepare operative delivery if labour is not progressing safely.',
    );
  }

  return t(
    'babyTokenHoverPlaceholder',
    'Baby alert: optimize fetal condition and escalate monitoring/intervention promptly.',
  );
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
      return value === 'L' || value.includes('LATE');
    case 'amnioticFluid':
      // Red alert only for thick meconium (Meconium +3 / M+++).
      return (
        value === 'M+++' ||
        value.includes('MECONIUM +++') ||
        value.includes('MECONIUM+3') ||
        value.includes('MECONIUM +3')
      );
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
        'Baseline FHR alert: reposition left lateral, optimize perfusion, stop/reduce oxytocin if needed, reassess quickly, and escalate to continuous monitoring with expedited delivery preparation when persistent.',
      );
    case 'fhrDeceleration':
      return t(
        'babyFhrDecelerationAlertGuidance',
        'FHR deceleration alert: optimize maternal condition and monitor continuously; prepare for expedited delivery if recurrent or persistent.',
      );
    case 'amnioticFluid':
      return t(
        'babyAmnioticFluidAlertGuidance',
        'Amniotic fluid alert: increase fetal surveillance for meconium and start broad-spectrum IV antibiotics for suspected infection when foul odor is present.',
      );
    case 'fetalPosition':
      return t(
        'babyFetalPositionAlertGuidance',
        'Fetal position alert: reassess fetal position and descent, use corrective maternal positioning, and escalate review if persistent with poor progress.',
      );
    case 'caput':
      return t(
        'babyCaputAlertGuidance',
        'Caput +++ alert: evaluate for cephalopelvic disproportion or malposition and prepare operative delivery if progress is halted.',
      );
    case 'moulding':
      return t(
        'babyMouldingAlertGuidance',
        'Moulding +++ alert: evaluate for cephalopelvic disproportion or malposition and prepare operative delivery if progress is halted.',
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
      return t(
        'womanPulseAlertGuidance',
        'Pulse alert: assess for dehydration, pain, anxiety, fever, or bleeding; optimize hydration and pain control, then recheck promptly and manage hemorrhage urgently when suspected.',
      );
    case 'systolicBp':
      return t(
        'womanSystolicAlertGuidance',
        'Systolic BP alert: for elevated BP, evaluate pre-eclampsia signs and urine protein; treat severe hypertension per protocol including antihypertensives and magnesium sulfate when indicated. For low BP, left lateral tilt, rapid IV fluids, and assess for bleeding.',
      );
    case 'diastolicBp':
      return t(
        'womanDiastolicAlertGuidance',
        'Diastolic BP alert: evaluate and manage hypertensive disease urgently, including proteinuria screening and severe-feature assessment; escalate treatment per protocol.',
      );
    case 'temperature':
      return t(
        'womanTemperatureAlertGuidance',
        'Temperature alert: confirm hydration, institute cooling and infection assessment, check liquor odor and maternal pulse, start empirical IV antibiotics when intrapartum infection is suspected, and increase FHR monitoring frequency.',
      );
    case 'urine':
      return t(
        'womanUrineAlertGuidance',
        'Urine alert: correlate proteinuria with BP for pre-eclampsia assessment; treat ketonuria with oral intake support or IV dextrose where indicated.',
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
            'Contractions per 10 min alert: if >5 (hyperstimulation), stop/reduce oxytocin, left-lateral position, and consider tocolysis when fetal distress is present. If <2 (inadequate), consider amniotomy or oxytocin augmentation after confirming fetal well-being.',
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
          'Contraction duration alert: reassess labour powers and fetal condition; if contractions are inadequate support augmentation, if excessive with distress reduce stimulation and stabilize mother/fetus.',
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
    return t(
      'womanPulseTokenGuidance',
      'Pulse alert: assess cause (dehydration, pain, anxiety, fever, hemorrhage), optimize hydration and pain control, and recheck promptly.',
    );
  if (normalized.includes('SYSTOLIC'))
    return t(
      'womanSystolicTokenGuidance',
      'Systolic BP alert: for high values evaluate pre-eclampsia and severe features; for low values position left lateral, give IV fluids, and assess for bleeding.',
    );
  if (normalized.includes('DIASTOLIC'))
    return t(
      'womanDiastolicTokenGuidance',
      'Diastolic BP alert: evaluate hypertensive disease urgently with proteinuria and danger-sign review; escalate treatment per protocol.',
    );
  if (normalized.includes('TEMPERATURE'))
    return t(
      'womanTemperatureTokenGuidance',
      'Temperature alert: evaluate for intrapartum infection, hydrate/cool, start empirical IV antibiotics when indicated, and increase fetal monitoring.',
    );
  if (normalized.includes('URINE'))
    return t(
      'womanUrineTokenGuidance',
      'Urine protein/ketone alert: correlate proteinuria with BP for pre-eclampsia, and manage ketonuria with nutrition support or IV dextrose as indicated.',
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
      'Contractions <=2 or >5 per 10 min: for hyperstimulation stop/reduce oxytocin and stabilize; for inadequate contractions consider amniotomy/oxytocin after fetal safety check.',
    );
  if (normalized.includes('CONTRACTION DURATION'))
    return t(
      'contractionDurationTokenGuidance',
      'Contraction duration <20s or >60s: reassess powers, passenger, and passage; optimize uterine activity while maintaining fetal safety.',
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
      'Cervical dilation stall: perform a full three-P assessment (powers, passenger, passage). If contractions are inadequate consider amniotomy/oxytocin; if adequate but no progress, evaluate for CPD and prepare for operative delivery.',
    );
  return t('cervixStallTokenGuidancePlaceholder', 'Labour progress alert: review and act.');
};

// ─── Shared Decision Making assessment prefill ───────────────────────────────

export type SharedDecisionAlertItem = {
  id?: string;
  section: string;
  code: string;
  guidance: string;
  timestampCreatedMs?: number;
};

export type SharedDecisionAssessmentLine = {
  label: string;
  comment: string;
};

export const formatAlertItemAsAssessmentLabel = (item: SharedDecisionAlertItem): string => {
  const code = String(item.code ?? '').trim();
  if (!code) {
    return '';
  }

  const parenMatch = code.match(/^(.+?)\s+\((.+)\)$/);
  if (parenMatch) {
    return `${parenMatch[2].trim()} ${parenMatch[1].trim()}`;
  }

  const guidancePrefix = item.guidance.match(/^([^:\n]+):/);
  if (guidancePrefix?.[1]) {
    return guidancePrefix[1].trim();
  }

  return code;
};

export const buildAssessmentPrefillFromAlerts = (items: SharedDecisionAlertItem[]): string => {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const item of items) {
    if (!item?.code) {
      continue;
    }

    const label = formatAlertItemAsAssessmentLabel(item);
    const dedupeKey = label.toLowerCase();
    if (!label || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    lines.push(`${label}: `);
  }

  return lines.join('\n');
};

export const parseAssessmentValue = (value: string): SharedDecisionAssessmentLine[] => {
  if (!value.trim()) {
    return [];
  }

  return value
    .split('\n')
    .map((line) => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        return { label: line.trim(), comment: '' };
      }

      return {
        label: line.slice(0, colonIndex).trim(),
        comment: line.slice(colonIndex + 1).replace(/^\s/, ''),
      };
    })
    .filter((line) => line.label);
};

export const serializeAssessmentLines = (lines: SharedDecisionAssessmentLine[]): string => {
  return lines
    .map(({ label, comment }) => (label ? `${label}: ${comment}` : ''))
    .filter(Boolean)
    .join('\n');
};
