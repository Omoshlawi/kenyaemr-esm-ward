import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export type DrugStockStatus = {
  inStock: boolean;
  totalQuantity: number;
  quantityUoM: string;
  drugName: string;
};

type StockInventoryBatch = {
  quantity?: number | string;
  quantityUoM?: string;
  stockItemName?: string;
  drugName?: string;
};

async function fetchStockInventoryBatches(drugUuid: string, locationUuid: string): Promise<StockInventoryBatch[]> {
  const buildParams = (useDispenseLocation: boolean) => {
    const params = new URLSearchParams({
      v: 'default',
      drugUuid,
      includeBatchNo: 'true',
      includeStockItemName: 'true',
      excludeExpired: 'true',
    });

    if (useDispenseLocation) {
      params.set('dispenseLocationUuid', locationUuid);
    } else {
      params.set('locationUuid', locationUuid);
    }

    return params;
  };

  let response = await openmrsFetch(`${restBaseUrl}/stockmanagement/stockiteminventory?${buildParams(false)}`);
  let batches: StockInventoryBatch[] = response.data?.results ?? [];

  if (batches.length === 0) {
    response = await openmrsFetch(`${restBaseUrl}/stockmanagement/stockiteminventory?${buildParams(true)}`);
    batches = response.data?.results ?? [];
  }

  return batches;
}

export async function getDrugStockStatus(drugUuid: string, locationUuid: string): Promise<DrugStockStatus> {
  if (!drugUuid || !locationUuid) {
    return {
      inStock: false,
      totalQuantity: 0,
      quantityUoM: '',
      drugName: '',
    };
  }

  try {
    const stockItemResponse = await openmrsFetch(
      `${restBaseUrl}/stockmanagement/stockitem?drugUuid=${encodeURIComponent(drugUuid)}&limit=1&v=default`,
    );
    const stockItems = stockItemResponse.data?.results ?? [];
    if (stockItems.length === 0) {
      return {
        inStock: false,
        totalQuantity: 0,
        quantityUoM: '',
        drugName: '',
      };
    }
  } catch {
    // Continue with inventory lookup when stock item lookup fails transiently.
  }

  const batches = await fetchStockInventoryBatches(drugUuid, locationUuid);
  const totalQuantity = batches.reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0);
  const firstBatch = batches[0];

  return {
    inStock: totalQuantity > 0,
    totalQuantity,
    quantityUoM: firstBatch?.quantityUoM ?? firstBatch?.stockItemName ?? '',
    drugName: firstBatch?.drugName ?? firstBatch?.stockItemName ?? '',
  };
}

export function getDrugOrderQuantity(quantity: number | '' | undefined): number {
  const parsed = Number(quantity);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getAllocatedQuantityForDrug<T extends { drugUuid: string; quantity: number | '' }>(
  rows: T[],
  drugUuid: string,
): number {
  return rows
    .filter((row) => row.drugUuid === drugUuid)
    .reduce((sum, row) => sum + getDrugOrderQuantity(row.quantity), 0);
}
