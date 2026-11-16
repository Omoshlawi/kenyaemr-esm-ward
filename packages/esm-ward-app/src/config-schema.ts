import { type ConfigSchema, Type, validators } from '@openmrs/esm-framework';

export const addressFields = [
  'cityVillage',
  'stateProvince',
  'country',
  'postalCode',
  'countyDistrict',
  'latitude',
  'longitude',
  'address1',
  'address2',
  'address3',
  'address4',
  'address5',
  'address6',
  'address7',
  'address8',
  'address9',
  'address10',
  'address11',
  'address12',
  'address13',
  'address14',
  'address15',
] as const;

type AddressField = keyof typeof addressFields;

export const labourCareGuideConceptUuids = {
  UUID_SHARED_DECISION_ASSESSMENT: '162164AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_SHARED_DECISION_PLAN: '166021AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_SHARED_DECISION_ACTION: '160433AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_SHARED_DECISION_CONTINUE_MONITORING: '159835AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_SHARED_DECISION_TRANSFER_TO_CS: '159739AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_SHARED_DECISION_REFERRAL: '0dcc1312-e83e-4317-97c3-4b127b599744',
  UUID_SHARED_DECISION_TWIN_ONE_BIRTH: 'd9ad3cc2-5800-4cd0-ab51-fa3306295617',
  UUID_SHARED_DECISION_BIRTH: 'fb50f3e1-0971-4f82-9774-41ff57e38043',
  UUID_CONTRACTION_NONE: '1107AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_CONTRACTION_MILD: '1498AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_CONTRACTION_MODERATE: '1499AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_CONTRACTION_STRONG: '166788AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_CONTRACTION_STRONG_FALLBACK: '4b90b73a-ad11-4650-91b0-baea131974e0',
  UUID_URINE_NEGATIVE: '1874AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_URINE_ONE_PLUS: '1362AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_URINE_TWO_PLUS: '1363AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_URINE_THREE_PLUS: '1364AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_URINE_NOT_DONE: '1118AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_URINE_TEST_TIME_SLOT: 'bb3724c9-fbcc-49c5-9702-6cde0be325ca',
  UUID_PARTOGRAPHY_ENCOUNTER: '022d62af-e2a5-4282-953b-52dd5cba3296',
  /** Dedicated Labour Care Guide encounter type for new LCG submissions. */
  UUID_LCG_ENCOUNTER: '110967b5-3f82-41cb-be85-3b359283d8f8',
  UUID_MEDICATION_OXYTOCIN_ADMINISTERED: '82580974-ff46-41c5-b218-4bea7f53bf7e',
  UUID_MEDICATION_OXYTOCIN_DOSE: '166530AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_MEDICATION_MEDICATION: '1282AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_MEDICATION_NAME: 'c3082af8-f935-40c5-aa5b-74c684e81aea',
  UUID_YES: '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_NO: '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_SUPPORTIVE_CARE_COMPANION: '8a5757a7-b607-4948-b8a8-587b1f44366a',
  UUID_SUPPORTIVE_CARE_PAIN_RELIEF: 'a563b9bd-eb1d-4a0e-8271-f3ee00da6d25',
  UUID_SUPPORTIVE_CARE_ORAL: '217c3dcb-d13e-48d6-89b9-f2c588d50a3c',
  UUID_SUPPORTIVE_CARE_POSTURE: 'dc94a788-de10-417d-aac8-0aed5ba3b806',
  UUID_SUPPORTIVE_CARE_DECLINED: '167156AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_SUPPORTIVE_CARE_SUPINE: '159629AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_SUPPORTIVE_CARE_MOBILE: 'c05125ad-e297-491f-aa65-d73ecc3245f0',
  UUID_BABY_BASELINE_FHR: '1440AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_BABY_FHR_DECELERATION: 'c608022e-a29c-44c9-a4c8-24b6e3105ae4',
  UUID_BABY_AMNIOTIC_FLUID: '30ea66be-16d1-44f6-af40-4fe273814454',
  UUID_BABY_FETAL_POSITION: '78a5cb66-ca95-4965-9c54-0cb6198c9389',
  UUID_BABY_CAPUT: '4e54e9bf-9a1a-4dfd-a4a1-b727860f1c4a',
  UUID_BABY_MOULDING: '166527AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_BABY_FHR_DECELERATION_LATE: '167151AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_BABY_FHR_DECELERATION_EARLY: '58f1c745-8873-44ff-9680-2a3bbe172990',
  UUID_BABY_FHR_DECELERATION_VARIABLE: '155653AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_BABY_AMNIOTIC_INTACT: '164899AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_BABY_AMNIOTIC_CLEAR: '159484AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_BABY_AMNIOTIC_BLOOD: '1077AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_BABY_AMNIOTIC_MECONIUM: '134488AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_BABY_FETAL_POSITION_ANTERIOR: '164148AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_BABY_FETAL_POSITION_POSTERIOR: '541AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_BABY_FETAL_POSITION_TRANSVERSE: '124261AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_MATERNITY_INPATIENT_ENCOUNTER_TYPE: '6877a5b4-441d-4dff-ada1-fcc2485c33e6',
  UUID_MATERNITY_INPATIENT_FORM: '57b8bb54-321f-4b94-bba5-58850527bfd6',
  UUID_PARITY_CONCEPT: '160080AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_MISCARRIAGE_ABORTIONS_CONCEPT: '1823AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_URGE_TO_PUSH: '9ad5b56d-597c-4a40-ade6-387802daa44a',
  UUID_EMERGENCY_OVERRIDE: '1670AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_EMERGENCY_REASON: '163761AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_SHARED_DECISION_TERMINATE_ONGOING_PROGRESS: '737fa73a-509f-40d8-9e84-91dc71db7f4c',
  UUID_LCG_TERMINATION_REASON_TYPE: '6098AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_LCG_TERMINATION_REASON_WRONG_PATIENT: '164144AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_LCG_TERMINATION_REASON_OTHER: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_LCG_CORRECTION_ENCOUNTER_TYPE: 'b2c4d5e6-7f8a-4e9b-8c1d-2e3f8e4a3b8f',
  UUID_LCG_CORRECTION_TYPE: '4b3eb27b-43c0-4862-bd83-be06beb3d699',
  UUID_LCG_CORRECTION_TYPE_WRONG_PATIENT_TRANSFER: '1286AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_LCG_CORRECTION_SOURCE_PATIENT_UUID: '162720AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_LCG_CORRECTION_SOURCE_TERMINATE_ENCOUNTER_UUID: '1671AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_LCG_CORRECTION_TERMINATION_REASON: '162704AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_LCG_CORRECTION_SOURCE_PATIENT_DISPLAY: '850a960b-e8b5-4775-ba74-aaddb2abbf51',
  UUID_LCG_CORRECTION_TERMINATED_AT: '163286AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UUID_LCG_CORRECTION_TRANSFER_NOTES: '1056dc03-ce4d-45cb-a1eb-87707162e6ee',
  FETAL_HEART_RATE_CONCEPT: '1440AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  FETAL_HEART_RATE_TIME_CONCEPT: 'bb3724c9-fbcc-49c5-9702-6cde0be325ca',
  FETAL_HEART_RATE_HOUR_CONCEPT: '160632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  AMNIOTIC_FLUID_CONCEPT: '162653AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  RUPTURED_MEMBRANES_CONCEPT: '164900AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  AMNIOTIC_CLEAR_LIQUOR_CONCEPT: '159484AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  AMNIOTIC_MECONIUM_STAINED_CONCEPT: '134488AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  AMNIOTIC_ABSENT_CONCEPT: '163747AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  AMNIOTIC_BLOOD_STAINED_CONCEPT: '1077AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  AMNIOTIC_MEMBRANE_INTACT_CONCEPT: 'd1787a76-7310-4223-a645-9fd410d418c1',
  UTERINE_CONTRACTIONS_CONCEPT: '163750AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CONTRACTION_LEVEL_MILD_CONCEPT: '1498AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CONTRACTION_LEVEL_MODERATE_CONCEPT: '1499AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CONTRACTION_LEVEL_STRONG_CONCEPT: '166788AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  UTERINE_CONTRACTION_FREQUENCY_CONCEPT: 'd266dee4-bbe8-4736-b94d-c33300f55bca',
  UTERINE_CONTRACTION_DURATION_CONCEPT: '159368AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  OXYTOCIN_TIME_CONCEPT: 'bb3724c9-fbcc-49c5-9702-6cde0be325ca',
  OXYTOCIN_DROPS_PER_MINUTE_CONCEPT: '1d109b10-7b30-4bfa-8a7c-6ecb73357fc2',
  OXYTOCIN_DOSE_CONCEPT: '81369AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ROUTE_CONCEPT: '8878f9c0-a1ce-47ec-a88f-69ef0f6576ba',
  FREQUENCY_CONCEPT: 'fd9f82fd-f327-4502-ac8e-5d9144dbd504',
  MEDICATION_CONCEPT: 'c3082af8-f935-40c5-aa5b-74c684e81aea',
  IV_FLUIDS_CONCEPT: '644504bd-23bc-4f1e-b9a0-d44f81f4148e',
  IV_FLUID_TYPE_CONCEPT: '161911AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DOSAGE_CONCEPT: 'b71ddb80-2d7f-4bde-a44b-236e62d4c1b6',
  DRUG_DOSE_CONCEPT: '162384AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  MATERNAL_PULSE_CONCEPT: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  SYSTOLIC_BP_CONCEPT: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DIASTOLIC_BP_CONCEPT: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  PULSE_BP_TIME_CONCEPT: 'bb3724c9-fbcc-49c5-9702-6cde0be325ca',
  PROTEIN_LEVEL_CONCEPT: '1875AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  GLUCOSE_LEVEL_CONCEPT: '887AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  KETONE_LEVEL_CONCEPT: '161442AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  URINE_VOLUME_CONCEPT: '159660AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  URINE_CHARACTERISTICS_CONCEPT: '56AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  TIME_RESULTS_RETURNED: '67c3d4c6-465e-4c12-9b7f-d8587ca90603',
  TIME_SAMPLE_COLLECTED: 'c554f157-2e16-4585-af29-c48f5e765ce0',
  CERVIX_CONCEPT: '162261AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DESCENT_OF_HEAD_CONCEPT: '166528AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  STATION_0_CONCEPT: '160769AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  STATION_1_CONCEPT: '162135AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  STATION_2_CONCEPT: '166065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  STATION_3_CONCEPT: '166066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  STATION_4_CONCEPT: '166067AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  STATION_5_CONCEPT: '163734AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DRUG_ORDER_TYPE_UUID: '131168f4-15f5-102d-96e4-000c29c2a5d7',
  ENCOUNTER_ROLE: '240b26f9-dd88-4172-823d-4a8bfeb7841f',
  MOULDING_NONE_CONCEPT: '1107AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  MOULDING_SLIGHT_CONCEPT: '1362AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  MOULDING_MODERATE_CONCEPT: '1363AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  MOULDING_SEVERE_CONCEPT: '1364AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  TEMPERATURE_CONCEPT: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CONTRACTION_COUNT_CONCEPT: 'd266dee4-bbe8-4736-b94d-c33300f55bca',
  MEDICATION_NAME_CONCEPT: '164231AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  EVENT_TYPE_CONCEPT: '162879AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  EVENT_DESCRIPTION_CONCEPT: '160632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  MOULDING_CONCEPT: '166527AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  BLOOD_GROUP_CONCEPT: '300AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  TIME_SLOT_CONCEPT: '163286AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  LABOR_PATTERN_CONCEPT: '164135AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  HOURS_SINCE_RUPTURE_CONCEPT: '167149AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DATE_OF_ADMISSION_CONCEPT: '1640AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  GESTATION_WEEKS_CONCEPT: '1789AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ESTIMATED_DELIVERY_DATE_CONCEPT: '5596AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  LAST_MENSTRUAL_PERIOD_CONCEPT: '1427AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
} as const;

export const labourCareGuidePartographyConfig = {
  conceptMappings: {
    'fetal-heart-rate': [labourCareGuideConceptUuids.FETAL_HEART_RATE_CONCEPT],
    'blood-pressure': [
      labourCareGuideConceptUuids.SYSTOLIC_BP_CONCEPT,
      labourCareGuideConceptUuids.DIASTOLIC_BP_CONCEPT,
    ],
    'maternal-pulse': [labourCareGuideConceptUuids.MATERNAL_PULSE_CONCEPT],
    temperature: [labourCareGuideConceptUuids.TEMPERATURE_CONCEPT],
    'cervical-dilation': [labourCareGuideConceptUuids.CERVIX_CONCEPT],
    'descent-of-head': [labourCareGuideConceptUuids.DESCENT_OF_HEAD_CONCEPT],
    'uterine-contractions': [labourCareGuideConceptUuids.UTERINE_CONTRACTION_FREQUENCY_CONCEPT],
    'urine-analysis': [
      labourCareGuideConceptUuids.PROTEIN_LEVEL_CONCEPT,
      labourCareGuideConceptUuids.GLUCOSE_LEVEL_CONCEPT,
      labourCareGuideConceptUuids.KETONE_LEVEL_CONCEPT,
    ],
    'drugs-fluids': [
      labourCareGuideConceptUuids.UUID_MEDICATION_MEDICATION,
      labourCareGuideConceptUuids.IV_FLUIDS_CONCEPT,
      labourCareGuideConceptUuids.IV_FLUID_TYPE_CONCEPT,
    ],
    'progress-events': [
      labourCareGuideConceptUuids.EVENT_TYPE_CONCEPT,
      labourCareGuideConceptUuids.EVENT_DESCRIPTION_CONCEPT,
      labourCareGuideConceptUuids.FETAL_HEART_RATE_CONCEPT,
      labourCareGuideConceptUuids.CERVIX_CONCEPT,
      labourCareGuideConceptUuids.UTERINE_CONTRACTIONS_CONCEPT,
    ],
  },
  conceptUuids: {
    cervix: labourCareGuideConceptUuids.CERVIX_CONCEPT,
    'fetal-heart-rate': labourCareGuideConceptUuids.FETAL_HEART_RATE_CONCEPT,
    'fetal-heart-rate-hour': labourCareGuideConceptUuids.FETAL_HEART_RATE_HOUR_CONCEPT,
    'fetal-heart-rate-time': labourCareGuideConceptUuids.FETAL_HEART_RATE_TIME_CONCEPT,
    'cervical-dilation': labourCareGuideConceptUuids.CERVIX_CONCEPT,
    'descent-of-head': labourCareGuideConceptUuids.DESCENT_OF_HEAD_CONCEPT,
    'uterine-contractions': labourCareGuideConceptUuids.UTERINE_CONTRACTIONS_CONCEPT,
    'uterine-contraction-frequency': labourCareGuideConceptUuids.UTERINE_CONTRACTION_FREQUENCY_CONCEPT,
    'uterine-contraction-duration': labourCareGuideConceptUuids.UTERINE_CONTRACTION_DURATION_CONCEPT,
    'maternal-pulse': labourCareGuideConceptUuids.MATERNAL_PULSE_CONCEPT,
    'systolic-bp': labourCareGuideConceptUuids.SYSTOLIC_BP_CONCEPT,
    'diastolic-bp': labourCareGuideConceptUuids.DIASTOLIC_BP_CONCEPT,
    temperature: labourCareGuideConceptUuids.TEMPERATURE_CONCEPT,
    'protein-level': labourCareGuideConceptUuids.PROTEIN_LEVEL_CONCEPT,
    'glucose-level': labourCareGuideConceptUuids.GLUCOSE_LEVEL_CONCEPT,
    'ketone-level': labourCareGuideConceptUuids.KETONE_LEVEL_CONCEPT,
    'urine-volume': labourCareGuideConceptUuids.URINE_VOLUME_CONCEPT,
    'contraction-count': labourCareGuideConceptUuids.CONTRACTION_COUNT_CONCEPT,
    'urine-characteristics': labourCareGuideConceptUuids.URINE_CHARACTERISTICS_CONCEPT,
    medication: labourCareGuideConceptUuids.MEDICATION_CONCEPT,
    'medication-name': labourCareGuideConceptUuids.MEDICATION_NAME_CONCEPT,
    'oxytocin-dose': labourCareGuideConceptUuids.OXYTOCIN_DOSE_CONCEPT,
    'oxytocin-drops-per-minute': labourCareGuideConceptUuids.OXYTOCIN_DROPS_PER_MINUTE_CONCEPT,
    'oxytocin-time': labourCareGuideConceptUuids.OXYTOCIN_TIME_CONCEPT,
    'iv-fluids': labourCareGuideConceptUuids.IV_FLUIDS_CONCEPT,
    'iv-fluid-type': labourCareGuideConceptUuids.IV_FLUID_TYPE_CONCEPT,
    dosage: labourCareGuideConceptUuids.DOSAGE_CONCEPT,
    route: labourCareGuideConceptUuids.ROUTE_CONCEPT,
    frequency: labourCareGuideConceptUuids.FREQUENCY_CONCEPT,
    'drug-dose': labourCareGuideConceptUuids.DRUG_DOSE_CONCEPT,
    'event-type': labourCareGuideConceptUuids.EVENT_TYPE_CONCEPT,
    'event-description': labourCareGuideConceptUuids.EVENT_DESCRIPTION_CONCEPT,
    'amniotic-fluid': labourCareGuideConceptUuids.AMNIOTIC_FLUID_CONCEPT,
    'amniotic-clear-liquor': labourCareGuideConceptUuids.AMNIOTIC_CLEAR_LIQUOR_CONCEPT,
    'amniotic-meconium-stained': labourCareGuideConceptUuids.AMNIOTIC_MECONIUM_STAINED_CONCEPT,
    'amniotic-absent': labourCareGuideConceptUuids.AMNIOTIC_ABSENT_CONCEPT,
    'amniotic-blood-stained': labourCareGuideConceptUuids.AMNIOTIC_BLOOD_STAINED_CONCEPT,
    moulding: labourCareGuideConceptUuids.MOULDING_CONCEPT,
    'moulding-none': labourCareGuideConceptUuids.MOULDING_NONE_CONCEPT,
    'moulding-slight': labourCareGuideConceptUuids.MOULDING_SLIGHT_CONCEPT,
    'moulding-moderate': labourCareGuideConceptUuids.MOULDING_MODERATE_CONCEPT,
    'moulding-severe': labourCareGuideConceptUuids.MOULDING_SEVERE_CONCEPT,
    'blood-group': labourCareGuideConceptUuids.BLOOD_GROUP_CONCEPT,
    'time-slot': labourCareGuideConceptUuids.TIME_SLOT_CONCEPT,
    'pulse-time-slot': labourCareGuideConceptUuids.PULSE_BP_TIME_CONCEPT,
    'labor-pattern': labourCareGuideConceptUuids.LABOR_PATTERN_CONCEPT,
    'hours-since-rupture': labourCareGuideConceptUuids.HOURS_SINCE_RUPTURE_CONCEPT,
    'ruptured-membranes': labourCareGuideConceptUuids.RUPTURED_MEMBRANES_CONCEPT,
    'date-of-admission': labourCareGuideConceptUuids.DATE_OF_ADMISSION_CONCEPT,
    'gestation-weeks': labourCareGuideConceptUuids.GESTATION_WEEKS_CONCEPT,
    'estimated-delivery-date': labourCareGuideConceptUuids.ESTIMATED_DELIVERY_DATE_CONCEPT,
    'last-menstrual-period': labourCareGuideConceptUuids.LAST_MENSTRUAL_PERIOD_CONCEPT,
    'baby-twin-index': '163460AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'station-0': labourCareGuideConceptUuids.STATION_0_CONCEPT,
    'station-1': labourCareGuideConceptUuids.STATION_1_CONCEPT,
    'station-2': labourCareGuideConceptUuids.STATION_2_CONCEPT,
    'station-3': labourCareGuideConceptUuids.STATION_3_CONCEPT,
    'station-4': labourCareGuideConceptUuids.STATION_4_CONCEPT,
    'station-5': labourCareGuideConceptUuids.STATION_5_CONCEPT,
  },
  stationDisplayMapping: {
    [labourCareGuideConceptUuids.STATION_0_CONCEPT]: '0/5',
    [labourCareGuideConceptUuids.STATION_1_CONCEPT]: '1/5',
    [labourCareGuideConceptUuids.STATION_2_CONCEPT]: '2/5',
    [labourCareGuideConceptUuids.STATION_3_CONCEPT]: '3/5',
    [labourCareGuideConceptUuids.STATION_4_CONCEPT]: '4/5',
    [labourCareGuideConceptUuids.STATION_5_CONCEPT]: '5/5',
  },
  stationValueMapping: {
    [labourCareGuideConceptUuids.STATION_0_CONCEPT]: 0,
    [labourCareGuideConceptUuids.STATION_1_CONCEPT]: 1,
    [labourCareGuideConceptUuids.STATION_2_CONCEPT]: 2,
    [labourCareGuideConceptUuids.STATION_3_CONCEPT]: 3,
    [labourCareGuideConceptUuids.STATION_4_CONCEPT]: 4,
    [labourCareGuideConceptUuids.STATION_5_CONCEPT]: 5,
  },
  encounterPatterns: [
    'mch-partograph',
    'partography',
    'fetal-monitoring',
    'maternal-monitoring',
    'obstetric-vitals',
    'labor-monitoring',
    'labour-monitoring',
  ],
  fallbackEncounterMapping: {
    'fetal-heart-rate': ['mch-mother-consultation', 'vitals', 'obstetric', 'maternal', 'consultation', 'clinical'],
    'cervical-dilation': ['mch-mother-consultation', 'obstetric', 'maternal', 'consultation', 'clinical'],
    'maternal-pulse': ['vitals', 'maternal', 'consultation', 'clinical'],
    'blood-pressure': ['vitals', 'maternal', 'consultation', 'clinical'],
    temperature: ['vitals', 'consultation', 'clinical'],
    'urine-analysis': ['vitals', 'laboratory', 'consultation', 'clinical'],
    'drugs-fluids': ['medication', 'treatment', 'consultation', 'clinical'],
    'progress-events': ['obstetric', 'maternal', 'consultation', 'clinical'],
  },
  defaultFallbackSequence: ['consultation', 'clinical'],
  retryFallbackTypes: ['vitals', 'consultation', 'clinical'],
  defaultEncounterProviderRole: 'a0b03050-c99b-11e0-9572-0800200c9a66',
  defaultLocationUuid: '1',
  storage: {
    maxLocalEntries: 100,
    storageKeyPrefix: 'partography_',
    cacheKeyPrefix: 'partography_encounters_',
  },
  timeConfig: {
    defaultEncounterOffset: 300000,
    retryEncounterOffset: 3600000,
    cacheInvalidationDelay: 1000,
  },
  progressEventConceptNames: {
    [labourCareGuideConceptUuids.FETAL_HEART_RATE_CONCEPT]: {
      name: 'Fetal Heart Rate',
      unit: 'BPM',
    },
    [labourCareGuideConceptUuids.CERVIX_CONCEPT]: {
      name: 'Cervical Dilation',
      unit: 'cm',
    },
    [labourCareGuideConceptUuids.UTERINE_CONTRACTIONS_CONCEPT]: {
      name: 'Uterine Contractions',
      unit: 'per 10min',
    },
  },
  uuids: {
    timeSlot: 'a1b2c3d4-1111-2222-3333-444455556666',
    mchPartographyEncounterUuid: labourCareGuideConceptUuids.UUID_PARTOGRAPHY_ENCOUNTER,
    mchLcgEncounterUuid: labourCareGuideConceptUuids.UUID_LCG_ENCOUNTER,
    drugsFluidsEncounterUuid: '39da3525-afe4-45ff-8977-c53b7b359158',
    contractionStrongConceptUuid: labourCareGuideConceptUuids.UUID_CONTRACTION_STRONG_FALLBACK,
  },
  graphTypeDisplayNames: {
    'fetal-heart-rate': 'Fetal Heart Rate',
    'cervical-dilation': 'Cervical Dilation',
    'descent-of-head': 'Descent of Head',
    'uterine-contractions': 'Uterine Contractions',
    'maternal-pulse': 'Maternal Pulse',
    'blood-pressure': 'Blood Pressure',
    temperature: 'Temperature',
    'urine-analysis': 'Urine Analysis',
    'drugs-fluids': 'Drugs & Fluids',
    'progress-events': 'Progress & Events',
  },
  amnioticFluidMap: {
    'Membrane intact': labourCareGuideConceptUuids.UUID_BABY_AMNIOTIC_INTACT,
    'Clear liquor': labourCareGuideConceptUuids.UUID_BABY_AMNIOTIC_CLEAR,
    'Meconium Stained': labourCareGuideConceptUuids.UUID_BABY_AMNIOTIC_MECONIUM,
    Absent: labourCareGuideConceptUuids.AMNIOTIC_ABSENT_CONCEPT,
    'Blood Stained': labourCareGuideConceptUuids.UUID_BABY_AMNIOTIC_BLOOD,
  },
  mouldingMap: {
    '0': labourCareGuideConceptUuids.UUID_CONTRACTION_NONE,
    '+': labourCareGuideConceptUuids.UUID_URINE_ONE_PLUS,
    '++': labourCareGuideConceptUuids.UUID_URINE_TWO_PLUS,
    '+++': labourCareGuideConceptUuids.UUID_URINE_THREE_PLUS,
  },
  testData: {
    testGraphTypes: ['fetal-heart-rate', 'cervical-dilation', 'maternal-pulse', 'temperature', 'blood-pressure'],
    sampleDataPoints: [
      { value: 120, time: '10:00' },
      { value: 125, time: '11:00' },
      { value: 130, time: '12:00' },
      { value: 128, time: '13:00' },
    ],
    valueIncrement: 10,
    bloodPressureDecrement: 40,
  },
  descentOfHeadUuidToValue: {
    [labourCareGuideConceptUuids.STATION_0_CONCEPT]: 0,
    [labourCareGuideConceptUuids.STATION_1_CONCEPT]: 1,
    [labourCareGuideConceptUuids.STATION_2_CONCEPT]: 2,
    [labourCareGuideConceptUuids.STATION_3_CONCEPT]: 3,
    [labourCareGuideConceptUuids.STATION_4_CONCEPT]: 4,
    [labourCareGuideConceptUuids.STATION_5_CONCEPT]: 5,
  },
} as const;

export type LabourCareGuidePartographyConfig = typeof labourCareGuidePartographyConfig;

export const configSchema: ConfigSchema = {
  patientCardElements: {
    _description:
      'Configuration of various patient card elements. Each configured element must have a unique id, defined in the ward React component being used.',
    obs: {
      _type: Type.Array,
      _description: 'Configures obs values to display.',
      _default: [],
      _elements: {
        id: {
          _type: Type.String,
          _description: 'The unique identifier for this patient card element',
        },
        conceptUuid: {
          _type: Type.UUID,
          _description: 'Identifies the concept to use to identify the desired observations.',
        },
        label: {
          _type: Type.String,
          _description:
            "Optional. The custom label or i18n key to the translated label to display. If not provided, defaults to the concept's name. (Note that this can be set to an empty string to not show a label)",
          _default: null,
        },
        orderBy: {
          _type: Type.String,
          _description:
            "One of 'ascending' or 'descending', specifying whether to display the obs by obsDatetime ascendingly or descendingly.",
          _default: 'descending',
          _validators: [validators.oneOf(['ascending', 'descending'])],
        },
        limit: {
          _type: Type.Number,
          _description:
            'If set to a number greater than one, this will show multiple obs for this concept, which will appear as a list. Set to 0 for unlimited.',
          _default: 1,
        },
        onlyWithinCurrentVisit: {
          _type: Type.Boolean,
          _description:
            'Optional. If true, limits display to only observations within current visit. Defaults to false',
          _default: false,
        },
      },
    },
    pendingItems: {
      _type: Type.Array,
      _description: 'Configures pending orders and transfers to display.',
      _default: [
        {
          id: 'pending-items',
          orders: {
            orderTypes: [{ label: 'Labs', uuid: '52a447d3-a64a-11e3-9aeb-50e549534c5e' }],
          },
          showPendingItems: true,
        },
      ],
      _elements: {
        id: {
          _type: Type.String,
          _description: 'The unique identifier for this patient card element',
        },
        orders: {
          orderTypes: {
            _type: Type.Array,
            _description: 'Configures pending orders and transfers to display.',
            _elements: {
              uuid: {
                _type: Type.UUID,
                _description: 'Identifies the order type.',
              },
              label: {
                _type: Type.String,
                _description:
                  "The label or i18n key to the translated label to display. If not provided, defaults to 'Orders'",
                _default: null,
              },
            },
          },
        },
        showPendingItems: {
          _type: Type.Boolean,
          _description:
            'Optional. If true, pending items (e.g., number of pending orders) will be displayed on the patient card.',
        },
      },
    },
    patientIdentifier: {
      _type: Type.Array,
      _description: `Configures patient identifier to display. An unconfigured element displays the preferred identifier.`,
      _default: [
        {
          id: 'patient-identifier',
          showIdentifierLabel: false,
        },
      ],
      _elements: {
        id: {
          _type: Type.String,
          _description: 'The unique identifier for this patient card element',
        },
        showIdentifierLabel: {
          _type: Type.Boolean,
          _description:
            'If true, the identifier type (eg: "OpenMRS ID") is shown along with the identifier itself. Defaults to false',
        },
      },
    },
    patientAddress: {
      _type: Type.Array,
      _description: 'Configures patient address elements.',
      _default: [
        {
          id: 'patient-address',
          fields: ['cityVillage', 'country'],
        },
      ],
      _elements: {
        fields: {
          id: {
            _type: Type.String,
            _description: 'The unique identifier for this patient card element',
          },
          fields: {
            _type: Type.Array,
            _description: 'The fields of the address to display',
            _elements: {
              _type: Type.String,
              _validators: [validators.oneOf(addressFields)],
            },
          },
        },
      },
    },
    admissionRequestNote: {
      _type: Type.Array,
      _description: 'Configures admission request notes to display.',
      _default: [
        {
          id: 'admission-request-note',
          conceptUuid: '161011AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
      ],
      _elements: {
        fields: {
          id: {
            _type: Type.String,
            _description: 'The unique identifier for this patient card element',
          },
          conceptUuid: {
            _type: Type.UUID,
            _description: 'Required. Identifies the concept for the admission request note.',
          },
        },
      },
      coloredObsTags: {
        _type: Type.Array,
        _description: 'Configures observation values to display as Carbon tags.',
        _elements: {
          conceptUuid: {
            _type: Type.UUID,
            _description: 'Required. Identifies the concept to use to identify the desired observations.',
            // Problem list
            _default: '1284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          },
          summaryLabel: {
            _type: Type.String,
            _description: `Optional. The custom label or i18n key to the translated label to display for the summary tag. The summary tag shows the count of the number of answers that are present but not configured to show as their own tags. If not provided, defaults to the name of the concept.`,
            _default: null,
          },
          summaryLabelI18nModule: {
            _type: Type.String,
            _description: 'Optional. The custom module to use for translation of the summary label',
            _default: null,
          },
          summaryLabelColor: {
            _type: Type.String,
            _description:
              'The color of the summary tag. See https://react.carbondesignsystem.com/?path=/docs/components-tag--overview for a list of supported colors',
            _default: null,
          },
          tags: {
            _type: Type.Array,
            _description: `An array specifying concept sets and color. Observations with coded values that are members of the specified concept sets will be displayed as their own tags with the specified color. Any observation with coded values not belonging to any concept sets specified will be summarized as a count in the summary tag. If a concept set is listed multiple times, the first matching applied-to rule takes precedence.`,
            _default: [],
            _elements: {
              color: {
                _type: Type.String,
                _description:
                  'Color of the tag. See https://react.carbondesignsystem.com/?path=/docs/components-tag--overview for a list of supported colors.',
              },
              appliedToConceptSets: {
                _type: Type.Array,
                _description: `The concept sets which the color applies to. Observations with coded values that are members of the specified concept sets will be displayed as their own tag with the specified color. If an observation's coded value belongs to multiple concept sets, the first matching applied-to rule takes precedence.`,
                _elements: {
                  _type: Type.UUID,
                },
              },
            },
          },
        },
      },
    },
  },
  wards: {
    _description: 'Configuration of what type of ward to use at different ward locations.',
    _type: Type.Array,
    _default: [{ id: 'default-ward' }],
    _elements: {
      id: {
        _type: Type.String,
        _description:
          'The ward type to use. Currently, "default-ward" and "maternal-ward" are supported. This string also serves as the extension slot name for the ward view.',
      },
      appliedTo: {
        _type: Type.Array,
        _description:
          'Optional. Conditions under which this card definition should be used. If not provided, the configuration is applied to all wards.',
        _elements: {
          location: {
            _type: Type.UUID,
            _description: 'The UUID of the location. If not provided, applies to all wards.',
            _default: null,
          },
        },
      },
    },
  },
  hideWorkspaceVitalsLinks: {
    _description: 'Configure whether to hide vital history and record vital links in the ward patient workspace.',
    _type: Type.Boolean,
    _default: false,
  },
  ipdDischargeEncounterTypeUuid: {
    _description: 'IPD Discharge encounter type',
    _type: Type.String,
    _default: '7e618d13-ffdb-4650-9a97-10ccd16ca36d',
  },
  transferRequestEncounterTypeUuid: {
    _description: 'Tranfer request encounter type',
    _type: Type.String,
    _default: 'b2c4d5e6-7f8a-4e9b-8c1d-2e3f8e4a3b8f',
  },
  referralsConceptUuid: {
    _description: 'Referrals concept uuid',
    _type: Type.String,
    _default: '1695AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
  referringToAnotherFacilityConceptUuid: {
    _description: 'Referring to another facility concept uuid',
    _type: Type.String,
    _default: '164165AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
  inpatientDischargeFormUuid: {
    _description: 'IPD Discharge form uuid',
    _type: Type.String,
    _default: '98a781d2-b777-4756-b4c9-c9b0deb3483c',
  },
  admissionRequestFormUuid: {
    _description: 'Admission request form uuid',
    _type: Type.String,
    _default: '0bae7646-b079-4cbb-8130-b24274fc16f7',
  },
  admissionFormUuid: {
    _description: 'Admission form uuid',
    _type: Type.String,
    _default: '49f3686d-b83c-4263-a5a1-89040f643a78',
  },
  cifFormUuid: {
    _description: 'Case Identification finding form uuid',
    _type: Type.String,
    _default: '47352c6c-af86-4996-81fe-bb9c224fe80b',
  },
  conceptUuidForWardAdmission: {
    _description: 'Concept UUID for ward admission',
    _type: Type.Object,
    _default: {
      paymentMethod: 'ffd8e033-a286-42b4-89d5-c6d6506d3161',
      mpesaPaymentMethod: '9b24f997-6582-46b5-8f58-924b0e39ad9a',
      cashPaymentMethod: 'fc894152-07be-4e77-9dac-2a164e400a13',
      insurancePaymentMethod: '159356AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      otherInsuaranceType: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      insuranceOtherSpecify: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      primaryDoctor: '2b537713-298c-4b60-83c3-8006ea622d70',
      primaryDoctorPhoneNumber: '159635AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      emmergencyDoctor: '1473AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      dischargingDoctor: '1473AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      emmergencyDoctorPhoneNumber: '163152AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      admissionDateTime: '1640AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      chiefComplaint: '5219AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      complaint: '160531AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      physicalExamination: '162737AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      dischargeInstruction: '160632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      drugReaction: '162747AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      reactingDrug: '1193AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  },
  diagnosisConceptSourceUud: {
    _type: Type.UUID,
    _description: 'Diagnosis concept source',
    _default: '39ADDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  },
  insuaranceTypes: {
    _description: 'Insuarance Types',
    _type: Type.Array,
    _elements: {
      concept: {
        _type: Type.UUID,
        _description: 'Concept Uuid',
      },
      label: {
        _type: Type.String,
        _description: 'Display string',
      },
    },
    _default: [
      {
        concept: '1a7fb8b5-6093-486d-baa2-65f8b4388544',
        label: 'SHA',
      },
      {
        concept: '1917AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        label: 'Policy Holder',
      },
      {
        concept: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        label: 'OTHER',
      },
    ],
  },
  inpatientAdmissionEncounterProviderRole: {
    _type: Type.UUID,
    _description: 'Encounter provider role',
    _default: "'a0b03050-c99b-11e0-9572-0800200c9a66'",
  },
  mortuaryAdmissionLoctionTagUuid: {
    _description: 'Mortuary admission location tag uuid',
    _type: Type.String,
    _default: '1dbbfe22-d21f-499c-bf33-cc9f75b6c7e8',
  },
  dailyBedFeeBillableService: {
    _description: 'Daily Bed Fee bILLABLE SERVICE uuid',
    _type: Type.UUID,
    _default: '0a5a23e3-c953-428c-92e3-3b99f8a822f0',
  },
  cashPointUuid: {
    _type: Type.String,
    _description: 'Cash point uuid used when raising a ward bill',
    _default: '54065383-b4d4-42d2-af4d-d250a1fd2590',
  },
  cashierUuid: {
    _type: Type.String,
    _description: 'Cashier uuid used when raising a ward bill',
    _default: '54065383-b4d4-42d2-af4d-d250a1fd2590',
  },
  wardBillingCurrencyLocaleMap: {
    _type: Type.Object,
    _description: 'Optional mapping of locale (e.g. en-KE) to ISO currency code (e.g. KES) for ward billing displays.',
    _default: {
      en: 'KES',
      sw: 'KES',
      'en-KE': 'KES',
      'sw-KE': 'KES',
    },
  },
  drugOrderEncounterType: {
    _description: 'Drug Order encounter type Uuid',
    _type: Type.UUID,
    _default: '7df67b83-1b84-4fe2-b1b7-794b4e9bfcc3',
  },
  clinicalConsultationEncounterType: {
    _description: 'Clinical consultation encounter type Uuid',
    _type: Type.UUID,
    _default: '465a92f2-baf8-42e9-9612-53064be868e8',
  },
  doctorsNoteEncounterType: {
    _description: 'Doctors note encounter type Uuid',
    _type: Type.UUID,
    _default: '14b36860-5033-4765-b91b-ace856ab64c2',
  },
  inPatientForms: {
    _type: Type.Array,
    _description: 'List of forms that can be filled out for in-patients',
    _default: [
      {
        label: 'Cardex Nursing Plan',
        uuid: '1f81d5e2-3569-40cf-bbb9-361a53ba409b',
        tags: [],
      },
      {
        label: 'IPD Procedure Form',
        uuid: '2b9c2b94-0b03-416a-b312-eef49b42f72c',
        tags: [],
      },
      {
        label: 'Newborn Unit Admission ',
        uuid: '5b0a08f5-87c1-40cc-8c09-09c33b44523d',
        hideExpression: 'ageInDays < 28',
        tags: [],
      },
      {
        uuid: '87379b0a-738b-4799-9736-cdac614cee2a',
        label: 'Inpatient Review Notes',
        tags: [],
      },
      {
        uuid: 'dbc4ff03-3eee-49f0-86a8-7cfd33dc2460',
        label: 'Admission Notes',
        dependancies: ['87379b0a-738b-4799-9736-cdac614cee2a'],
        tags: [],
      },
      {
        uuid: 'a14824ca-29af-4d37-b9da-6bdee39f8808',
        label: 'Pre-Operation Checklist',
        tags: [],
      },
      {
        uuid: 'b4bfa7a3-f6ed-4339-a4ec-b076463c0696',
        label: 'Fluid Intake',
        tags: [],
      },
      {
        uuid: '3efe6966-a011-4d24-aa43-d3051bfbb8e3',
        label: 'Initial Nursing Cardex',
        tags: [],
      },
      {
        uuid: '57b8bb54-321f-4b94-bba5-58850527bfd6',
        label: 'Maternity inpatient form',
        tags: [{ uuid: 'dab3c2bb-0b0b-4ebd-8f99-3ad44996d311', tag: 'Antenantal Ward' }],
      },
      {
        uuid: '98a781d2-b777-4756-b4c9-c9b0deb3483c',
        label: 'Inpatient Discharge form',
        tags: [
          { uuid: 'dab3c2bb-0b0b-4ebd-8f99-3ad44996d311', tag: 'Antenantal Ward' },
          { uuid: '7680b7ee-6880-450c-8b7e-2a748b6f9dc7', tag: 'Labour & Delivery Ward' },
          { uuid: '473001b4-5a6e-4e2e-b39c-f54edea89c6f', tag: 'Postnatal Ward' },
        ],
      },
      {
        uuid: '496c7cc3-0eea-4e84-a04c-2292949e2f7f',
        label: 'Delivery form',
        tags: [{ uuid: '7680b7ee-6880-450c-8b7e-2a748b6f9dc7', tag: 'Labour & Delivery Ward' }],
      },
      {
        uuid: '07dc609f-e607-43d6-9dc3-8bd405c4226a',
        label: 'Post Delivery form',
        tags: [{ uuid: '473001b4-5a6e-4e2e-b39c-f54edea89c6f', tag: 'Postnatal Ward' }], // Postnatal and Maternity tags
      },

      {
        uuid: '2061790f-815e-43a9-8a1e-dae9e4956c2a',
        label: 'Surgical Safety Checklist (Sign In)',
        tags: [],
      },
      {
        uuid: '982af61b-fd51-474c-85d2-0459b7e3640b',
        label: 'Surgical Safety Checklist (Sign Out)',
        tags: [],
      },
      {
        uuid: '923411a3-4aae-4242-ba85-bb5b5176e6b1',
        label: 'Surgical Safety Checklist (Time Out)',
        tags: [],
      },
      {
        uuid: '77a06fb9-0035-474e-8b2b-c247ac75d2e7',
        label: 'Preoperative Questionnaire',
        tags: [],
      },
      {
        uuid: 'b8368c5e-7b3b-419e-bd33-bb05cdf34952',
        label: "Doctor's Follow up Note",
        tags: [],
      },
      {
        uuid: 'e8054795-3df5-435d-9ae3-6ae3a6a1857f',
        label: 'Pre- Anaesthesia Checklist',
        tags: [],
      },
      {
        uuid: '56b3ca43-2687-49d4-a03e-1b4329fe0f63',
        label: 'Nursing Care Plan',
        tags: [],
      },
    ],
  },
  inPatientVisitTypeUuid: {
    _type: Type.String,
    _description: 'The visit type uuid for in-patient',
    _default: 'a73e2ac6-263b-47fc-99fc-e0f2c09fc914',
  },
  postProcedureEncounterTypeUuid: {
    _description: 'Post Procedure encounter type Uuid',
    _type: Type.UUID,
    _default: '13beea61-7d3d-4860-abe3-d5b874f736fb',
  },
  postProcedureConceptUuids: {
    _description: 'Concept UUIDs for the Post Procedure form',
    _type: Type.Object,
    _default: {
      surgeryDateTime: '160715AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      operativeProcedure: '166635AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      procedurePerformed: '1651AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      anaesthesiaType: '164254AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      patientPosition: '159633AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      incisionLocation: '163049AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      incisionType: 'b9879725-26f6-4aa4-8777-bc7f75d388c1',
      closureMethod: '166629AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      findings: '160632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      histologySpecimen: '161934AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      specimenType: '163761AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      procedureNotes: '160716AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  },
  paymentMethods: {
    _type: Type.Array,
    _description: 'List of payment methods used when printing gatepass',
    _default: ['Cash [ ]', 'Cheque [ ]', 'SHA [ ]', 'Scheme [ ]', 'M.R.M [ ]'],
  },
  nursingCardex: {
    _type: Type.Object,
    _description: 'Nursing Cardex form concept UUIDs, form field paths and encounter role.',
    _default: {
      encounterRoleUuid: 'a0b03050-c99b-11e0-9572-0800200c9a66',
      concepts: {
        nursingNotes: '164231AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        actionTaken: '1282AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        yes: '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        no: '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        medicationGivenGroup: '159369AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        fluidsGivenGroup: '161911AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nameField: '164231AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        timeField: '9c4c7722-ba3e-4bdf-ab97-c04170100037',
        encounterType: 'b6569074-3b8c-43ba-bd4a-98c445405035',
        formUuid: '1f81d5e2-3569-40cf-bbb9-361a53ba409b',
      },
      formFieldPaths: {
        nursingNotes: 'nursingNotes~9',
        actionTaken: 'actionTaKen~10',
        medicationName: 'medicatIonName~11',
        medicationMeta: 'medicatIonMeta~11m',
        medicationTime: 'TtakEn~12',
        medicationGroup: 'medsRepeat~13',
        actionTakenFluids: 'actionTaKenIVfluids~14',
        fluidName: 'flUidName~15',
        fluidMeta: 'flUidMeta~15m',
        fluidTime: 'fluiDsTtakEn~16',
        fluidGroup: 'fluiDsRepeat~17',
      },
    },
  },
  inpatientLocationTags: {
    _description: 'Location tag UUIDs used to show partograph and labour care guide (maternity and labour ward only).',
    _default: {
      maternityWard: 'b95dd376-fa35-40a6-b140-d144c5f22f62',
      labourWard: '7680b7ee-6880-450c-8b7e-2a748b6f9dc7',
      isolationWard: 'cc5cb426-5433-4e9a-ad22-456e6b627b05',
      psychiatricWard: '37bedf9c-07b1-4d8b-9ba3-ad3b9d48e10d',
      // Official KenyaEMR critical-care location tag UUIDs (same at every facility).
      icuWard: '770f6a93-8e59-48ad-ba7d-98d5652db240',
      hduWard: '25439b2d-6495-4f5d-9ec6-4fe64686cf46',
      nicuWard: '17558b82-7275-409c-9f77-0d934ae881cf',
      picuWard: 'd9aaa6fa-8594-416c-b5da-e50fd3a180b2',
      pediatricWard: '0db2eb63-f0ac-4f22-8d65-766a4828c9ba',
    },
  },
  bypassPartographAdmissionChecks: {
    _type: Type.Boolean,
    _description:
      'Demo flag. When true, skip admission and labour-ward tag checks and show partograph for female patients. Set to false for production.',
    _default: false,
  },
  treatmentChartCardexEncounterTypeUuid: {
    _description: 'Encounter type uuid for the cardex section of the treatment sheet',
    _type: Type.UUID,
    _default: 'b6569074-3b8c-43ba-bd4a-98c445405035',
  },
  treatmentChartCardexFormUuid: {
    _description: 'Form uuid for the cardex section of the treatment sheet',
    _type: Type.UUID,
    _default: '1f81d5e2-3569-40cf-bbb9-361a53ba409b',
  },
  treatmentChartMedicationGroupUuid: {
    _description: 'Concept uuid for the medication group in the cardex section of the treatment sheet',
    _type: Type.UUID,
    _default: '159369AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
  treatmentChartFluidGroupUuid: {
    _description: 'Concept uuid for the fluids group in the cardex section of the treatment sheet',
    _type: Type.UUID,
    _default: '161911AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
  treatmentChartNameConceptUuid: {
    _description: 'Concept uuid for the name field in the cardex section of the treatment sheet',
    _type: Type.UUID,
    _default: '164231AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
  treatmentChartTimeConceptUuid: {
    _description: 'Concept uuid for the time field in the cardex section of the treatment sheet',
    _type: Type.UUID,
    _default: '9c4c7722-ba3e-4bdf-ab97-c04170100037',
  },
  partography: {
    _type: Type.Object,
    _description: 'Labour care guide partography module configuration',
    _default: labourCareGuidePartographyConfig,
  },
  lcgSessionCorrectionPrivilege: {
    _type: Type.String,
    _description: 'OpenMRS privilege required to open the LCG wrong-patient correction wizard',
    _default: 'Correct LCG Wrong Patient',
  },
  nationIdIdentifierTypeUuid: {
    _type: Type.UUID,
    _description: 'Identifier type uuid for the national ID',
    _default: '49af6cdc-7968-4abb-bf46-de10d7f4859f',
  },
  crIdentifierTypeUuid: {
    _type: Type.UUID,
    _description: 'Identifier type uuid for the SHIF ID',
    _default: '24aedd37-b5be-4e08-8311-3721b8d5100d',
  },
  showCrIdentifierOnSummary: {
    _type: Type.Boolean,
    _description: 'Whether to show the CR ID on the patient summary',
    _default: true,
  },
  openmrsIdentifierSourceUuid: {
    _type: Type.String,
    _description: 'OpenMRS Identifier Source UUID (Identifier Generator for OpenMRS ID)',
    _default: 'fb034aac-2353-4940-abe2-7bc94e7c1e71',
  },
  openmrsIDUuid: {
    _type: Type.String,
    _description: 'OpenMRS Identifier  UUID',
    _default: 'dfacd928-0370-4315-99d7-6ec1c9f7ae76',
  },
  contactPersonAttributesUuid: {
    _type: Type.Object,
    _description: 'Contact created patient attributes UUID',
    _default: {
      telephone: 'b2c38640-2603-4629-aebd-3b54f33f1e3a',
      contactCreated: '7c94bd35-fba7-4ef7-96f5-29c89a318fcf',
      contactTypeAttributeType: '4608a605-60f0-44cf-a6eb-7bc537e41925',
      healthCareWorkerFacilityAttributetype: '3a5c6d85-e460-4ca4-a3fd-8ac62653a13f',
      headOfHouseholdAttributeType: 'e4230abb-57f5-43d1-9190-fa248c5b2437',
    },
  },
  contactTypesConceptUuids: {
    _type: Type.Object,
    _description: 'Uuids of Contacts types to case for ebola',
    _default: {
      // TODO: Replace with proper concepts from BA
      hadDirectPhysicalContactWithCase: '162632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      sleptOrAteAtTheSameHouseHoldAsCase: '159818AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      touchedBodyFluidsOfCase: 'dcf31ffa-36a1-4673-9a04-34a62e94edc4',
      touchedOrCleanedLinensOrDishesOfCase: '161917AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  },
  contactTracingFormUuid: {
    _type: Type.UUID,
    _description: 'Contact tracing form Uuid',
    _default: '15ed03d2-c972-11e9-a32f-2a2ae2dbcce4',
  },
  contactTracingConceptsUuids: {
    _type: Type.Object,
    _description: 'Concept Uuids for hts contact tracing',
    _default: {
      modeOfClienttracingConceptUuid: 'a55f9516-ddb6-47ec-b10d-cb99d1d0bd41',
      reasonNotContactedConceptUuid: '1779AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      tracingStatusConceptUuid: '159811AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      remarksConceptUuid: '163042AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  },
  htsEcounterUuid: {
    _type: Type.UUID,
    _description: 'HTS Encounter uuid used in contact tracing',
    _default: '9c0a7a57-62ff-4f75-babe-5835b0e921b7',
  },
  ebolaContactFollowup: {
    _type: Type.Object,
    _description: 'Encounter settings used to persist Ebola contact follow-up details',
    _default: {
      encounterRoleUuid: 'a0b03050-c99b-11e0-9572-0800200c9a66',
      encounterType: '465a92f2-baf8-42e9-9612-53064be868e8',
      payloadConcept: '164231AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      dailyMarkConcept: '140238AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      markYesConcept: '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      markNoConcept: '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    encounterRoleUuid: {
      _type: Type.UUID,
      _description: 'Encounter role used when saving contact follow-up',
      _default: 'a0b03050-c99b-11e0-9572-0800200c9a66',
    },
    encounterType: {
      _type: Type.UUID,
      _description: 'Encounter type used when saving contact follow-up',
      _default: '465a92f2-baf8-42e9-9612-53064be868e8',
    },
    payloadConcept: {
      _type: Type.UUID,
      _description: 'Text concept used to store the serialized follow-up payload',
      _default: '164231AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    dailyMarkConcept: {
      _type: Type.UUID,
      _description:
        'Coded question stored for each follow-up day so charts can plot the result. Value Yes means 0 (no fever or bleeding); value No means X (died or fever/bleeding).',
      _default: '140238AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    markYesConcept: {
      _type: Type.UUID,
      _description: 'Coded value for a 0 mark (no fever or bleeding). Defaults to CIEL Yes.',
      _default: '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    markNoConcept: {
      _type: Type.UUID,
      _description: 'Coded value for an X mark (died or fever/bleeding). Defaults to CIEL No.',
      _default: '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  },
  bloodTransfusion: {
    _type: Type.Object,
    _description: 'Blood transfusion observation chart; one encounter per transfusion.',
    _default: {
      encounterTypeUuid: '465a92f2-baf8-42e9-9612-53064be868e8',
    },
    encounterTypeUuid: {
      _type: Type.UUID,
      _default: '465a92f2-baf8-42e9-9612-53064be868e8',
      _description: 'Encounter type used to save and fetch blood transfusions (defaults to Clinical Consultation).',
    },
  },
  admissionNotesFormUuid: {
    _type: Type.UUID,
    _description: 'Admission notes form uuid',
    _default: 'dbc4ff03-3eee-49f0-86a8-7cfd33dc2460',
  },
  inpatientReviewFormUuid: {
    _type: Type.UUID,
    _description: 'Doctors notes form uuid',
    _default: '87379b0a-738b-4799-9736-cdac614cee2a',
  },
  mentalHealthScreeningTools: {
    _type: Type.Array,
    _description: 'Mental health screening tools',
    _default: [
      {
        label: 'Alcohol Abuse Screening Tool (AUDIT)',
        formUuid: '7ba743c8-d8e6-44ad-aeed-8d2ff9e985db',
      },
      {
        label: 'Generalized Anxiety Disorder Assessment',
        formUuid: '524d078e-936a-4543-9ca6-7a8d9ed4db06',
      },
      {
        label: 'Depression Screening (PHQ-9)',
        formUuid: '5fe533ee-0c40-4a1f-a071-dc4d0fbb0c17',
      },
      {
        label: 'Schizophrenia Test and Early Psychosis Indicator',
        formUuid: '793556aa-49a1-4502-8830-1253e510acbc',
      },
      {
        label: 'Suicide Risk Assessment Form',
        formUuid: 'c582be1d-b872-406b-8035-67964b5cb91d',
      },
      {
        label: 'Drug Abuse Screening Test',
        formUuid: 'b2c3d4e5-f6g7-48h9-i0j1-k213m4n506p7',
      },
    ],
  },
  psychiatricCategories: {
    _type: Type.Object,
    _description: 'Psychiatric categories',
    _default: {
      question: '11c54b66-d733-460c-81ad-5347371fa41b',
      voluntary: 'ae2b3f93-bd11-4d8f-88ee-bc8d20ab7154',
      involuntary: '6455c7db-f438-4c15-a146-defcbf9b3f2b',
      emergencyAdmission: '06f34d63-c694-421f-8a96-37a70d9e14ad',
      forensicAdmission: '7f10db1a-23dd-4769-b191-3b6a63a21f64',
    },
  },
} as const;

export interface WardConfigObject {
  patientCardElements: {
    obs: Array<ObsElementConfig>;
    pendingItems: Array<PendingItemsElementConfig>;
    patientIdentifier: Array<IdentifierElementConfig>;
    patientAddress: Array<PatientAddressElementConfig>;
    coloredObsTags: Array<ColoredObsTagsElementConfig>;
    admissionRequestNote: Array<AdmissionRequestNoteElementConfig>;
  };
  wards: Array<WardDefinition>;
  hideWorkspaceVitalsLinks: boolean;
  ipdDischargeEncounterTypeUuid: string;
  inpatientDischargeFormUuid: string;
  transferRequestEncounterTypeUuid: string;
  referralsConceptUuid: string;
  referringToAnotherFacilityConceptUuid: string;
  insuaranceTypes: Array<{ label: string; concept: string }>;
  conceptUuidForWardAdmission: {
    paymentMethod: string;
    mpesaPaymentMethod: string;
    cashPaymentMethod: string;
    insurancePaymentMethod: string;
    otherInsuaranceType: string;
    insuranceOtherSpecify: string;
    primaryDoctorPhoneNumber: string;
    primaryDoctor: string;
    emmergencyDoctor: string;
    emmergencyDoctorPhoneNumber: string;
    admissionDateTime: string;
    chiefComplaint: string;
    physicalExamination: string;
    dischargeInstruction: string;
    dischargingDoctor: string;
    complaint: string;
    drugReaction: string;
    reactingDrug: string;
  };
  diagnosisConceptSourceUud: string;
  inpatientAdmissionEncounterProviderRole: string;
  mortuaryAdmissionLoctionTagUuid: string;
  dailyBedFeeBillableService: string;
  cashPointUuid: string;
  cashierUuid: string;
  wardBillingCurrencyLocaleMap: Record<string, string>;
  drugOrderEncounterType: string;
  clinicalConsultationEncounterType: string;
  doctorsNoteEncounterType: string;
  admissionRequestFormUuid: string;
  admissionFormUuid: string;
  cifFormUuid: string;
  inPatientForms: Array<{
    label: string;
    uuid: string;
    hideExpression: string;
    tags: Array<{ uuid: string; tag: string }>;
  }>;
  inPatientVisitTypeUuid: string;
  postProcedureEncounterTypeUuid: string;
  postProcedureConceptUuids: {
    surgeryDateTime: string;
    operativeProcedure: string;
    procedurePerformed: string;
    anaesthesiaType: string;
    patientPosition: string;
    incisionLocation: string;
    incisionType: string;
    closureMethod: string;
    findings: string;
    histologySpecimen: string;
    specimenType: string;
    procedureNotes: string;
  };
  paymentMethods: Array<string>;
  nursingCardex: {
    encounterRoleUuid: string;
    concepts: {
      nursingNotes: string;
      actionTaken: string;
      yes: string;
      no: string;
      medicationGivenGroup: string;
      fluidsGivenGroup: string;
      nameField: string;
      timeField: string;
      encounterType: string;
      formUuid: string;
    };
    formFieldPaths: {
      nursingNotes: string;
      actionTaken: string;
      medicationName: string;
      medicationMeta: string;
      medicationTime: string;
      medicationGroup: string;
      actionTakenFluids: string;
      fluidName: string;
      fluidMeta: string;
      fluidTime: string;
      fluidGroup: string;
    };
  };
  inpatientLocationTags: {
    maternityWard: string;
    labourWard: string;
    icuWard: string;
    hduWard: string;
    nicuWard: string;
    picuWard: string;
    pediatricWard: string;
    isolationWard: string;
    psychiatricWard: string;
  };
  bypassPartographAdmissionChecks: boolean;
  treatmentChartCardexEncounterTypeUuid: string;
  treatmentChartCardexFormUuid: string;
  treatmentChartMedicationGroupUuid: string;
  treatmentChartFluidGroupUuid: string;
  treatmentChartNameConceptUuid: string;
  treatmentChartTimeConceptUuid: string;
  partography: LabourCareGuidePartographyConfig;
  lcgSessionCorrectionPrivilege: string;
  nationIdIdentifierTypeUuid: string;
  crIdentifierTypeUuid: string;
  showCrIdentifierOnSummary: boolean;
  openmrsIdentifierSourceUuid: string;
  openmrsIDUuid: string;
  contactPersonAttributesUuid: {
    telephone: string;
    contactCreated: string;
    contactTypeAttributeType: string;
    healthCareWorkerFacilityAttributetype: string;
    headOfHouseholdAttributeType: string;
  };
  contactTypesConceptUuids: {
    hadDirectPhysicalContactWithCase: string;
    sleptOrAteAtTheSameHouseHoldAsCase: string;
    touchedBodyFluidsOfCase: string;
    touchedOrCleanedLinensOrDishesOfCase: string;
  };
  contactTracingFormUuid: string;
  contactTracingConceptsUuids: {
    modeOfClienttracingConceptUuid: string;
    reasonNotContactedConceptUuid: string;
    tracingStatusConceptUuid: string;
    remarksConceptUuid: string;
  };
  htsEcounterUuid: string;
  ebolaContactFollowup: {
    encounterRoleUuid: string;
    encounterType: string;
    payloadConcept: string;
    dailyMarkConcept: string;
    markYesConcept: string;
    markNoConcept: string;
  };
  bloodTransfusion: {
    encounterTypeUuid: string;
  };
  admissionNotesFormUuid: string;
  inpatientReviewFormUuid: string;
  mentalHealthScreeningTools: Array<{
    label: string;
    formUuid: string;
  }>;
  psychiatricCategories: {
    question: string;
    voluntary: string;
    involuntary: string;
    emergencyAdmission: string;
    forensicAdmission: string;
  };
}
export interface PendingItemsElementConfig {
  id: string;
  showPendingItems: boolean;
  orders: {
    orderTypes: Array<{
      label?: string;
      uuid: string;
    }>;
  };
}

export interface ObsElementConfig {
  id: string;
  conceptUuid: string;
  onlyWithinCurrentVisit: boolean;
  orderBy: 'ascending' | 'descending';
  limit: number;
  label?: string;
}

export interface IdentifierElementConfig {
  id: string;
  showIdentifierLabel: boolean;
}

export interface PatientAddressElementConfig {
  id: string;
  fields: Array<AddressField>;
}

export interface AdmissionRequestNoteElementConfig {
  id: string;
  conceptUuid: string;
}

export interface WardDefinition {
  id: string;
  appliedTo?: Array<{
    /**
     * locationUuid. If given, only applies to patients at the specified ward locations. (If not provided, applies to all locations)
     */
    location: string;
  }>;
}
export interface ColoredObsTagsElementConfig {
  /**
   * Required. Identifies the concept to use to identify the desired observations.
   */
  conceptUuid: string;

  /**
   * Optional. The custom label or i18n key to the translated label to display for the summary tag. The summary tag
   * shows the count of the number of answers that are present but not configured to show as their own tags. If not
   * provided, defaults to the name of the concept.
   */
  summaryLabel?: string;

  /**
   * The color of the summary tag.
   * See https://react.carbondesignsystem.com/?path=/docs/components-tag--overview for a list of supported colors
   */
  summaryLabelColor?: string;

  /**
   * An array specifying concept sets and color. Observations with coded values that are members of the specified concept sets
   * will be displayed as their own tags with the specified color. Any observation with coded values not belonging to
   * any concept sets specified will be summarized as a count in the summary tag. If a concept set is listed multiple times,
   * the first matching applied-to rule takes precedence.
   */
  tags: Array<ColoredObsTagConfig>;
}

export interface ColoredObsTagConfig {
  /**
   * Color of the tag. See https://react.carbondesignsystem.com/?path=/docs/components-tag--overview for a list of supported colors.
   */
  color: string;

  /**
   * The concept sets which the color applies to. Observations with coded values that are members of the specified concept sets
   * will be displayed as their own tag with the specified color.
   * If an observation's coded value belongs to multiple concept sets, the first matching applied-to rule takes precedence.
   */
  appliedToConceptSets: Array<string>;
}
