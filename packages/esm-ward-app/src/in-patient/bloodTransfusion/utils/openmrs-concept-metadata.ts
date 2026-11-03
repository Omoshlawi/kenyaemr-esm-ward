import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { toOpenMrsConceptUuid, toOpenMrsObsValue } from './openmrs-concept.utils';

export type OpenMrsConceptMetadata = {
  uuid: string;
  exists: boolean;
  display?: string;
  datatype?: string;
  lowAbsolute?: number | null;
  highAbsolute?: number | null;
  /** False on Numeric concepts that reject decimals (server returns Obs.error.precision). */
  allowDecimal?: boolean | null;
};

export type OpenMrsConceptAnswer = {
  uuid: string;
  display: string;
};

const conceptMetaCache = new Map<string, OpenMrsConceptMetadata>();
const conceptAnswersCache = new Map<string, OpenMrsConceptAnswer[]>();

const YES_UUID = '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NO_UUID = '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const UNKNOWN_UUID = '1067AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NOT_APPLICABLE_UUID = '1175AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function preferredAnswerRefsForUi(uiValue: string, preferredAnswers?: Record<string, string>): string[] {
  if (!preferredAnswers) {
    return [];
  }
  const ref = preferredAnswers[uiValue];
  if (typeof ref !== 'string' || !ref.trim()) {
    return [];
  }
  const candidates: string[] = [];
  const uuid = toOpenMrsConceptUuid(ref) || ref.trim();
  if (uuid) {
    candidates.push(uuid);
  }
  if (ref.trim() !== uuid) {
    candidates.push(ref.trim());
  }
  // GCS Verbal "3" etc. may list a hyphen UUID that is missing — also try bare ODS id comments.
  return candidates;
}

type ConceptRestPayload = {
  uuid: string;
  display?: string;
  datatype?: { name?: string };
  hiAbsolute?: number | null;
  lowAbsolute?: number | null;
  allowDecimal?: boolean | null;
};

function metaFromConceptPayload(uuid: string, data: ConceptRestPayload): OpenMrsConceptMetadata {
  return {
    uuid,
    exists: true,
    display: data.display,
    datatype: data.datatype?.name,
    lowAbsolute: data.lowAbsolute ?? null,
    highAbsolute: data.hiAbsolute ?? null,
    allowDecimal: data.allowDecimal ?? null,
  };
}

/** Drop cached metadata so the next fetch reloads hiAbsolute / lowAbsolute from OpenMRS. */
export function clearOpenMrsConceptMetadataCache(conceptRef?: string): void {
  if (!conceptRef) {
    conceptMetaCache.clear();
    return;
  }
  const uuid = toOpenMrsConceptUuid(conceptRef);
  if (uuid) {
    conceptMetaCache.delete(uuid);
  }
}

export async function fetchOpenMrsConceptMetadata(conceptRef: string): Promise<OpenMrsConceptMetadata> {
  const uuid = toOpenMrsConceptUuid(conceptRef);
  if (!uuid) {
    return { uuid: '', exists: false };
  }

  const cached = conceptMetaCache.get(uuid);
  if (cached) {
    return cached;
  }

  try {
    const response = await openmrsFetch<ConceptRestPayload>(
      `${restBaseUrl}/concept/${uuid}?v=custom:(uuid,display,datatype:(name),hiAbsolute,lowAbsolute,allowDecimal)`,
    );

    if (!response.ok || !response.data?.uuid) {
      const missing: OpenMrsConceptMetadata = { uuid, exists: false };
      conceptMetaCache.set(uuid, missing);
      return missing;
    }

    let meta = metaFromConceptPayload(uuid, response.data);

    // Custom reps sometimes omit numeric bounds — reload with v=full when needed.
    if (meta.datatype === 'Numeric' && meta.highAbsolute == null && meta.lowAbsolute == null) {
      try {
        const full = await openmrsFetch<ConceptRestPayload>(`${restBaseUrl}/concept/${uuid}?v=full`);
        if (full.ok && full.data?.uuid) {
          meta = {
            ...meta,
            lowAbsolute: full.data.lowAbsolute ?? meta.lowAbsolute,
            highAbsolute: full.data.hiAbsolute ?? meta.highAbsolute,
            allowDecimal: full.data.allowDecimal ?? meta.allowDecimal,
          };
        }
      } catch {
        // Keep the custom-rep metadata.
      }
    }

    conceptMetaCache.set(uuid, meta);
    return meta;
  } catch {
    const missing: OpenMrsConceptMetadata = { uuid, exists: false };
    conceptMetaCache.set(uuid, missing);
    return missing;
  }
}

/** Load coded answers for a question concept (cached). */
export async function fetchOpenMrsConceptAnswers(conceptRef: string): Promise<OpenMrsConceptAnswer[]> {
  const uuid = toOpenMrsConceptUuid(conceptRef);
  if (!uuid) {
    return [];
  }
  const cached = conceptAnswersCache.get(uuid);
  if (cached) {
    return cached;
  }

  try {
    const response = await openmrsFetch<{
      answers?: Array<{ uuid?: string; display?: string }>;
    }>(`${restBaseUrl}/concept/${uuid}?v=custom:(uuid,answers:(uuid,display))`);

    const answers = (response.data?.answers ?? [])
      .filter((a): a is { uuid: string; display?: string } => Boolean(a?.uuid))
      .map((a) => ({ uuid: a.uuid, display: a.display?.trim() || a.uuid }));

    conceptAnswersCache.set(uuid, answers);
    return answers;
  } catch {
    conceptAnswersCache.set(uuid, []);
    return [];
  }
}

function normalizeMatchText(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function yesNoUnknownFromUi(value: unknown): string | undefined {
  // Do not treat "1"/"0" as Yes/No — those are GCS / score UI values.
  if (value === true) {
    return YES_UUID;
  }
  if (value === false) {
    return NO_UUID;
  }
  const text = normalizeMatchText(String(value ?? ''));
  if (!text) {
    return undefined;
  }
  if (['yes', 'y', 'true', 'positive', 'present'].includes(text)) {
    return YES_UUID;
  }
  if (['no', 'n', 'false', 'negative', 'absent'].includes(text)) {
    return NO_UUID;
  }
  if (['unknown', 'unk', 'na', 'n/a', 'not applicable', 'unable', 'unable to assess'].includes(text)) {
    return UNKNOWN_UUID;
  }
  return undefined;
}

function matchAnswerByDisplay(answers: OpenMrsConceptAnswer[], uiValue: string): string | undefined {
  const needle = normalizeMatchText(uiValue);
  if (!needle) {
    return undefined;
  }

  const exact = answers.find((a) => normalizeMatchText(a.display) === needle);
  if (exact) {
    return exact.uuid;
  }

  // GCS-style: UI "3" should match "Inappropriate words (3)" / "To Speech (3)"
  const scoreExact = answers.find((a) => {
    const d = normalizeMatchText(a.display);
    return d === needle || d.endsWith(`(${needle})`) || d.startsWith(`${needle} `);
  });
  if (scoreExact) {
    return scoreExact.uuid;
  }

  const partial = answers.find((a) => {
    const d = normalizeMatchText(a.display);
    return d.includes(needle) || needle.includes(d);
  });
  return partial?.uuid;
}

export type CoerceObsOptions = {
  /** UI label → preferred answer concept ref (field-specific, e.g. GCS Verbal only). */
  preferredAnswers?: Record<string, string>;
  /** Extra answer concept refs to try when the preferred map entry is missing on the server. */
  alternateAnswerRefs?: string[];
};

/**
 * Coerce a UI/form value into an OpenMRS obs value for the concept datatype.
 * Resolves coded answers by preferred map, Yes/No, or live answer display match.
 */
export async function coerceObsValueForConcept(
  meta: OpenMrsConceptMetadata,
  rawValue: unknown,
  options?: CoerceObsOptions,
): Promise<{ value: unknown; warning?: string } | { value: null; warning: string }> {
  if (!meta.exists) {
    return { value: null, warning: `${meta.display ?? meta.uuid}: concept not found on OpenMRS.` };
  }

  const datatype = meta.datatype ?? '';

  if (datatype === 'Numeric') {
    const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (Number.isNaN(num)) {
      return { value: null, warning: `${meta.display ?? meta.uuid} must be a number.` };
    }
    if (meta.lowAbsolute != null && num < meta.lowAbsolute) {
      return {
        value: null,
        warning: `${meta.display ?? meta.uuid} must be at least ${meta.lowAbsolute} (entered ${num}).`,
      };
    }
    if (meta.highAbsolute != null && num > meta.highAbsolute) {
      return {
        value: null,
        warning: `${meta.display ?? meta.uuid} must be at most ${meta.highAbsolute} (entered ${num}).`,
      };
    }
    if (meta.allowDecimal === false && !Number.isInteger(num)) {
      return {
        value: null,
        warning: `${meta.display ?? meta.uuid} accepts whole numbers only (entered ${num}).`,
      };
    }
    return { value: num };
  }

  if (datatype === 'Boolean') {
    const asYesNo = yesNoUnknownFromUi(rawValue);
    if (asYesNo === YES_UUID) {
      return { value: true };
    }
    if (asYesNo === NO_UUID) {
      return { value: false };
    }
    if (typeof rawValue === 'boolean') {
      return { value: rawValue };
    }
    return { value: null, warning: `${meta.display ?? meta.uuid} requires yes/no.` };
  }

  if (datatype === 'Text') {
    if (typeof rawValue === 'boolean') {
      return { value: rawValue ? 'Yes' : 'No' };
    }
    const text = String(rawValue ?? '').trim();
    if (!text) {
      return { value: null, warning: `${meta.display ?? meta.uuid} requires text.` };
    }
    return { value: text };
  }

  if (datatype === 'Coded') {
    const uiText = String(rawValue ?? '').trim();

    // 1) Field-specific preferred answer map (RASS / GCS / CAM-ICU / pupils)
    for (const candidate of [
      ...preferredAnswerRefsForUi(uiText, options?.preferredAnswers),
      ...(options?.alternateAnswerRefs ?? []),
    ]) {
      const normalized = toOpenMrsObsValue(candidate);
      const ref = typeof normalized === 'string' ? normalized : String(candidate);
      const answerMeta = await fetchOpenMrsConceptMetadata(ref);
      if (answerMeta.exists) {
        return { value: answerMeta.uuid };
      }
    }

    // 2) Value already looks like a concept UUID / long numeric id
    if (uiText) {
      const asUuid = toOpenMrsConceptUuid(uiText);
      const looksLikeConceptRef = uiText.includes('-') || /A{8,}/i.test(uiText) || /^\d{5,}$/.test(uiText);
      if (asUuid && looksLikeConceptRef) {
        const answerMeta = await fetchOpenMrsConceptMetadata(asUuid);
        if (answerMeta.exists) {
          return { value: asUuid };
        }
      }
    }

    const answers = await fetchOpenMrsConceptAnswers(meta.uuid);

    // 3) Yes / No / Unknown style UI values (seizures, dialysis, dressing, …)
    const yesNo = yesNoUnknownFromUi(rawValue);
    if (yesNo) {
      if (yesNo === YES_UUID) {
        const localYes = matchAnswerByDisplay(answers, 'Yes') ?? matchAnswerByDisplay(answers, 'True');
        const pick = localYes ?? YES_UUID;
        const ok = await fetchOpenMrsConceptMetadata(pick);
        return ok.exists ? { value: pick } : { value: null, warning: `${meta.display}: Yes answer missing.` };
      }
      if (yesNo === NO_UUID) {
        const localNo = matchAnswerByDisplay(answers, 'No') ?? matchAnswerByDisplay(answers, 'False');
        const pick = localNo ?? NO_UUID;
        const ok = await fetchOpenMrsConceptMetadata(pick);
        return ok.exists ? { value: pick } : { value: null, warning: `${meta.display}: No answer missing.` };
      }
      const localNa =
        matchAnswerByDisplay(answers, 'Unknown') ??
        matchAnswerByDisplay(answers, 'N/A') ??
        matchAnswerByDisplay(answers, 'Not applicable') ??
        matchAnswerByDisplay(answers, 'Unable to assess') ??
        matchAnswerByDisplay(answers, 'NA');
      for (const pick of [localNa, UNKNOWN_UUID, NOT_APPLICABLE_UUID]) {
        if (!pick) {
          continue;
        }
        const ok = await fetchOpenMrsConceptMetadata(pick);
        if (ok.exists) {
          return { value: pick };
        }
      }
    }

    // 4) Match live answers by display / score (feed route NPO, GCS "3", …)
    const matched = matchAnswerByDisplay(answers, uiText);
    if (matched) {
      return { value: matched };
    }

    return {
      value: null,
      warning: `${meta.display ?? meta.uuid}: no coded answer matches "${uiText}". Check concept answers on OpenMRS.`,
    };
  }

  if (!datatype || datatype === 'N/A') {
    return {
      value: null,
      warning: `${meta.display ?? meta.uuid}: concept datatype is N/A — fix the dictionary mapping.`,
    };
  }

  return { value: rawValue };
}

export function validateObsValueForConceptMeta(
  meta: OpenMrsConceptMetadata,
  value: unknown,
  fieldLabel?: string,
): string | undefined {
  const label = fieldLabel ?? meta.display ?? meta.uuid;
  if (!meta.exists) {
    return `${label}: not found on OpenMRS — import the ICU dictionary concept.`;
  }

  const datatype = meta.datatype ?? '';

  if (!datatype || datatype === 'N/A') {
    return `${label}: concept datatype is N/A on OpenMRS — fix the dictionary or map to a Numeric lab concept.`;
  }

  if (datatype === 'Numeric') {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) {
      return `${label} must be a number.`;
    }
    if (meta.lowAbsolute != null && num < meta.lowAbsolute) {
      return `${label} must be at least ${meta.lowAbsolute} (entered ${num}).`;
    }
    if (meta.highAbsolute != null && num > meta.highAbsolute) {
      return `${label} must be at most ${meta.highAbsolute} (entered ${num}).`;
    }
    if (meta.allowDecimal === false && !Number.isInteger(num)) {
      return `${label} accepts whole numbers only (entered ${num}).`;
    }
    return undefined;
  }

  if (datatype === 'Coded') {
    const answerRef = typeof value === 'string' ? value.trim() : '';
    if (!answerRef) {
      return `${label} requires a coded answer UUID.`;
    }
    return undefined;
  }

  if (datatype === 'Text') {
    if (value === undefined || value === null || String(value).trim() === '') {
      return `${label} requires text.`;
    }
    return undefined;
  }

  if (datatype === 'Boolean') {
    if (value === undefined || value === null || value === '') {
      return `${label} requires a yes/no value.`;
    }
    return undefined;
  }

  return undefined;
}

export type OpenMrsObsPayloadItem = {
  concept: string;
  value: unknown;
  obsDatetime: string;
  comment?: string;
  /** Field-specific UI → answer concept map for Coded questions. */
  preferredAnswers?: Record<string, string>;
  alternateAnswerRefs?: string[];
};

export async function filterObsForOpenMrs(
  items: OpenMrsObsPayloadItem[],
  conceptLabels: Map<string, string>,
): Promise<{
  valid: OpenMrsObsPayloadItem[];
  warnings: string[];
  skippedCount: number;
}> {
  const normalizedItems = items.map((item) => ({
    ...item,
    concept: toOpenMrsConceptUuid(item.concept) || String(item.concept ?? '').trim(),
    // Keep UI scores ("3") intact — only pad known long numeric concept ids on answer resolution.
    value: item.value,
  }));

  const uniqueConcepts = [...new Set(normalizedItems.map((item) => item.concept).filter(Boolean))];
  const metaByUuid = new Map<string, OpenMrsConceptMetadata>();

  await Promise.all(
    uniqueConcepts.map(async (uuid) => {
      metaByUuid.set(uuid, await fetchOpenMrsConceptMetadata(uuid));
    }),
  );

  const valid: OpenMrsObsPayloadItem[] = [];
  const warnings: string[] = [];
  let skippedCount = 0;

  for (const item of normalizedItems) {
    const conceptUuid = item.concept;
    const meta = metaByUuid.get(conceptUuid) ?? { uuid: conceptUuid, exists: false };
    const fieldLabel = conceptLabels.get(conceptUuid) ?? meta.display ?? conceptUuid;

    const coerced = await coerceObsValueForConcept(meta, item.value, {
      preferredAnswers: item.preferredAnswers,
      alternateAnswerRefs: item.alternateAnswerRefs,
    });
    if (coerced.value === null) {
      skippedCount++;
      warnings.push(coerced.warning || `${fieldLabel}: could not save value.`);
      continue;
    }
    if (coerced.warning) {
      warnings.push(`${fieldLabel}: ${coerced.warning}`);
    }

    // Final existence check for coded answers
    if (meta.datatype === 'Coded' && typeof coerced.value === 'string') {
      const answerMeta = await fetchOpenMrsConceptMetadata(coerced.value);
      if (!answerMeta.exists) {
        skippedCount++;
        warnings.push(`${fieldLabel}: coded answer not on OpenMRS (${coerced.value}). Import the answer concept.`);
        continue;
      }
      valid.push({
        concept: conceptUuid,
        value: answerMeta.uuid,
        obsDatetime: item.obsDatetime,
        comment: item.comment,
      });
      continue;
    }

    valid.push({
      concept: conceptUuid,
      value: coerced.value,
      obsDatetime: item.obsDatetime,
      comment: item.comment,
    });
  }

  return { valid, warnings, skippedCount };
}
