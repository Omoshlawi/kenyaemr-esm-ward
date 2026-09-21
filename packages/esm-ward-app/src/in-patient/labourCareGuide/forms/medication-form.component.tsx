import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation, type TFunction } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import {
  Modal,
  Grid,
  Column,
  NumberInput,
  Select,
  SelectItem,
  TextInput,
  InlineNotification,
  Button,
  InlineLoading,
} from '@carbon/react';
import { TrashCan, Add } from '@carbon/react/icons';
import { useDebounce, openmrsFetch, restBaseUrl, useSession } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { MedicationTimePickerDropdown } from './form-scoped-time-pickers.component';
import styles from '../partography-data-form.scss';
import { useLcgFormClock } from '../hooks/use-lcg-form-clock';
import {
  formatHHMM,
  getAllowedEmergencyTimes,
  getAllowedPointTimesForSlots,
  getPointSlotState,
  getSlotState,
  getStageAwarePointSlotIndexForTime,
} from '../time-slot-utils';
import {
  LCG_MEDICATION_OXYTOCIN_INTERVAL_MINUTES,
  LCG_TIME_INCREMENT_MINUTES,
  MEDICATION_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  MEDICATION_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
} from '../types';
import { saveMedicationData, type MedicationDrugLine } from '../resources/medication.resource';
import {
  getAllocatedQuantityForDrug,
  getDrugOrderQuantity,
  getDrugStockStatus,
} from '../resources/drug-stock.resource';

export type DrugStockState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'in-stock'; totalQty: number; quantityUoM: string; drugName: string }
  | { status: 'out-of-stock'; drugName: string }
  | { status: 'error'; message: string };

export type DrugItem = {
  drugUuid: string;
  drugName: string;
  dosage: string;
  route: string;
  quantity: number | '';
  stock: DrugStockState;
};

const createEmptyDrugItem = (): DrugItem => ({
  drugUuid: '',
  drugName: '',
  dosage: '',
  route: '',
  quantity: '',
  stock: { status: 'idle' },
});

export type MedicationFormData = {
  time: string;
  oxytocinUsed: string;
  oxytocinUnitsPerLitre: number | '';
  oxytocinDropsPerMinute: number | '';
  medicine: string;
  drug: string;
  dosage: string;
  route: string;
  drugLines?: MedicationDrugLine[];
  ivFluids: string;
  ivFluidType: string;
};

const IV_FLUID_TYPE_OPTIONS = [
  { value: '80804AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', labelKey: 'normalSaline', defaultLabel: 'Normal saline' },
  { value: '78617AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', labelKey: 'ringersLactate', defaultLabel: "Ringer's lactate" },
  { value: '1175AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', labelKey: 'ivFluidNotAvailable', defaultLabel: 'Not Available' },
] as const;

const MEDICATION_HALF_SLOT_OPTIONS = [
  {
    slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
    offsetMinutes: 0,
    earlyAllowanceMinutes: MEDICATION_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
    lateAllowanceMinutes: MEDICATION_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
  },
  {
    slotIntervalMinutes: LCG_TIME_INCREMENT_MINUTES,
    offsetMinutes: LCG_MEDICATION_OXYTOCIN_INTERVAL_MINUTES,
    earlyAllowanceMinutes: MEDICATION_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
    lateAllowanceMinutes: MEDICATION_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
  },
] as const;

const DRUG_SEARCH_TIMEOUT_MS = 10_000;
const DRUG_SEARCH_LIMIT = 10;
const DRUG_SEARCH_MIN_QUERY_LENGTH = 3;

const fetchDrugsWithTimeout = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), DRUG_SEARCH_TIMEOUT_MS);

  try {
    const response = await openmrsFetch(url, { signal: controller.signal });
    return response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const DrugSearchRow: React.FC<{
  drug: DrugItem;
  index: number;
  allDrugs: DrugItem[];
  encounterLocationUuid?: string;
  onChange: (d: DrugItem) => void;
  onDrugSelected: (index: number, drugUuid: string, drugName: string) => void;
  onRemove: () => void;
  disabled: boolean;
  t: TFunction;
}> = ({ drug, index, allDrugs, encounterLocationUuid, onChange, onDrugSelected, onRemove, disabled, t }) => {
  const [query, setQuery] = useState(drug.drugName);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 400);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trimmedQuery = debouncedQuery.trim();
  const shouldFetch = trimmedQuery.length >= DRUG_SEARCH_MIN_QUERY_LENGTH && !drug.drugName;
  const showDoseRoute = drug.stock.status === 'in-stock';
  const orderQuantity = getDrugOrderQuantity(drug.quantity);
  const allocatedOnForm =
    drug.stock.status === 'in-stock' && drug.drugUuid ? getAllocatedQuantityForDrug(allDrugs, drug.drugUuid) : 0;
  const remainingQty = drug.stock.status === 'in-stock' ? Math.max(0, drug.stock.totalQty - allocatedOnForm) : 0;
  const sufficientStock =
    drug.stock.status !== 'in-stock' || orderQuantity === 0 || allocatedOnForm <= drug.stock.totalQty;
  const { data, isLoading, error } = useSWR(
    shouldFetch
      ? `${restBaseUrl}/drug?q=${encodeURIComponent(trimmedQuery)}&v=default&limit=${DRUG_SEARCH_LIMIT}`
      : null,
    fetchDrugsWithTimeout,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      errorRetryCount: 1,
      dedupingInterval: 5_000,
      keepPreviousData: true,
    },
  );
  const suggestions: any[] = data?.results ?? [];
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setQuery(drug.drugName);
  }, [drug.drugName]);

  return (
    <div className={styles.drugSearchRow}>
      <div className={styles.drugSearchFields}>
        <div className={styles.drugSearchInputWrapper} ref={wrapperRef}>
          <TextInput
            id={`drug-search-${index}`}
            labelText={index === 0 ? t('drugName', 'Drug name') : ''}
            value={query}
            disabled={disabled}
            placeholder={t('drugSearchPlaceholder', 'Type 3+ letters to search...')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const val = e.target.value;
              setQuery(val);
              setOpen(true);
              if (drug.drugName) {
                onChange(createEmptyDrugItem());
              }
            }}
            onFocus={() => {
              if (drug.drugName || query.length >= 3) setOpen(true);
            }}
          />
          {isLoading && <p className={styles.drugSearchLoading}>{t('searching', 'Searching...')}</p>}
          {error && !isLoading ? (
            <p className={styles.drugSearchLoading}>{t('drugSearchFailed', 'Drug search timed out. Try again.')}</p>
          ) : null}
          {open && suggestions.length > 0 && (
            <ul className={styles.drugSuggestions}>
              {suggestions.map((s: any) => (
                <li
                  key={s.uuid}
                  onMouseDown={() => {
                    const name = s.name ?? s.display;
                    const strength = s.strength ?? '';
                    onChange({
                      ...createEmptyDrugItem(),
                      drugUuid: s.uuid,
                      drugName: name,
                      dosage: strength,
                      stock: { status: 'checking' },
                    });
                    setQuery(name);
                    setOpen(false);
                    onDrugSelected(index, s.uuid, name);
                  }}>
                  <strong>{s.name ?? s.display}</strong>
                  {s.strength ? ` — ${s.strength}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>

        {showDoseRoute ? (
          <>
            <TextInput
              id={`drug-dosage-${index}`}
              labelText={index === 0 ? t('dose', 'Dosage') : ''}
              value={drug.dosage}
              disabled={disabled}
              placeholder="e.g. 500mg"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...drug, dosage: e.target.value })}
            />

            <Select
              id={`drug-route-${index}`}
              labelText={index === 0 ? t('route', 'Route') : ''}
              value={drug.route}
              disabled={disabled}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...drug, route: e.target.value })}>
              <SelectItem value="" text={t('select', 'Select...')} />
              <SelectItem value="Oral" text="Oral" />
              <SelectItem value="IV" text="IV" />
              <SelectItem value="IM" text="IM" />
              <SelectItem value="SC" text="SC" />
            </Select>

            <NumberInput
              id={`drug-quantity-${index}`}
              label={index === 0 ? t('quantity', 'Quantity') : ''}
              value={drug.quantity}
              disabled={disabled}
              min={1}
              allowEmpty
              onChange={(_event, { value }) => {
                const nextValue = String(value ?? '');
                onChange({ ...drug, quantity: nextValue === '' ? '' : Number(nextValue) });
              }}
            />
          </>
        ) : (
          <>
            <div />
            <div />
            <div />
          </>
        )}

        {index > 0 ? (
          <Button
            kind="danger--ghost"
            size="sm"
            renderIcon={TrashCan}
            iconDescription={t('removeDrug', 'Remove drug')}
            hasIconOnly
            onClick={onRemove}
            disabled={disabled}
          />
        ) : (
          <div />
        )}
      </div>

      {!encounterLocationUuid && drug.drugUuid ? (
        <p className={styles.drugStockError}>
          {t('stockLocationMissing', 'Session location is required to check stock.')}
        </p>
      ) : null}

      {drug.stock.status === 'checking' ? (
        <InlineLoading className={styles.drugStockChecking} description={t('checkingStock', 'Checking stock...')} />
      ) : null}

      {drug.stock.status === 'out-of-stock' ? (
        <p className={styles.drugStockOutOfStock}>{t('outOfStock', 'Out of stock')}</p>
      ) : null}

      {drug.stock.status === 'error' ? <p className={styles.drugStockError}>{drug.stock.message}</p> : null}

      {drug.stock.status === 'in-stock' ? (
        <>
          <p className={styles.drugStockInStock}>
            {t('inStockAvailable', 'In stock: {{totalQty}} {{quantityUoM}}', {
              totalQty: drug.stock.totalQty,
              quantityUoM: drug.stock.quantityUoM,
            })}
          </p>
          {orderQuantity > 0 ? (
            <p className={styles.drugStockPreview}>
              {t('availableAfterOrder', 'Available after this order:')}{' '}
              <strong>
                {remainingQty} {drug.stock.quantityUoM}
              </strong>
            </p>
          ) : null}
          {!sufficientStock && orderQuantity > 0 ? (
            <p className={styles.drugStockInsufficient}>
              {t('insufficientStock', 'Insufficient stock. Requested {{requested}}, only {{available}} available.', {
                requested: allocatedOnForm,
                available: drug.stock.totalQty,
              })}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

const MemoizedDrugSearchRow = React.memo(DrugSearchRow);

export type MedicationFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MedicationFormData) => void;
  onDataSaved?: () => void;
  existingTimeEntries?: Array<{ hour: number; time: string }>;
  baseTime?: string;
  slotCount?: number;
  firstStageSlotCount?: number;
  secondStageSlotCount?: number;
  secondStageStartTime?: string;
  patient?: {
    uuid: string;
    name: string;
  };
  isEmergencyMode?: boolean;
  emergencyReason?: string;
};

const toFiniteNumber = (value: number | '' | null | undefined) => {
  if (value === '' || value === null || value === undefined) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const MedicationForm: React.FC<MedicationFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDataSaved,
  existingTimeEntries = [],
  baseTime,
  slotCount = 0,
  firstStageSlotCount = 0,
  secondStageSlotCount = 0,
  secondStageStartTime,
  patient,
  isEmergencyMode = false,
  emergencyReason,
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const encounterLocationUuid = session?.sessionLocation?.uuid;
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const now = useLcgFormClock(isOpen);
  const [drugs, setDrugs] = useState<DrugItem[]>([createEmptyDrugItem()]);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MedicationFormData>({
    defaultValues: {
      time: '',
      oxytocinUsed: '',
      oxytocinUnitsPerLitre: '',
      oxytocinDropsPerMinute: '',
      medicine: '',
      drug: '',
      dosage: '',
      route: '',
      ivFluids: '',
      ivFluidType: '',
    },
  });

  const watchOxytocinUsed = watch('oxytocinUsed');
  const watchMedicine = watch('medicine');
  const watchIvFluids = watch('ivFluids');
  const selectedTime = watch('time');
  const nowHHMM = useMemo(
    () => `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    [now],
  );

  const resolveCurrentMedicationSlotIndex = useMemo(() => {
    if (!baseTime || slotCount === 0) {
      return null;
    }

    return (
      getStageAwarePointSlotIndexForTime(
        baseTime,
        nowHHMM,
        firstStageSlotCount,
        secondStageSlotCount,
        secondStageStartTime,
        MEDICATION_HALF_SLOT_OPTIONS[0],
      ) ??
      getStageAwarePointSlotIndexForTime(
        baseTime,
        nowHHMM,
        firstStageSlotCount,
        secondStageSlotCount,
        secondStageStartTime,
        MEDICATION_HALF_SLOT_OPTIONS[1],
      )
    );
  }, [baseTime, firstStageSlotCount, nowHHMM, secondStageSlotCount, secondStageStartTime, slotCount]);

  const handleTimeChange = React.useCallback(
    (nextTime: string) => {
      setValue('time', nextTime, { shouldDirty: true, shouldValidate: false });
    },
    [setValue],
  );

  useEffect(() => {
    if (isOpen) {
      reset({
        time: '',
        oxytocinUsed: '',
        oxytocinUnitsPerLitre: '',
        oxytocinDropsPerMinute: '',
        medicine: '',
        drug: '',
        dosage: '',
        route: '',
        ivFluids: '',
        ivFluidType: '',
      });
      setDrugs([createEmptyDrugItem()]);
      clearErrors();
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [isOpen, reset, clearErrors]);

  useEffect(() => {
    if (watchOxytocinUsed !== 'yes') {
      setValue('oxytocinUnitsPerLitre', '');
      setValue('oxytocinDropsPerMinute', '');
    }
  }, [watchOxytocinUsed, setValue]);

  useEffect(() => {
    if (watchMedicine !== 'yes') {
      setDrugs([createEmptyDrugItem()]);
      setValue('drug', '');
      setValue('dosage', '');
      setValue('route', '');
    }
  }, [watchMedicine, setValue]);

  const handleDrugSelected = React.useCallback(
    async (index: number, drugUuid: string, drugName: string) => {
      if (!encounterLocationUuid) {
        setDrugs((previous) => {
          const next = [...previous];
          next[index] = {
            ...next[index],
            stock: {
              status: 'error',
              message: t('stockLocationMissing', 'Session location is required to check stock.'),
            },
          };
          return next;
        });
        return;
      }

      try {
        const stock = await getDrugStockStatus(drugUuid, encounterLocationUuid);
        setDrugs((previous) => {
          const next = [...previous];
          const current = next[index];
          if (!current || current.drugUuid !== drugUuid) {
            return previous;
          }

          if (stock.inStock) {
            next[index] = {
              ...current,
              stock: {
                status: 'in-stock',
                totalQty: stock.totalQuantity,
                quantityUoM: stock.quantityUoM,
                drugName: stock.drugName || drugName,
              },
            };
            return next;
          }

          next[index] = {
            ...current,
            dosage: '',
            route: '',
            quantity: '',
            stock: { status: 'out-of-stock', drugName },
          };
          return next;
        });
      } catch (error) {
        setDrugs((previous) => {
          const next = [...previous];
          const current = next[index];
          if (!current || current.drugUuid !== drugUuid) {
            return previous;
          }

          next[index] = {
            ...current,
            stock: {
              status: 'error',
              message: (error as Error).message || t('stockCheckFailed', 'Failed to check stock'),
            },
          };
          return next;
        });
      }
    },
    [encounterLocationUuid, t],
  );

  const medicineStockBlocksSave = useMemo(() => {
    if (watchMedicine !== 'yes') {
      return false;
    }

    return drugs.some((drug) => {
      if (!drug.drugUuid) {
        return false;
      }

      if (drug.stock.status === 'checking') {
        return true;
      }

      if (drug.stock.status === 'out-of-stock' || drug.stock.status === 'error') {
        return true;
      }

      if (drug.stock.status === 'in-stock') {
        const allocated = getAllocatedQuantityForDrug(drugs, drug.drugUuid);
        return allocated > drug.stock.totalQty;
      }

      return false;
    });
  }, [drugs, watchMedicine]);

  useEffect(() => {
    if (watchIvFluids !== 'yes') {
      setValue('ivFluidType', '', { shouldDirty: false, shouldValidate: false });
    }
  }, [setValue, watchIvFluids]);

  const isBaseLocked = !isEmergencyMode && (!baseTime || slotCount === 0);

  const availableSlotIndices = useMemo(() => {
    if (!isOpen || !baseTime || slotCount === 0 || resolveCurrentMedicationSlotIndex === null) {
      return [];
    }

    if (
      secondStageStartTime &&
      secondStageSlotCount > 0 &&
      firstStageSlotCount > 0 &&
      resolveCurrentMedicationSlotIndex >= firstStageSlotCount
    ) {
      const relativeSecondStageIndex = resolveCurrentMedicationSlotIndex - firstStageSlotCount;
      return getSlotState(secondStageStartTime, relativeSecondStageIndex, now) === 'active'
        ? [relativeSecondStageIndex]
        : [];
    }

    const activeIndices = MEDICATION_HALF_SLOT_OPTIONS.flatMap((option) => {
      const slotIndex = getStageAwarePointSlotIndexForTime(
        baseTime,
        nowHHMM,
        firstStageSlotCount,
        secondStageSlotCount,
        secondStageStartTime,
        option,
      );

      if (slotIndex === null || getPointSlotState(baseTime, slotIndex, now, option) !== 'active') {
        return [];
      }

      return [slotIndex];
    });

    return Array.from(new Set(activeIndices));
  }, [
    baseTime,
    firstStageSlotCount,
    isOpen,
    now,
    nowHHMM,
    resolveCurrentMedicationSlotIndex,
    secondStageSlotCount,
    secondStageStartTime,
    slotCount,
  ]);

  const oxytocinAvailableSlotIndices = useMemo(() => {
    if (availableSlotIndices.length === 0) {
      return [];
    }

    const slotsPerInterval = Math.max(
      1,
      Math.round(LCG_MEDICATION_OXYTOCIN_INTERVAL_MINUTES / LCG_TIME_INCREMENT_MINUTES),
    );
    return availableSlotIndices.filter((idx) => idx % slotsPerInterval === 0);
  }, [availableSlotIndices]);

  const buildMedicationAllowedTimes = React.useCallback(
    (targetIndices: number[]) => {
      if (targetIndices.length === 0 || !baseTime) {
        return [];
      }

      return Array.from(
        new Set([
          ...getAllowedPointTimesForSlots(baseTime, targetIndices, MEDICATION_HALF_SLOT_OPTIONS[0], now),
          ...getAllowedPointTimesForSlots(baseTime, targetIndices, MEDICATION_HALF_SLOT_OPTIONS[1], now),
        ]),
      ).sort();
    },
    [baseTime, now],
  );

  const oxytocinSlotAllowedTimes = useMemo(() => {
    if (!isOpen || isBaseLocked || isEmergencyMode) {
      return [];
    }

    const targetIndices =
      oxytocinAvailableSlotIndices.length > 0
        ? oxytocinAvailableSlotIndices
        : resolveCurrentMedicationSlotIndex !== null &&
            resolveCurrentMedicationSlotIndex %
              Math.max(1, Math.round(LCG_MEDICATION_OXYTOCIN_INTERVAL_MINUTES / LCG_TIME_INCREMENT_MINUTES)) ===
              0
          ? [resolveCurrentMedicationSlotIndex]
          : [];

    return buildMedicationAllowedTimes(targetIndices);
  }, [
    buildMedicationAllowedTimes,
    isBaseLocked,
    isEmergencyMode,
    isOpen,
    oxytocinAvailableSlotIndices,
    resolveCurrentMedicationSlotIndex,
  ]);

  const slotAllowedTimes = useMemo(() => {
    if (!isOpen || isBaseLocked) return [];
    if (isEmergencyMode) {
      return getAllowedEmergencyTimes(now);
    }

    if (
      secondStageStartTime &&
      secondStageSlotCount > 0 &&
      firstStageSlotCount > 0 &&
      resolveCurrentMedicationSlotIndex !== null &&
      resolveCurrentMedicationSlotIndex >= firstStageSlotCount
    ) {
      const relativeSecondStageIndex = resolveCurrentMedicationSlotIndex - firstStageSlotCount;
      if (getSlotState(secondStageStartTime, relativeSecondStageIndex, now) !== 'active') {
        return [];
      }

      return Array.from(
        new Set([
          ...getAllowedPointTimesForSlots(
            secondStageStartTime,
            [relativeSecondStageIndex],
            MEDICATION_HALF_SLOT_OPTIONS[0],
            now,
          ),
          ...getAllowedPointTimesForSlots(
            secondStageStartTime,
            [relativeSecondStageIndex],
            MEDICATION_HALF_SLOT_OPTIONS[1],
            now,
          ),
        ]),
      ).sort();
    }

    const targetIndices =
      watchOxytocinUsed === 'yes'
        ? oxytocinAvailableSlotIndices
        : availableSlotIndices.length > 0
          ? availableSlotIndices
          : resolveCurrentMedicationSlotIndex !== null
            ? [resolveCurrentMedicationSlotIndex]
            : [];

    if (targetIndices.length === 0 || !baseTime) return [];

    return buildMedicationAllowedTimes(targetIndices);
  }, [
    availableSlotIndices,
    baseTime,
    buildMedicationAllowedTimes,
    firstStageSlotCount,
    isBaseLocked,
    isEmergencyMode,
    isOpen,
    now,
    oxytocinAvailableSlotIndices,
    resolveCurrentMedicationSlotIndex,
    secondStageSlotCount,
    secondStageStartTime,
    watchOxytocinUsed,
  ]);

  const displayAllowedTimes = useMemo(() => {
    if (slotAllowedTimes.length > 0) {
      return slotAllowedTimes;
    }
    const nowHHMM = formatHHMM(now);
    return nowHHMM ? [nowHHMM] : [];
  }, [now, slotAllowedTimes]);

  const areFieldsEnabled =
    !isBaseLocked &&
    (isEmergencyMode || slotAllowedTimes.length > 0 || displayAllowedTimes.length > 0) &&
    Boolean(selectedTime);

  const isSaveDisabled = isSaving || !areFieldsEnabled || medicineStockBlocksSave;

  const handleFormSubmit = async (data: MedicationFormData) => {
    clearErrors();
    setSaveError(null);

    if (!data.time) {
      setError('time', { message: t('timeRequired', 'Time is required') });
      return;
    }

    if (
      !isEmergencyMode &&
      baseTime &&
      slotCount > 0 &&
      (slotAllowedTimes.length > 0 || displayAllowedTimes.length > 0) &&
      !slotAllowedTimes.includes(data.time) &&
      !displayAllowedTimes.includes(data.time)
    ) {
      setError('time', { message: t('timeNotAllowed', 'Select a valid time slot') });
      return;
    }

    if (
      data.oxytocinUsed === 'yes' &&
      !isEmergencyMode &&
      oxytocinSlotAllowedTimes.length > 0 &&
      !oxytocinSlotAllowedTimes.includes(data.time)
    ) {
      setError('time', { message: t('oxytocinTimeNotAllowed', 'Select a valid oxytocin time slot') });
      return;
    }

    if (data.oxytocinUsed === 'yes') {
      const units = toFiniteNumber(data.oxytocinUnitsPerLitre);
      const drops = toFiniteNumber(data.oxytocinDropsPerMinute);
      if (units === null || units <= 0) {
        setError('oxytocinUnitsPerLitre', { message: t('valUnits', 'Amount (U/L) must be > 0') });
        return;
      }
      if (drops === null || drops < 0 || drops > 60) {
        setError('oxytocinDropsPerMinute', { message: t('valDrops', 'Drops must be 0-60') });
        return;
      }
    }
    if (data.medicine === 'yes') {
      const validDrugs = drugs.filter((d) => d.drugName.trim());
      if (validDrugs.length === 0) {
        setError('medicine', { message: t('valMedSearch', 'Search and select at least one drug') });
        return;
      }

      for (const drug of validDrugs) {
        if (drug.stock.status === 'checking') {
          setError('medicine', { message: t('stockCheckInProgress', 'Wait for stock checks to finish') });
          return;
        }

        if (drug.stock.status === 'out-of-stock') {
          setError('medicine', {
            message: t('medicineOutOfStock', '{{drugName}} is out of stock', { drugName: drug.drugName }),
          });
          return;
        }

        if (drug.stock.status === 'error') {
          setError('medicine', {
            message: drug.stock.message || t('stockCheckFailed', 'Failed to check stock'),
          });
          return;
        }

        if (drug.stock.status === 'in-stock') {
          const orderQuantity = getDrugOrderQuantity(drug.quantity);
          if (orderQuantity <= 0) {
            setError('medicine', { message: t('quantityRequired', 'Enter quantity for each in-stock medicine') });
            return;
          }

          const allocated = getAllocatedQuantityForDrug(validDrugs, drug.drugUuid);
          if (allocated > drug.stock.totalQty) {
            setError('medicine', {
              message: t(
                'insufficientStock',
                'Insufficient stock. Requested {{requested}}, only {{available}} available.',
                {
                  requested: allocated,
                  available: drug.stock.totalQty,
                },
              ),
            });
            return;
          }

          if (!drug.route.trim()) {
            setError('medicine', { message: t('routeRequired', 'Select route for each medicine') });
            return;
          }
        }
      }

      data.drug = validDrugs.map((d) => d.drugName).join('; ');
      data.dosage = validDrugs
        .map((d) => {
          const quantity = getDrugOrderQuantity(d.quantity);
          return quantity > 0 ? `${d.dosage} (Qty: ${quantity})` : d.dosage;
        })
        .join('; ');
      data.route = validDrugs.map((d) => d.route).join('; ');
      data.drugLines = validDrugs.map((d) => {
        const quantity = getDrugOrderQuantity(d.quantity);
        return {
          drugName: d.drugName,
          dosage: quantity > 0 ? `${d.dosage} (Qty: ${quantity})` : d.dosage,
          route: d.route,
        };
      });
    }

    setIsSaving(true);
    try {
      if (!patient?.uuid) throw new Error(t('patientReq', 'Patient is required'));

      const result = await saveMedicationData(patient.uuid, data, t, undefined, undefined, {
        emergencyReason: isEmergencyMode ? emergencyReason : undefined,
      });

      if (!result.success) {
        setSaveError(result.message || t('saveError', 'Failed to save'));
        return;
      }

      setSaveSuccess(true);
      onDataSaved?.();
      onSubmit(data);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
        reset();
      }, 1500);
    } catch (error) {
      setSaveError(t('saveError', 'Network error occurred'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      modalHeading={t('medHeading', 'Medications & IV Fluids')}
      primaryButtonText={isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
      primaryButtonDisabled={isSaveDisabled}
      secondaryButtonText={t('cancel', 'Cancel')}
      onRequestSubmit={handleSubmit(handleFormSubmit)}
      onSecondarySubmit={onClose}
      className={styles.cervixModal}
      size="md">
      {saveSuccess && <InlineNotification kind="success" title={t('saved', 'Data saved')} hideCloseButton />}
      {saveError && <InlineNotification kind="error" title={t('error', 'Error')} subtitle={saveError} />}

      {isEmergencyMode ? (
        <InlineNotification
          kind="warning"
          title={t('emergencyModeActive', 'Emergency mode active')}
          subtitle={
            emergencyReason
              ? t('emergencyReasonDisplay', `Reason: ${emergencyReason}`)
              : t('emergencyReasonMissing', 'No reason captured')
          }
          hideCloseButton
        />
      ) : null}

      <Grid className={styles.formGrid}>
        <Column lg={12} md={4} sm={4}>
          <div className={styles.formField}>
            <Controller
              name="time"
              control={control}
              render={({ field, fieldState }) => (
                <div>
                  <label className={styles.fieldLabel}>{t('time', 'Time')}</label>
                  <MedicationTimePickerDropdown
                    id="med-time-picker"
                    value={field.value}
                    onChange={handleTimeChange}
                    allowedTimes={displayAllowedTimes}
                    disablePastTimes={!isEmergencyMode}
                    currentTime={formatHHMM(now)}
                    disabled={!baseTime}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                    labelText=""
                  />
                </div>
              )}
            />
          </div>
        </Column>
        <Column lg={16} md={8} sm={4}>
          <h4 className={styles.sectionFormHeading}>{t('oxytocin', 'Oxytocin')}</h4>
        </Column>
        <Column lg={4} md={2} sm={4}>
          <Controller
            name="oxytocinUsed"
            control={control}
            render={({ field, fieldState }) => (
              <Select
                {...field}
                id="oxy-used"
                disabled={!areFieldsEnabled}
                invalid={!!fieldState.error}
                invalidText={fieldState.error?.message}>
                <SelectItem value="" text={t('select', 'Select...')} />
                <SelectItem value="yes" text={t('yes', 'Yes')} />
                <SelectItem value="no" text={t('noN', 'No')} />
              </Select>
            )}
          />
        </Column>

        {watchOxytocinUsed === 'yes' && (
          <>
            <Column lg={6} md={3} sm={2}>
              <Controller
                name="oxytocinUnitsPerLitre"
                control={control}
                render={({ field, fieldState }) => (
                  <NumberInput
                    {...field}
                    id="oxy-ul"
                    label={t('uL', 'Amount (U/L)')}
                    disabled={!areFieldsEnabled}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                    min={0}
                    allowEmpty
                  />
                )}
              />
            </Column>
            <Column lg={6} md={3} sm={2}>
              <Controller
                name="oxytocinDropsPerMinute"
                control={control}
                render={({ field, fieldState }) => (
                  <NumberInput
                    {...field}
                    id="oxy-drops"
                    label={t('drops', 'Drops/min')}
                    disabled={!areFieldsEnabled}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                    min={0}
                    max={60}
                    allowEmpty
                  />
                )}
              />
            </Column>
          </>
        )}

        <Column lg={16} md={8} sm={4}>
          <h4 className={styles.sectionFormHeading}>{t('medicine', 'Other Medicine')}</h4>
          <Controller
            name="medicine"
            control={control}
            render={({ field, fieldState }) => (
              <Select
                {...field}
                id="med-select"
                disabled={!areFieldsEnabled}
                invalid={!!fieldState.error}
                invalidText={fieldState.error?.message}>
                <SelectItem value="" text={t('select', 'Select...')} />
                <SelectItem value="yes" text={t('yes', 'Yes')} />
                <SelectItem value="no" text={t('noNo', 'No')} />
              </Select>
            )}
          />
        </Column>

        {watchMedicine === 'yes' && (
          <Column lg={16} md={8} sm={4}>
            <div className={styles.drugSearchBlock}>
              {drugs.map((drug, idx) => (
                <MemoizedDrugSearchRow
                  key={`drug-row-${idx}`}
                  index={idx}
                  drug={drug}
                  allDrugs={drugs}
                  encounterLocationUuid={encounterLocationUuid}
                  disabled={!areFieldsEnabled}
                  t={t}
                  onDrugSelected={handleDrugSelected}
                  onChange={(updated) => {
                    const next = [...drugs];
                    next[idx] = updated;
                    setDrugs(next);
                  }}
                  onRemove={() => setDrugs(drugs.filter((_, i) => i !== idx))}
                />
              ))}
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Add}
                className={styles.addDrugBtn}
                disabled={!areFieldsEnabled}
                onClick={() => setDrugs([...drugs, createEmptyDrugItem()])}>
                {t('addDrug', 'Add another drug')}
              </Button>
            </div>
          </Column>
        )}
        <Column lg={16} md={8} sm={4}>
          <h4 className={styles.sectionFormHeading}>{t('ivFluids', 'IV Fluids')}</h4>
        </Column>
        <Column lg={8} md={4} sm={2}>
          <Controller
            name="ivFluids"
            control={control}
            render={({ field, fieldState }) => (
              <Select
                {...field}
                id="iv-fluids"
                disabled={!areFieldsEnabled}
                invalid={!!fieldState.error}
                invalidText={fieldState.error?.message}>
                <SelectItem value="" text={t('select', 'Select...')} />
                <SelectItem value="yes" text={t('yesY', 'Yes')} />
                <SelectItem value="no" text={t('noN', 'No')} />
              </Select>
            )}
          />
        </Column>
        <Column lg={8} md={4} sm={2}>
          {watchIvFluids === 'yes' ? (
            <Controller
              name="ivFluidType"
              control={control}
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  id="iv-fluid-type"
                  labelText={t('ivFluidType', 'IV Fluid Type')}
                  disabled={!areFieldsEnabled}
                  invalid={!!fieldState.error}
                  invalidText={fieldState.error?.message}>
                  <SelectItem value="" text={t('select', 'Select...')} />
                  {IV_FLUID_TYPE_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      text={t(option.labelKey, option.defaultLabel)}
                    />
                  ))}
                </Select>
              )}
            />
          ) : null}
        </Column>
      </Grid>
    </Modal>
  );
};

export default MedicationForm;
