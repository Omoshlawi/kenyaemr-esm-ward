import { useMemo } from 'react';
import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
export const CARDEX_META_PREFIX = '__CARDEX_META__:';
type UuidDisplayResource = {
  uuid?: string;
  display?: string;
};

export type ActiveOrder = Pick<Order, 'uuid'> &
  Partial<Pick<Order, 'display' | 'dose' | 'quantity' | 'duration'>> & {
    drug?: Order['drug'] | UuidDisplayResource | null;
    doseUnits?: Order['doseUnits'] | UuidDisplayResource | null;
    route?: Order['route'] | UuidDisplayResource | null;
    frequency?: Order['frequency'] | UuidDisplayResource | null;
    quantityUnits?: Order['quantityUnits'] | UuidDisplayResource | null;
    durationUnits?: Order['durationUnits'] | UuidDisplayResource | null;
    orderer?:
      | (Order['orderer'] & {
          person?: Order['orderer']['person'] & { uuid?: string };
        })
      | null;
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
export function toEncounterDatetimeFromTime(time: string): string | null {
  if (!time) {
    return null;
  }

  const [hours, minutes] = time.split(':').map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hoursStr = String(hours).padStart(2, '0');
  const minsStr = String(minutes).padStart(2, '0');
  const secs = '00';

  return `${year}-${month}-${day} ${hoursStr}:${minsStr}:${secs}`;
}

export function saveNursingCardexEncounter(payload: unknown) {
  return openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload as Record<string, unknown>,
  });
}
