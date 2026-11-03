import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

/** This OpenMRS server rejects limit > 100 with HTTP 500. */
const ENCOUNTER_PAGE_SIZE = 50;
const ENCOUNTER_FETCH_CAP = 2000;

type VoidableEncounter = {
  voided?: boolean;
};

/**
 * Page through `/encounter` search. Do not use limit=200 — the REST module
 * throws "Administrator has set absolute limit at 100".
 */
export async function fetchPatientEncountersByType<T extends VoidableEncounter>(
  patientUuid: string,
  encounterTypeUuid: string,
  representation: string,
): Promise<T[]> {
  const all: T[] = [];
  let startIndex = 0;

  while (startIndex < ENCOUNTER_FETCH_CAP) {
    const params = new URLSearchParams({
      patient: patientUuid,
      encounterType: encounterTypeUuid,
      v: representation,
      limit: String(ENCOUNTER_PAGE_SIZE),
      startIndex: String(startIndex),
    });
    const response = await openmrsFetch<{ results?: T[] }>(`${restBaseUrl}/encounter?${params.toString()}`);
    const page = response.data?.results ?? [];
    all.push(...page);
    if (page.length < ENCOUNTER_PAGE_SIZE) {
      break;
    }
    startIndex += ENCOUNTER_PAGE_SIZE;
  }

  return all.filter((encounter) => encounter.voided !== true);
}
