export type CdsAlertBroadcastPayload = {
  type: 'lcg-cds-critical';
  sourcePatientUuid: string;
  sourcePatientName: string;
  triggerTimeMs: number;
  expiresAtMs: number;
  activatesAtMs: number;
  summary: string;
  items: Array<{ section: string; code: string; guidance: string }>;
};
