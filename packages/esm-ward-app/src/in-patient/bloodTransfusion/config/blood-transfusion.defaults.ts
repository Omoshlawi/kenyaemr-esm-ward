import { type TransfusionRateUnit } from '../types/blood-transfusion.types';

export type TransfusionOption = { id: string; label: string };

export const BLOOD_TRANSFUSION_DEFAULTS = {
  /** Clinical consultation encounter type — used to persist and fetch transfusion charts. */
  encounterTypeUuid: '465a92f2-baf8-42e9-9612-53064be868e8',
  encounterTypeName: 'Clinical Consultation',
  encounterTypeDescription: 'Blood transfusion observation chart for inpatient wards.',
};

/** Each observation row is saved as one obs group, tagged with its row id in the group comment. */
export const BLOOD_TRANSFUSION_CONCEPTS = {
  observationGroup: '1114AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  temperature: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  pulse: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  respiratoryRate: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  systolic: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  diastolic: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  remarks: '160632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  transfusionDate: '163268AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  bloodType: '161927AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  bloodUnitNumber: '162086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  counterCheckedBy: '166691AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  rate: '162745AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  timeEnded: '163509AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  amountMl: '164241AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  submittedBy: '166690AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  timeStarted: '2f4a215c-f58f-455b-9d21-ce1364764343',
  diagnosis: '161602AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  reaction: '159935AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

/** Ticked alone; any other reaction clears it. */
export const TRANSFUSION_NO_REACTION = 'none';

/** Reaction option id → answer concept of `BLOOD_TRANSFUSION_CONCEPTS.reaction`. */
export const TRANSFUSION_REACTION_ANSWERS: Record<string, string> = {
  [TRANSFUSION_NO_REACTION]: '1107AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  fever: '140238AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  chillsRigors: '871AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  pain: '114403AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  flushing: '140039AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  nauseaVomiting: '133473AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  urticaria: '123468AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  otherSkinRash: '512AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  anxiety: '121543AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  chestPain: '120749AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  dyspnoea: '122496AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  hypotension: '116214AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  tachycardia: '125063AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  haemoglobinuria: '138936AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  oliguria: '132418AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  anuria: '148566AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  unexplainedBleeding: '162628AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  otherReaction: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

/** Blood type option id → answer concept of `BLOOD_TRANSFUSION_CONCEPTS.bloodType`. */
export const TRANSFUSION_BLOOD_TYPE_ANSWERS: Record<string, string> = {
  wholeBlood: '161939AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  packedRedCells: '161925AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  freshFrozenPlasma: '161926AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  platelets: '161900AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  others: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

export const TRANSFUSION_BLOOD_TYPES: TransfusionOption[] = [
  { id: 'wholeBlood', label: 'Whole Blood' },
  { id: 'packedRedCells', label: 'Packed Red Cells' },
  { id: 'freshFrozenPlasma', label: 'Fresh Frozen Plasma (FFP)' },
  { id: 'platelets', label: 'Platelets' },
  { id: 'others', label: 'Others' },
];

export const TRANSFUSION_RATE_UNITS: Array<{ id: TransfusionRateUnit; label: string }> = [
  { id: 'mlPerMin', label: 'mL/minute' },
  { id: 'dropsPerMin', label: 'drops/minute' },
];

export type TransfusionObservationRowDef = {
  id: string;
  label: string;
  /** Minutes after the transfusion started; `before` and `after` rows are anchored differently. */
  offsetMinutes?: number;
  anchor: 'before' | 'start' | 'end';
};

export const TRANSFUSION_OBSERVATION_ROWS: TransfusionObservationRowDef[] = [
  { id: 'before', label: 'Before', anchor: 'before' },
  { id: 'm0', label: '0 min', offsetMinutes: 0, anchor: 'start' },
  { id: 'm15', label: '15 min', offsetMinutes: 15, anchor: 'start' },
  { id: 'm45', label: '45 min', offsetMinutes: 45, anchor: 'start' },
  { id: 'm75', label: '1h 15', offsetMinutes: 75, anchor: 'start' },
  { id: 'm105', label: '1h 45', offsetMinutes: 105, anchor: 'start' },
  { id: 'm135', label: '2h 15', offsetMinutes: 135, anchor: 'start' },
  { id: 'm165', label: '2h 45', offsetMinutes: 165, anchor: 'start' },
  { id: 'm195', label: '3h 15', offsetMinutes: 195, anchor: 'start' },
  { id: 'm225', label: '3h 45', offsetMinutes: 225, anchor: 'start' },
  { id: 'm255', label: '4h 15', offsetMinutes: 255, anchor: 'start' },
  { id: 'after', label: '4h after end', offsetMinutes: 240, anchor: 'end' },
];

export const TRANSFUSION_REACTION_GROUPS: Array<{ id: string; label: string; options: TransfusionOption[] }> = [
  {
    id: 'general',
    label: 'General',
    options: [
      { id: 'fever', label: 'Fever' },
      { id: 'chillsRigors', label: 'Chills/Rigors' },
      { id: 'pain', label: 'Pain' },
      { id: 'flushing', label: 'Flushing' },
      { id: 'nauseaVomiting', label: 'Nausea/Vomiting' },
      { id: 'anxiety', label: 'Anxiety' },
    ],
  },
  {
    id: 'dermatological',
    label: 'Dermatological',
    options: [
      { id: 'urticaria', label: 'Urticaria' },
      { id: 'otherSkinRash', label: 'Skin rash' },
    ],
  },
  {
    id: 'cardiacRespiratory',
    label: 'Cardiac/Respiratory',
    options: [
      { id: 'chestPain', label: 'Chest Pain' },
      { id: 'dyspnoea', label: 'Dyspnoea' },
      { id: 'hypotension', label: 'Hypotension' },
      { id: 'tachycardia', label: 'Tachycardia' },
    ],
  },
  {
    id: 'others',
    label: 'Others',
    options: [
      { id: 'haemoglobinuria', label: 'Haemoglobinuria' },
      { id: 'oliguria', label: 'Oliguria' },
      { id: 'anuria', label: 'Anuria' },
      { id: 'unexplainedBleeding', label: 'Unexplained bleeding' },
      { id: 'otherReaction', label: 'Others' },
    ],
  },
];

/** A reading is flagged when it crosses these limits or rises this much above the pre-transfusion baseline. */
export const TRANSFUSION_FLAG_RULES = {
  feverC: 38,
  temperatureRiseC: 1,
  pulseRiseBpm: 20,
};

/** Vitals stay inside the OpenMRS concept absolute ranges (5088 ≤ 43 °C, 5087 ≤ 230, 5242 ≤ 99, 5085 ≤ 250, 5086 ≤ 150). */
export const TRANSFUSION_INPUT_LIMITS = {
  temperature: { min: 30, max: 43 },
  pulse: { min: 20, max: 230 },
  respiratoryRate: { min: 0, max: 80 },
  systolic: { min: 30, max: 250 },
  diastolic: { min: 10, max: 150 },
  rate: { min: 0, max: 1000 },
  amountMl: { min: 0, max: 5000 },
};
