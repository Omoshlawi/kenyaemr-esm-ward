import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWR, { mutate } from 'swr';
import useSWRImmutable from 'swr/immutable';
import { type WardConfigObject } from '../config-schema';

export type BillableServicePrice = {
  uuid: string;
  name: string;
  price: number;
  paymentMode: {
    uuid: string;
    name: string;
  };
};

export type BillableService = {
  uuid: string;
  name: string;
  shortName?: string;
  serviceStatus?: string;
  serviceType?: { display: string };
  concept?: {
    uuid: string;
    display: string;
  };
  servicePrices: Array<BillableServicePrice>;
};

const customRepresentation = `custom:(uuid,name,shortName,serviceStatus,serviceType:(display),concept:(uuid,display),servicePrices:(uuid,name,price,paymentMode:(uuid,name)))`;
const baseServiceUrl = `${restBaseUrl}/cashier/billableService?v=${customRepresentation}`;

export const useBillableServices = (searchTerm: string = '') => {
  const trimmed = searchTerm?.trim() ?? '';
  const url = trimmed ? `${baseServiceUrl}&q=${encodeURIComponent(trimmed)}` : baseServiceUrl;
  const { data, error, isLoading } = useSWR<FetchResponse<{ results: Array<BillableService> }>>(url, openmrsFetch);

  return {
    billableServices: data?.data?.results ?? [],
    isLoading,
    error,
  };
};

export const useBillableServiceByConcept = (conceptUuid?: string) => {
  const url = conceptUuid ? baseServiceUrl : null;
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<{ results: Array<BillableService> }>>(
    url,
    openmrsFetch,
  );

  const billableService = conceptUuid
    ? (data?.data?.results?.find((item) => item?.concept?.uuid === conceptUuid) ?? null)
    : null;

  return {
    billableService,
    isLoading,
    error,
  };
};

export type CreateBillLineItem = {
  billableService: string;
  quantity: number;
  price: number;
  priceUuid: string;
  priceName: string;
  lineItemOrder: number;
  paymentStatus: 'PENDING';
};

export type CreateBillPayload = {
  cashPoint: string;
  cashier: string;
  patient: string;
  visit?: string;
  status: 'PENDING';
  lineItems: Array<CreateBillLineItem>;
  payments: Array<unknown>;
};

export const mutateBills = () =>
  mutate(
    (key) => typeof key === 'string' && key.includes('/cashier/bill') && !key.includes('/cashier/billableService'),
    undefined,
    { revalidate: true },
  );

export const processBillItems = async (payload: CreateBillPayload) => {
  const response = await openmrsFetch(`${restBaseUrl}/cashier/bill`, {
    method: 'POST',
    body: payload,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  await mutateBills();

  return response;
};

/**
 * Format a numeric amount using the configured locale-currency mapping. Falls
 * back to KES which is the ward app's default deployment currency.
 */
export const useCurrencyFormatter = () => {
  const { wardBillingCurrencyLocaleMap } = useConfig<WardConfigObject>();

  const locale = typeof window !== 'undefined' ? (localStorage.getItem('i18nextLng') ?? 'en') : 'en';
  const currency = wardBillingCurrencyLocaleMap?.[locale] ?? 'KES';

  return (amount: number, options: Intl.NumberFormatOptions = {}) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        ...options,
      }).format(amount ?? 0);
    } catch {
      return `${currency} ${(amount ?? 0).toFixed(2)}`;
    }
  };
};
