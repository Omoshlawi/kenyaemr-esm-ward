type OpenMrsErrorBody = {
  error?: {
    message?: string;
    translatedMessage?: string;
    code?: string;
    detail?: string;
    globalErrors?: Array<{ message?: string }>;
    fieldErrors?: Record<string, Array<{ message?: string; code?: string }>>;
  };
  message?: string;
};

/** Extract a user-facing message from an openmrsFetch rejection or generic Error. */
export function getOpenMrsErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const record = error as Record<string, unknown>;
  const body = (record.responseBody ?? record.data) as OpenMrsErrorBody | undefined;
  const nested = body?.error;

  const encounterTypeErrors = nested?.fieldErrors?.encounterType ?? [];
  if (
    encounterTypeErrors.some(
      (item) =>
        item.message?.toLowerCase().includes('encounter type') ||
        item.code === 'Encounter.error.encounterType.required',
    )
  ) {
    return (
      'Encounter type UUID was sent but OpenMRS could not resolve it on this server. ' +
      'Create the encounter type under Administration → Encounter Types (or confirm it exists), ' +
      'then paste its UUID into @kenyaemr/esm-ward-app → bloodTransfusion.encounterTypeUuid (Implementer Tools / openmrs.config.json).'
    );
  }

  if (nested?.translatedMessage?.trim()) {
    return nested.translatedMessage.trim();
  }
  if (nested?.message?.trim()) {
    return nested.message.trim();
  }
  const fieldEntries = nested?.fieldErrors
    ? Object.entries(nested.fieldErrors).flatMap(([field, items]) =>
        (items ?? []).map((item) => ({ field, code: item.code, message: item.message })),
      )
    : [];
  if (fieldEntries.some((item) => item.code?.includes('outOfRange') || item.message?.includes('outOfRange'))) {
    return (
      'A numeric value is outside the OpenMRS concept absolute range (hiAbsolute/lowAbsolute). ' +
      'Check vitals (BP, heart rate, RR, SpO₂, MAP, glucose, NIPS/FLACC) and blood gases ' +
      '(pH, pCO₂≤50, pO₂ 50–150, HCO₃ 15–45, base excess, lactate) ' +
      'against Administration → Concepts for each concept UUID in the payload.'
    );
  }
  const fieldMessages = fieldEntries.map((item) => item.message).filter(Boolean);
  if (fieldMessages.length) {
    return fieldMessages.join(' ');
  }
  const globalMessages = nested?.globalErrors?.map((item) => item.message).filter(Boolean) ?? [];
  if (globalMessages.length) {
    return globalMessages.join(' ');
  }
  if (nested?.detail?.trim()) {
    const firstLine = nested.detail.split('\n')[0]?.trim();
    if (firstLine) {
      return firstLine;
    }
  }
  if (body?.message?.trim()) {
    return body.message.trim();
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}
