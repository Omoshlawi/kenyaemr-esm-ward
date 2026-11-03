import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { getOpenMrsErrorMessage } from '../utils/openmrs-error.utils';

type RestEncounterType = {
  uuid?: string;
  display?: string;
  name?: string;
};

export type ResolveEncounterTypeResult = {
  uuid: string;
  display?: string;
  source: 'configured' | 'name-match' | 'created';
};

async function fetchEncounterTypeByUuid(uuid: string): Promise<RestEncounterType | null> {
  const trimmed = uuid.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const response = await openmrsFetch<RestEncounterType>(
      `${restBaseUrl}/encountertype/${encodeURIComponent(trimmed)}?v=custom:(uuid,display,name)`,
    );
    if (response.ok && response.data?.uuid) {
      return response.data;
    }
  } catch {
    // Missing or unauthorized.
  }
  return null;
}

async function fetchEncounterTypeByName(name: string): Promise<RestEncounterType | null> {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const response = await openmrsFetch<{ results?: RestEncounterType[] }>(
      `${restBaseUrl}/encountertype?q=${encodeURIComponent(trimmed)}&v=custom:(uuid,display,name)&limit=20`,
    );
    const results = response.data?.results ?? [];
    const exact =
      results.find((item) => (item.name ?? item.display ?? '').trim().toLowerCase() === trimmed.toLowerCase()) ??
      results.find((item) => (item.display ?? '').trim().toLowerCase() === trimmed.toLowerCase());
    return exact?.uuid ? exact : null;
  } catch {
    return null;
  }
}

/** Resolve by configured UUID, then by exact name. Does not create. */
export async function resolveEncounterTypeByUuidOrName(
  configuredUuid: string,
  name: string,
): Promise<ResolveEncounterTypeResult | null> {
  const configured = configuredUuid.trim();
  if (!configured) {
    return null;
  }

  const byUuid = await fetchEncounterTypeByUuid(configured);
  if (byUuid?.uuid) {
    return {
      uuid: byUuid.uuid,
      display: byUuid.display ?? byUuid.name,
      source: 'configured',
    };
  }

  const byName = await fetchEncounterTypeByName(name);
  if (byName?.uuid) {
    return {
      uuid: byName.uuid,
      display: byName.display ?? byName.name,
      source: 'name-match',
    };
  }

  return null;
}

/**
 * Resolve encounter type for this server, creating it when missing.
 * Requires Manage Encounter Types privilege to create.
 */
export async function resolveOrCreateEncounterType(input: {
  configuredUuid: string;
  name: string;
  description: string;
  configKeyHint?: string;
}): Promise<ResolveEncounterTypeResult> {
  const configured = input.configuredUuid.trim();
  if (!configured) {
    throw new Error(
      input.configKeyHint
        ? `${input.configKeyHint} is empty in ward app config.`
        : 'Encounter type UUID is empty in ward app config.',
    );
  }

  const resolved = await resolveEncounterTypeByUuidOrName(configured, input.name);
  if (resolved) {
    return resolved;
  }

  try {
    const response = await openmrsFetch<RestEncounterType>(`${restBaseUrl}/encountertype`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uuid: configured,
        name: input.name,
        description: input.description,
      }),
    });
    if (response.ok && response.data?.uuid) {
      return {
        uuid: response.data.uuid,
        display: response.data.display ?? response.data.name ?? input.name,
        source: 'created',
      };
    }
    throw new Error(getOpenMrsErrorMessage(response, `Failed to create encounter type "${input.name}"`));
  } catch (error) {
    throw new Error(
      getOpenMrsErrorMessage(
        error,
        `Encounter type ${configured} is missing and could not be created. Create "${input.name}" in Administration → Encounter Types.`,
      ),
    );
  }
}
