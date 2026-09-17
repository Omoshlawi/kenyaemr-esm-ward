import { useMemo } from 'react';
import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl, type Order } from '@openmrs/esm-framework';
export const CARDEX_META_PREFIX = '__CARDEX_META__:';
type UuidDisplayResource = {
  uuid?: string;
  display?: string;
};

export type MedicationOrder = Pick<Order, 'uuid'> &
  Partial<Pick<Order, 'display' | 'dose' | 'quantity' | 'duration'>> & {
    dateActivated?: string | null;
    scheduledDate?: string | null;
    dateStopped?: string | null;
    autoExpireDate?: string | null;
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

export type MedicationOrderResponse = {
  results: Array<MedicationOrder>;
};

export type OrderOption = {
  id: string;
  label: string;
};

const inpatientCareSettingUuid = '6f0c9a92-6f24-11e3-af88-005056821db0';
const drugOrderTypeUuid = '131168f4-15f5-102d-96e4-000c29c2a5d7';

export const getOrderLabel = (order: MedicationOrder) => order?.drug?.display?.trim() || order?.display?.trim() || '';

const parseValidDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isActiveMedicationOrder = (order: MedicationOrder) => {
  const now = new Date();
  const autoExpireDate = parseValidDate(order.autoExpireDate);
  const dateStopped = parseValidDate(order.dateStopped);

  if (dateStopped && dateStopped.getTime() <= now.getTime()) {
    return false;
  }

  if (autoExpireDate && autoExpireDate.getTime() < now.getTime()) {
    return false;
  }

  return true;
};

export function useActiveMedicationOrders(patientUuid?: string) {
  const medicationOrdersUrl = patientUuid
    ? `${restBaseUrl}/order?patient=${patientUuid}&careSetting=${inpatientCareSettingUuid}&status=active&orderType=${drugOrderTypeUuid}&v=full`
    : null;

  const { data, isLoading } = useSWR<FetchResponse<MedicationOrderResponse>>(medicationOrdersUrl, openmrsFetch);

  const orders = useMemo(() => (data?.data?.results ?? []).filter(isActiveMedicationOrder), [data]);

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
