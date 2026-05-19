import {
  type Encounter,
  type FetchResponse,
  openmrsFetch,
  type OpenmrsResource,
  restBaseUrl,
  showSnackbar,
  useAppContext,
  useConfig,
  useSession,
  type Visit,
} from '@openmrs/esm-framework';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { type WardConfigObject } from '../../config-schema';
import { type WardPatient } from '../../types';

export function removePatientFromBed(bedId: number, patientUuid: string) {
  return openmrsFetch(`${restBaseUrl}/beds/${bedId}?patientUuid=${patientUuid}`, {
    method: 'DELETE',
  });
}

const createDischargeEncounterPayload = (
  patientUuid: string,
  encounterType: OpenmrsResource,
  location: OpenmrsResource,
  currentProvider: OpenmrsResource,
  visitUuid: string,
  clinicianEncounterRole: OpenmrsResource,
) => {
  const encounterPayload = {
    patient: patientUuid,
    encounterType,
    location: location?.uuid,
    encounterProviders: [
      {
        provider: currentProvider?.uuid,
        encounterRole: clinicianEncounterRole?.uuid,
      },
    ],
    obs: [],
    visit: visitUuid,
  };
  return encounterPayload;
};

const createDischargeEncounter = (encounterPayload: any) => {
  return openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    body: encounterPayload,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const usePatientDischarge = () => {
  const { t } = useTranslation();
  const { wardPatientGroupDetails } =
    useAppContext<{ wardPatientGroupDetails: { mutate: () => void } }>('ward-view-context') ?? {};
  const session = useSession();

  const handleDischarge = async (
    encounter: Encounter,
    wardPatient: WardPatient,
    emrConfiguration: Record<string, unknown>,
    visit: Visit,
    wardLocation?: OpenmrsResource,
  ) => {
    try {
      const encounterPayload = createDischargeEncounterPayload(
        wardPatient.patient.uuid,
        emrConfiguration.exitFromInpatientEncounterType as OpenmrsResource,
        wardLocation ?? (session?.sessionLocation as OpenmrsResource),
        session?.currentProvider as OpenmrsResource,
        visit.uuid,
        emrConfiguration.clinicianEncounterRole as OpenmrsResource,
      );

      const dischargeResponse = await createDischargeEncounter(encounterPayload);

      if (!dischargeResponse?.ok) {
        throw new Error('Failed to create discharge encounter');
      }

      if (wardPatient?.bed?.id) {
        const bedRemovalResponse = await removePatientFromBed(wardPatient.bed.id, wardPatient?.patient?.uuid);
        if (!bedRemovalResponse?.ok) {
          throw new Error('Failed to remove patient from bed');
        }
      }

      showSnackbar({
        title: t('patientWasDischarged', 'Patient was discharged'),
        kind: 'success',
      });
    } catch (err) {
      showSnackbar({
        title: t('errorDischargingPatient', 'Error discharging patient'),
        subtitle: err instanceof Error ? err.message : 'Unknown error occurred',
        kind: 'error',
      });
    } finally {
      wardPatientGroupDetails?.mutate();
    }
  };

  return { handleDischarge };
};

export enum PaymentStatus {
  POSTED = 'POSTED',
  PENDING = 'PENDING',
  PAID = 'PAID',
  CREDITED = 'CREDITED',
  CANCELLED = 'CANCELLED',
  ADJUSTED = 'ADJUSTED',
  EXEMPTED = 'EXEMPTED',
}

type Bill = OpenmrsResource & {
  voided: boolean;
  voidReason?: string;
  dateCreated: string;
  patient: OpenmrsResource;
  status: PaymentStatus;
  lineItems: Array<{
    uuid: string;
    paymentStatus: PaymentStatus;
    billableService: string;
    itemOrServiceConceptUuid: string;
    quantity: number;
    dateCreated?: string;
  }>;
};

export const usePatientBills = (patientUuid: string, startingDate?: Date, endDate?: Date) => {
  const rep =
    'custom:(uuid,display,voided,voidReason,dateCreated,status,patient:(uuid,display),' +
    'lineItems:(uuid,paymentStatus,billableService,itemOrServiceConceptUuid,quantity,dateCreated))';

  const { dailyBedFeeBillableService } = useConfig<WardConfigObject>();

  const url = patientUuid ? `${restBaseUrl}/cashier/bill?v=${rep}&patientUuid=${patientUuid}` : null;

  const { data, isLoading, error } = useSWR<FetchResponse<{ results: Array<Bill> }>>(url);

  const bills = useMemo(
    () => (data?.data?.results ?? []).filter((b) => !b.voided && b.patient?.uuid === patientUuid),
    [data, patientUuid],
  );

  const pendingBills = useMemo(
    () => bills.filter((bill) => (bill.lineItems ?? []).some((it) => it.paymentStatus === PaymentStatus.PENDING)),
    [bills],
  );

  const dailyBedFeeSettled = useCallback(
    (daysInWard?: number) => {
      if (!daysInWard || daysInWard <= 0) return true;

      const allBedFeeLineItems = bills.reduce<Bill['lineItems']>((prev, curr) => {
        const matching = (curr.lineItems ?? []).filter(
          (item) => item.itemOrServiceConceptUuid === dailyBedFeeBillableService,
        );
        prev.push(...matching);
        return prev;
      }, []);

      const scopedItems =
        startingDate && endDate
          ? allBedFeeLineItems.filter((item) => {
              if (!item.dateCreated) return true;
              const d = new Date(item.dateCreated).getTime();
              return d >= startingDate.getTime() && d <= endDate.getTime();
            })
          : allBedFeeLineItems;

      const totalQuantity = scopedItems.reduce((prev, curr) => prev + (curr.quantity ?? 0), 0);
      return totalQuantity >= daysInWard;
    },
    [dailyBedFeeBillableService, bills, startingDate, endDate],
  );

  return {
    error,
    isLoading,
    bills,
    pendingBills,
    dailyBedFeeSettled,
  };
};
