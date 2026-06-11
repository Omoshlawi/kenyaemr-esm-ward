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
} from '@carbon/react';
import { TrashCan, Add } from '@carbon/react/icons';
import { useDebounce, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { MedicationTimePickerDropdown } from './form-scoped-time-pickers.component';
import styles from '../partography-data-form.scss';
import {
  getAllowedEmergencyTimes,
  getAllowedPointTimesForSlots,
  getAllowedTimesForSlots,
  getSlotIndexForTime,
  getSlotState,
  getStageAwarePointSlotIndexForTime,
} from '../time-slot-utils';
import {
  LCG_MEDICATION_OXYTOCIN_INTERVAL_MINUTES,
  LCG_TIME_INCREMENT_MINUTES,
  MEDICATION_TIME_SLOT_EARLY_ALLOWANCE_MINUTES,
  MEDICATION_TIME_SLOT_LATE_ALLOWANCE_MINUTES,
} from '../types';
import { saveMedicationData } from '../resources/medication.resource';

export type DrugItem = {
  drugName: string;
  dosage: string;
  route: string;
};

export type MedicationFormData = {
  time: string;
  oxytocinUsed: string;
  oxytocinUnitsPerLitre: number | '';
  oxytocinDropsPerMinute: number | '';
  medicine: string;
  drug: string;
  dosage: string;
  route: string;
  ivFluids: string;
  ivFluidType: string;
};

const IV_FLUID_TYPE_OPTIONS = [
  { value: '80804AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', labelKey: 'normalSaline', defaultLabel: 'Normal saline' },
  { value: '78617AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', labelKey: 'ringersLactate', defaultLabel: "Ringer's lactate" },
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

const DRUG_FETCHER = (url: string) => openmrsFetch(url).then((r) => r.json());

const DrugSearchRow: React.FC<{
  drug: DrugItem;
  index: number;
  onChange: (d: DrugItem) => void;
  onRemove: () => void;
  disabled: boolean;
  t: TFunction;
}> = ({ drug, index, onChange, onRemove, disabled, t }) => {
  const [query, setQuery] = useState(drug.drugName);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 400);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shouldFetch = debouncedQuery.length >= 3 && !drug.drugName;
  const { data, isLoading } = useSWR(
    shouldFetch ? `${restBaseUrl}/drug?q=${encodeURIComponent(debouncedQuery)}&v=full&limit=10` : null,
    DRUG_FETCHER,
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

  return (
    <div className={styles.drugSearchRow}>
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
            if (drug.drugName) onChange({ ...drug, drugName: '', dosage: '', route: '' });
          }}
          onFocus={() => {
            if (drug.drugName || query.length >= 3) setOpen(true);
          }}
        />
        {isLoading && <p className={styles.drugSearchLoading}>{t('searching', 'Searching...')}</p>}
        {open && suggestions.length > 0 && (
          <ul className={styles.drugSuggestions}>
            {suggestions.map((s: any) => (
              <li
                key={s.uuid}
                onMouseDown={() => {
                  const name = s.name ?? s.display;
                  const strength = s.strength ?? '';
                  onChange({ ...drug, drugName: name, dosage: strength, route: drug.route });
                  setQuery(name);
                  setOpen(false);
                }}>
                <strong>{s.name ?? s.display}</strong>
                {s.strength ? ` — ${s.strength}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

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
  );
};

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [drugs, setDrugs] = useState<DrugItem[]>([{ drugName: '', dosage: '', route: '' }]);

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
  const selectedTime = watch('time');

  useEffect(() => {
    if (!isOpen) return;
    setNow(new Date());
    const intervalId = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(intervalId);
  }, [isOpen]);

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
      setDrugs([{ drugName: '', dosage: '', route: '' }]);
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
      setDrugs([{ drugName: '', dosage: '', route: '' }]);
      setValue('drug', '');
      setValue('dosage', '');
      setValue('route', '');
    }
  }, [watchMedicine, setValue]);

  useEffect(() => {
    if (watch('ivFluids') !== 'yes') {
      setValue('ivFluidType', '');
    }
  }, [setValue, watch]);

  const isBaseLocked = !isEmergencyMode && (!baseTime || slotCount === 0);

  const occupiedSlotIndices = useMemo(() => {
    const occupied = new Set<number>();
    if (!baseTime || slotCount === 0) return occupied;

    for (const entry of existingTimeEntries) {
      const idx =
        getStageAwarePointSlotIndexForTime(
          baseTime,
          entry.time,
          firstStageSlotCount || slotCount,
          secondStageSlotCount,
          secondStageStartTime,
          MEDICATION_HALF_SLOT_OPTIONS[0],
        ) ?? getSlotIndexForTime(baseTime, entry.time, slotCount);
      if (idx !== null) {
        occupied.add(idx);
      }
    }

    return occupied;
  }, [baseTime, existingTimeEntries, firstStageSlotCount, secondStageSlotCount, secondStageStartTime, slotCount]);

  const availableSlotIndices = useMemo(() => {
    if (!baseTime || slotCount === 0) return [];

    if (secondStageStartTime && secondStageSlotCount > 0 && firstStageSlotCount > 0) {
      const currentSlotIndex =
        getStageAwarePointSlotIndexForTime(
          baseTime,
          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          firstStageSlotCount,
          secondStageSlotCount,
          secondStageStartTime,
          MEDICATION_HALF_SLOT_OPTIONS[0],
        ) ??
        getStageAwarePointSlotIndexForTime(
          baseTime,
          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          firstStageSlotCount,
          secondStageSlotCount,
          secondStageStartTime,
          MEDICATION_HALF_SLOT_OPTIONS[1],
        );

      if (currentSlotIndex !== null && currentSlotIndex >= firstStageSlotCount) {
        const relativeSecondStageIndex = currentSlotIndex - firstStageSlotCount;
        return occupiedSlotIndices.has(currentSlotIndex) ? [] : [relativeSecondStageIndex];
      }
    }

    return Array.from({ length: slotCount }, (_, i) => i).filter((idx) => {
      if (occupiedSlotIndices.has(idx)) {
        return false;
      }

      return getSlotState(baseTime, idx, now) === 'active';
    });
  }, [baseTime, firstStageSlotCount, now, occupiedSlotIndices, secondStageSlotCount, secondStageStartTime, slotCount]);

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

  const allowedTimes = useMemo(() => {
    if (!isOpen || isBaseLocked) return [];
    if (isEmergencyMode) {
      return getAllowedEmergencyTimes(now);
    }

    if (secondStageStartTime && secondStageSlotCount > 0 && firstStageSlotCount > 0) {
      const currentSlotIndex =
        getStageAwarePointSlotIndexForTime(
          baseTime ?? '',
          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          firstStageSlotCount,
          secondStageSlotCount,
          secondStageStartTime,
          MEDICATION_HALF_SLOT_OPTIONS[0],
        ) ??
        getStageAwarePointSlotIndexForTime(
          baseTime ?? '',
          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          firstStageSlotCount,
          secondStageSlotCount,
          secondStageStartTime,
          MEDICATION_HALF_SLOT_OPTIONS[1],
        );

      if (currentSlotIndex !== null && currentSlotIndex >= firstStageSlotCount) {
        const relativeSecondStageIndex = currentSlotIndex - firstStageSlotCount;
        if (occupiedSlotIndices.has(currentSlotIndex)) {
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
    }

    const targetIndices = watchOxytocinUsed === 'yes' ? oxytocinAvailableSlotIndices : availableSlotIndices;
    if (targetIndices.length === 0) return [];
    return Array.from(
      new Set([
        ...getAllowedPointTimesForSlots(baseTime, targetIndices, MEDICATION_HALF_SLOT_OPTIONS[0], now),
        ...getAllowedPointTimesForSlots(baseTime, targetIndices, MEDICATION_HALF_SLOT_OPTIONS[1], now),
      ]),
    ).sort();
  }, [
    availableSlotIndices,
    baseTime,
    firstStageSlotCount,
    isBaseLocked,
    isEmergencyMode,
    isOpen,
    now,
    occupiedSlotIndices,
    oxytocinAvailableSlotIndices,
    secondStageSlotCount,
    secondStageStartTime,
    watchOxytocinUsed,
  ]);

  useEffect(() => {
    if (!isOpen || selectedTime || allowedTimes.length === 0) {
      return;
    }

    setValue('time', allowedTimes[0], { shouldValidate: true, shouldDirty: true });
  }, [allowedTimes, isOpen, selectedTime, setValue]);

  const isTimeWindowLocked = !isEmergencyMode && !isBaseLocked && allowedTimes.length === 0;
  const areFieldsEnabled = !isBaseLocked && !isTimeWindowLocked && !!selectedTime;

  const handleFormSubmit = async (data: MedicationFormData) => {
    clearErrors();
    setSaveError(null);

    if (!data.time) {
      setError('time', { message: t('timeRequired', 'Time is required') });
      return;
    }

    if (allowedTimes.length > 0 && !allowedTimes.includes(data.time)) {
      setError('time', { message: t('timeNotAllowed', 'Select a valid time slot') });
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
      data.drug = validDrugs.map((d) => d.drugName).join('; ');
      data.dosage = validDrugs.map((d) => d.dosage).join('; ');
      data.route = validDrugs.map((d) => d.route).join('; ');
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
      primaryButtonDisabled={isSaving || !areFieldsEnabled}
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
                    onChange={field.onChange}
                    allowedTimes={allowedTimes}
                    currentTime={`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
                      2,
                      '0',
                    )}`}
                    disabled={isBaseLocked}
                    invalid={!!fieldState.error}
                    invalidText={fieldState.error?.message}
                    labelText=""
                  />
                </div>
              )}
            />
            {isTimeWindowLocked && (
              <p className={styles.helperTextError}>
                {t('lockedTime', 'Current time is outside the exact slot time required for this entry.')}
              </p>
            )}
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
                <DrugSearchRow
                  key={idx}
                  index={idx}
                  drug={drug}
                  disabled={!areFieldsEnabled}
                  t={t}
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
                onClick={() => setDrugs([...drugs, { drugName: '', dosage: '', route: '' }])}>
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
          {watch('ivFluids') === 'yes' ? (
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
