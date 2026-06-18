export type LcgStorageSection =
  | 'supportive-care'
  | 'baby'
  | 'woman'
  | 'labour-progress'
  | 'medication'
  | 'shared-decision-making'
  | 'partography';

export type LcgStorageWriteResult = {
  success: boolean;
  error?: string;
};

const LCG_SECTION_STORAGE_PREFIX = 'lcg_section_';
const PARTOGRAPHY_STORAGE_PREFIX = 'partography_';
const MAX_SECTION_ENTRIES = 50;
const MAX_PARTOGRAPHY_ENTRIES = 100;
const MAX_SERIALIZED_ENTRY_BYTES = 48_000;
const MAX_SERIALIZED_BLOB_BYTES = 512_000;

const writeQueues = new Map<string, Promise<LcgStorageWriteResult>>();

const isQuotaExceededError = (error: unknown) =>
  error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

export function getLcgSectionStorageKey(patientUuid: string, section: LcgStorageSection): string {
  if (section === 'partography') {
    throw new Error('Use getPartographyStorageKey for partography graph types');
  }
  return `${LCG_SECTION_STORAGE_PREFIX}${patientUuid}_${section}`;
}

export function getPartographyStorageKey(patientUuid: string, graphType: string): string {
  return `${PARTOGRAPHY_STORAGE_PREFIX}${patientUuid}_${graphType}`;
}

export function readJsonArray<T>(storageKey: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    console.warn('[LCG storage] Failed to read entries; resetting key.', storageKey, error);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore cleanup failures in restricted browser contexts.
    }
    return [];
  }
}

export function readLcgSectionEntries<T>(patientUuid: string, section: Exclude<LcgStorageSection, 'partography'>): T[] {
  return readJsonArray<T>(getLcgSectionStorageKey(patientUuid, section));
}

function serializeEntries<T>(entries: T[], maxEntries: number): string {
  const trimmedEntries = entries.slice(-maxEntries);
  const serialized = JSON.stringify(trimmedEntries);

  if (serialized.length > MAX_SERIALIZED_BLOB_BYTES) {
    throw new Error('Local storage payload exceeds safe size limits');
  }

  return serialized;
}

function writeJsonArraySync<T>(storageKey: string, entries: T[], maxEntries: number): LcgStorageWriteResult {
  try {
    const serialized = serializeEntries(entries, maxEntries);
    window.localStorage.setItem(storageKey, serialized);
    return { success: true };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      try {
        const reduced = entries.slice(-Math.max(1, Math.floor(maxEntries / 2)));
        const serialized = serializeEntries(reduced, maxEntries);
        window.localStorage.setItem(storageKey, serialized);
        return { success: true };
      } catch (retryError) {
        console.warn('[LCG storage] Quota retry failed.', storageKey, retryError);
        return {
          success: false,
          error: retryError instanceof Error ? retryError.message : 'Local storage quota exceeded',
        };
      }
    }

    console.warn('[LCG storage] Write failed.', storageKey, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to write local storage entry',
    };
  }
}

function enqueueStorageWrite(
  storageKey: string,
  writeOperation: () => LcgStorageWriteResult,
): Promise<LcgStorageWriteResult> {
  const prior = writeQueues.get(storageKey) ?? Promise.resolve({ success: true });
  const next = prior
    .catch(() => ({ success: true }))
    .then(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
      return writeOperation();
    })
    .finally(() => {
      if (writeQueues.get(storageKey) === next) {
        writeQueues.delete(storageKey);
      }
    });

  writeQueues.set(storageKey, next);
  return next;
}

export function replaceLcgSectionEntries<T>(
  patientUuid: string,
  section: Exclude<LcgStorageSection, 'partography'>,
  entries: T[],
): Promise<LcgStorageWriteResult> {
  const storageKey = getLcgSectionStorageKey(patientUuid, section);
  return enqueueStorageWrite(storageKey, () => writeJsonArraySync(storageKey, entries, MAX_SECTION_ENTRIES));
}

export function appendLcgSectionEntry<T>(
  patientUuid: string,
  section: Exclude<LcgStorageSection, 'partography'>,
  entry: T,
): Promise<LcgStorageWriteResult> {
  const storageKey = getLcgSectionStorageKey(patientUuid, section);

  return enqueueStorageWrite(storageKey, () => {
    try {
      const entrySerialized = JSON.stringify(entry);
      if (entrySerialized.length > MAX_SERIALIZED_ENTRY_BYTES) {
        return { success: false, error: 'Entry exceeds safe local storage size' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Entry is not serializable',
      };
    }

    const existingEntries = readJsonArray<T>(storageKey);
    return writeJsonArraySync(storageKey, [...existingEntries, entry], MAX_SECTION_ENTRIES);
  });
}

export type PartographyLocalEntry = {
  id: string;
  timestamp: string;
  graphType: string;
  data: unknown;
  encounterUuid?: string;
};

export function readPartographyEntries(patientUuid: string, graphType: string): PartographyLocalEntry[] {
  return readJsonArray<PartographyLocalEntry>(getPartographyStorageKey(patientUuid, graphType));
}

export function appendPartographyEntry(
  patientUuid: string,
  graphType: string,
  formData: unknown,
  encounterUuid?: string,
): Promise<LcgStorageWriteResult> {
  const storageKey = getPartographyStorageKey(patientUuid, graphType);

  return enqueueStorageWrite(storageKey, () => {
    const entry: PartographyLocalEntry = {
      id: encounterUuid || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: new Date().toISOString(),
      graphType,
      data: formData,
      encounterUuid,
    };

    try {
      const entrySerialized = JSON.stringify(entry);
      if (entrySerialized.length > MAX_SERIALIZED_ENTRY_BYTES) {
        return { success: false, error: 'Partography entry exceeds safe local storage size' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Partography entry is not serializable',
      };
    }

    const existingEntries = readPartographyEntries(patientUuid, graphType);
    return writeJsonArraySync(storageKey, [...existingEntries, entry], MAX_PARTOGRAPHY_ENTRIES);
  });
}
