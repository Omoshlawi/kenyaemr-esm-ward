import { useMemo } from 'react';
import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export type ActiveOrder = {
  uuid: string;
  display?: string;
  drug?: {
    uuid?: string;
    display?: string;
  };
  dose?: number;
  doseUnits?: {
    uuid?: string;
    display?: string;
  };
  route?: {
    uuid?: string;
    display?: string;
  };
  frequency?: {
    uuid?: string;
    display?: string;
  };
  quantity?: number;
  quantityUnits?: {
    uuid?: string;
    display?: string;
  };
  duration?: number;
  durationUnits?: {
    uuid?: string;
    display?: string;
  };
  orderer?: {
    uuid?: string;
    display?: string;
    person?: {
      uuid?: string;
      display?: string;
    };
  };
};

export type ActiveOrderResponse = {
  results: Array<ActiveOrder>;
};

export type OrderOption = {
  id: string;
  label: string;
};

const activeOrdersRepresentation =
  'custom:(uuid,display,drug:(uuid,display),dose,doseUnits:(uuid,display),route:(uuid,display),frequency:(uuid,display),quantity,quantityUnits:(uuid,display),duration,durationUnits:(uuid,display),orderer:(uuid,display,person:(uuid,display)))';

export const getOrderLabel = (order: ActiveOrder) => order?.drug?.display?.trim() || order?.display?.trim() || '';

export function useActiveNursingOrders(patientUuid?: string) {
  const activeOrdersUrl = patientUuid
    ? `${restBaseUrl}/order?patient=${patientUuid}&status=ACTIVE&v=${activeOrdersRepresentation}`
    : null;

  const { data, isLoading } = useSWR<FetchResponse<ActiveOrderResponse>>(activeOrdersUrl, openmrsFetch);

  const orders = useMemo(() => data?.data?.results ?? [], [data]);

  const options = useMemo<Array<OrderOption>>(() => {
    const seen = new Set<string>();

    return orders
      .map((order) => {
        const label = getOrderLabel(order);
        return {
          id: order.uuid,
          label,
        };
      })
      .filter((option) => {
        if (!option.label) {
          return false;
        }
        const normalized = option.label.toLowerCase();
        if (seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      });
  }, [orders]);

  const byUuid = useMemo(() => new Map(orders.map((order) => [order.uuid, order])), [orders]);

  const byName = useMemo(
    () =>
      new Map(
        orders.map((order) => [getOrderLabel(order).toLowerCase(), order] as const).filter(([label]) => Boolean(label)),
      ),
    [orders],
  );

  return {
    isLoading,
    options,
    byUuid,
    byName,
  };
}

export function saveNursingCardexEncounter(payload: unknown) {
  return openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
}
