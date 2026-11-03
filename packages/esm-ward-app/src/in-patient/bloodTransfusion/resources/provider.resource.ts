import { openmrsFetch, restBaseUrl, type FetchResponse } from '@openmrs/esm-framework';
import useSWR from 'swr';

export type ProviderOption = { uuid: string; display: string };

type ProviderResult = {
  uuid: string;
  display?: string;
  name?: string;
  person?: { display?: string };
};

const PROVIDER_REP = 'custom:(uuid,display,name,person:(display))';

/** Active providers whose name matches the query (min 3 characters). */
export function useProviderSearch(searchQuery: string, minChars = 3, resultLimit = 20) {
  const query = searchQuery.trim();
  const url =
    query.length >= minChars
      ? `${restBaseUrl}/provider?q=${encodeURIComponent(query)}&v=${PROVIDER_REP}&limit=${resultLimit}`
      : null;
  const { data, error, isLoading } = useSWR<FetchResponse<{ results?: ProviderResult[] }>>(url, openmrsFetch);

  const providers: ProviderOption[] = (data?.data?.results ?? []).map((provider) => ({
    uuid: provider.uuid,
    display: provider.person?.display || provider.name || provider.display || provider.uuid,
  }));

  return { providers, isLoading, error };
}
