export type TransfusionStatus = 'draft' | 'submitted';

export type TransfusionRateUnit = 'mlPerMin' | 'dropsPerMin';

export type TransfusionObservation = {
  time?: string;
  temperature?: number;
  pulse?: number;
  respiratoryRate?: number;
  systolic?: number;
  diastolic?: number;
  remarks?: string;
};

export type BloodTransfusion = {
  id: string;
  number: string;
  status: TransfusionStatus;
  patientName?: string;
  ipNumber?: string;
  /** Ward / location display name when known. */
  ward?: string;
  sex?: string;
  age?: string;
  diagnosis?: string;
  transfusionDate?: string;
  transfusionTime?: string;
  /** Holds a single type; kept as a list for records saved when several could be ticked. */
  bloodTypes: string[];
  otherType?: string;
  donorNumber?: string;
  startedBy?: string;
  counterCheckedBy?: string;
  counterCheckedByUuid?: string;
  timeStarted?: string;
  rate?: number;
  rateUnit?: TransfusionRateUnit;
  observations: Record<string, TransfusionObservation>;
  endedDate?: string;
  endedTime?: string;
  amountMl?: number;
  reactions: string[];
  createdAt: string;
  updatedAt: string;
  recordedBy?: string;
  submittedAt?: string;
  submittedBy?: string;
  /** OpenMRS encounter holding this transfusion, once anything has been sent. */
  encounterUuid?: string;
  /** Row id → signature of the reading last saved to OpenMRS. */
  syncedRows?: Record<string, string>;
};

export type TransfusionRowSyncStatus = 'saving' | 'saved' | 'error';

/** What an OpenMRS transfusion encounter holds. */
export type BackendTransfusion = {
  encounterUuid: string;
  encounterDatetime: string;
  transfusionDate?: string;
  timeStarted?: string;
  diagnosis?: string;
  reactions: string[];
  bloodTypes: string[];
  donorNumber?: string;
  counterCheckedBy?: string;
  rate?: number;
  endedTime?: string;
  amountMl?: number;
  observations: Record<string, TransfusionObservation>;
};

export type BloodTransfusionStore = {
  transfusions: BloodTransfusion[];
};

export type TransfusionRequiredField =
  | 'transfusionDate'
  | 'transfusionTime'
  | 'bloodTypes'
  | 'otherType'
  | 'donorNumber'
  | 'startedBy'
  | 'counterCheckedBy'
  | 'timeStarted'
  | 'baselineTemperature'
  | 'baselinePulse'
  | 'endedDate'
  | 'endedTime'
  | 'amountMl';
