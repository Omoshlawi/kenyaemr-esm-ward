import React, { useEffect, useMemo, useRef, useState } from 'react';
import { mutate } from 'swr';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import classNames from 'classnames';
import {
  Button,
  ButtonSet,
  ComboBox,
  Dropdown,
  Form,
  InlineLoading,
  InlineNotification,
  NumberInput,
  Stack,
  TextInput,
} from '@carbon/react';
import { TrashCan } from '@carbon/react/icons';
import {
  ResponsiveWrapper,
  showSnackbar,
  useAppContext,
  useConfig,
  useLayoutType,
  useSession,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { type WardConfigObject } from '../config-schema';
import {
  processBillItems,
  useBillableServiceByConcept,
  useBillableServices,
  useCashPoints,
  useCurrencyFormatter,
  type BillableService,
  type BillableServicePrice,
  type CashPoint,
} from './create-bill.resource';
import styles from './create-bill.scss';
import { type WardViewContext } from '../types';

type CreateWardBillWorkspaceProps = {
  patientUuid: string;
  daysAdmitted: number | string;
  visitUuid?: string;
};

const createBillSchema = z.object({
  cashPointUuid: z.string().min(1, 'Select a cash point'),
  billableServiceUuid: z.string().min(1, 'Select a billable item'),
  quantity: z.number({ coerce: true }).min(1, 'Quantity must be at least 1'),
  priceUuid: z.string().min(1, 'Select a payment mode'),
});

type CreateBillFormData = z.infer<typeof createBillSchema>;

const CreateWardBillWorkspace: React.FC<Workspace2DefinitionProps<CreateWardBillWorkspaceProps, {}, {}>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { patientUuid, daysAdmitted, visitUuid } = workspaceProps ?? ({} as CreateWardBillWorkspaceProps);
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const formatCurrency = useCurrencyFormatter();
  const { wardPatientGroupDetails } = useAppContext<WardViewContext>('ward-view-context') ?? {};
  const { currentProvider, sessionLocation, user } = useSession();
  const cashierUuid = currentProvider?.uuid;
  const cashierDisplay = user?.display ?? currentProvider?.identifier ?? t('unknownUser', 'Unknown user');

  const { dailyBedFeeBillableService } = useConfig<WardConfigObject>();
  const { cashPoints, isLoading: isLoadingCashPoints } = useCashPoints();

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // daysAdmitted may come through as a number or a placeholder like '--'.
  const defaultQuantity = useMemo(() => {
    const parsed = typeof daysAdmitted === 'number' ? daysAdmitted : Number(daysAdmitted);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [daysAdmitted]);

  // Preload the configured daily bed fee (looked up by concept uuid) so it can
  // be pre-selected as the default chargeable item.
  const { billableService: defaultBillableService, isLoading: isLoadingDefaultService } =
    useBillableServiceByConcept(dailyBedFeeBillableService);

  const { billableServices, isLoading: isLoadingServices } = useBillableServices(searchTerm);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { isDirty, isSubmitting, isValid, errors },
  } = useForm<CreateBillFormData>({
    resolver: zodResolver(createBillSchema),
    mode: 'onChange',
    defaultValues: {
      cashPointUuid: '',
      billableServiceUuid: '',
      quantity: defaultQuantity,
      priceUuid: '',
    },
  });

  const selectedBillableServiceUuid = watch('billableServiceUuid');
  const selectedCashPointUuid = watch('cashPointUuid');
  const selectedPriceUuid = watch('priceUuid');
  const quantity = watch('quantity');

  // Merge the pre-fetched default service with any live search results so it
  // is always available for selection even before the user searches.
  const mergedServices = useMemo(() => {
    const map = new Map<string, BillableService>();
    if (defaultBillableService) {
      map.set(defaultBillableService.uuid, defaultBillableService);
    }
    billableServices.forEach((service) => {
      map.set(service.uuid, service);
    });
    return Array.from(map.values());
  }, [defaultBillableService, billableServices]);

  const selectedService = useMemo(
    () => mergedServices.find((service) => service.uuid === selectedBillableServiceUuid) ?? null,
    [mergedServices, selectedBillableServiceUuid],
  );

  const selectedPrice: BillableServicePrice | null = useMemo(
    () => selectedService?.servicePrices?.find((price) => price.uuid === selectedPriceUuid) ?? null,
    [selectedService, selectedPriceUuid],
  );

  const total = (selectedPrice?.price ?? 0) * (Number(quantity) || 0);

  // Pre-select the configured daily bed fee as the default chargeable item
  // (once) when it finishes loading, and seed the quantity from days admitted.
  // Using a ref ensures we don't re-select it if the user explicitly clears
  // the selection.
  const hasSeededDefault = useRef(false);
  const hasSeededCashPoint = useRef(false);
  useEffect(() => {
    if (defaultBillableService && !hasSeededDefault.current) {
      hasSeededDefault.current = true;
      reset(
        {
          cashPointUuid: getValues('cashPointUuid'),
          billableServiceUuid: defaultBillableService.uuid,
          quantity: defaultQuantity,
          priceUuid: defaultBillableService.servicePrices?.[0]?.uuid ?? '',
        },
        { keepDefaultValues: false },
      );
    }
  }, [defaultBillableService, defaultQuantity, getValues, reset]);

  useEffect(() => {
    if (!cashPoints.length || hasSeededCashPoint.current) {
      return;
    }

    const matchingLocationCashPoint = sessionLocation?.uuid
      ? cashPoints.find((cashPoint) => cashPoint.location?.uuid === sessionLocation.uuid)
      : undefined;
    const defaultCashPoint = matchingLocationCashPoint ?? cashPoints[0];
    if (defaultCashPoint) {
      hasSeededCashPoint.current = true;
      setValue('cashPointUuid', defaultCashPoint.uuid, { shouldValidate: true });
    }
  }, [cashPoints, sessionLocation?.uuid, setValue]);

  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  const handleClearSelection = () => {
    reset({
      cashPointUuid: getValues('cashPointUuid'),
      billableServiceUuid: '',
      quantity: defaultQuantity,
      priceUuid: '',
    });
  };

  const onSubmit = async (formData: CreateBillFormData) => {
    setSubmitError(null);

    if (!selectedService || !selectedPrice) {
      setSubmitError(t('selectItemAndPrice', 'Select a billable item and a payment mode before saving.'));
      return;
    }

    if (!formData.cashPointUuid) {
      setSubmitError(t('selectCashPoint', 'Select a cash point before saving.'));
      return;
    }

    if (!cashierUuid) {
      setSubmitError(t('missingLoggedInProvider', 'No provider is linked to the logged-in user.'));
      return;
    }

    const payload = {
      cashPoint: formData.cashPointUuid,
      cashier: cashierUuid,
      patient: patientUuid,
      ...(visitUuid ? { visit: visitUuid } : {}),
      status: 'PENDING' as const,
      lineItems: [
        {
          billableService: selectedService.uuid,
          quantity: formData.quantity,
          price: selectedPrice.price,
          priceUuid: selectedPrice.uuid,
          priceName: selectedPrice.name ?? 'Default',
          lineItemOrder: 0,
          paymentStatus: 'PENDING' as const,
        },
      ],
      payments: [],
    };

    try {
      await processBillItems(payload);
      await mutate((key) => typeof key === 'string' && key.includes('/cashier/bill'));
      wardPatientGroupDetails?.mutate();
      showSnackbar({
        title: t('billSaved', 'Bill saved'),
        subtitle: t('billProcessingSuccess', 'Bill processing has been successful'),
        kind: 'success',
        timeoutInMs: 3000,
      });
      closeWorkspace({ discardUnsavedChanges: true });
    } catch (error) {
      const message =
        (error as { responseBody?: { error?: { message?: string } }; message?: string })?.responseBody?.error
          ?.message ??
        (error as Error)?.message ??
        t('unknownError', 'Unknown error occurred');
      setSubmitError(message);
      showSnackbar({
        title: t('billProcessingError', 'Bill processing error'),
        subtitle: message,
        kind: 'error',
        timeoutInMs: 6000,
      });
    }
  };

  const submitDisabled = !isValid || isSubmitting || !selectedService || !selectedPrice || !cashierUuid;

  return (
    <Workspace2 title={t('createBill', 'Create Bill')} hasUnsavedChanges={hasUnsavedChanges}>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.formContainer}>
          <ResponsiveWrapper>
            <InlineNotification
              className={styles.infoNotification}
              aria-label={t('createWardBillHelperLabel', 'Create ward bill')}
              kind="info"
              lowContrast
              hideCloseButton
              title={t('createWardBill', 'Create Ward Bill')}
              subtitle={t(
                'createWardBillHelper',
                'The daily bed charge is pre-selected and the quantity defaults to the number of days admitted ({{days}}). Search to pick a different chargeable item if needed.',
                { days: defaultQuantity },
              )}
            />
          </ResponsiveWrapper>

          <section>
            <h5 className={styles.sectionTitle}>{t('billingDetails', 'Billing details')}</h5>
            <Stack gap={5}>
              <Controller
                control={control}
                name="cashPointUuid"
                render={({ field }) => (
                  <ResponsiveWrapper>
                    <Dropdown
                      id="ward-bill-cash-point"
                      titleText={t('cashPoint', 'Cash point')}
                      label={t('selectCashPoint', 'Select a cash point')}
                      items={cashPoints}
                      itemToString={(item: CashPoint | null) => {
                        if (!item) {
                          return '';
                        }
                        return item.location?.display ? `${item.name} — ${item.location.display}` : item.name;
                      }}
                      selectedItem={cashPoints.find((cashPoint) => cashPoint.uuid === field.value) ?? null}
                      onChange={({ selectedItem }) => {
                        field.onChange((selectedItem as CashPoint | null)?.uuid ?? '');
                      }}
                      invalid={Boolean(errors.cashPointUuid)}
                      invalidText={errors.cashPointUuid?.message}
                    />
                  </ResponsiveWrapper>
                )}
              />

              {isLoadingCashPoints && !selectedCashPointUuid && (
                <InlineLoading description={t('loadingCashPoints', 'Loading cash points...')} />
              )}

              <TextInput id="ward-bill-cashier" labelText={t('cashier', 'Cashier')} value={cashierDisplay} readOnly />

              {!cashierUuid && (
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  title={t('missingLoggedInProvider', 'No provider is linked to the logged-in user')}
                  subtitle={t(
                    'missingLoggedInProviderHelper',
                    'You must be logged in as a provider to raise a ward bill.',
                  )}
                />
              )}
            </Stack>
          </section>

          <section>
            <h5 className={styles.sectionTitle}>{t('chargeableItem', 'Chargeable item')}</h5>
            <p className={styles.sectionHelper}>
              {t('searchOrPickItem', 'Search for a billable service or use the pre-selected daily bed charge.')}
            </p>

            <Stack gap={5}>
              <Controller
                control={control}
                name="billableServiceUuid"
                render={({ field }) => (
                  <ResponsiveWrapper>
                    <ComboBox
                      id="ward-bill-service"
                      titleText={t('billableItem', 'Billable item')}
                      placeholder={t('searchBillableItems', 'Search billable items')}
                      items={mergedServices}
                      itemToString={(item: BillableService | null) => (item ? item.name : '')}
                      selectedItem={mergedServices.find((service) => service.uuid === field.value) ?? null}
                      onInputChange={(value) => setSearchTerm(value ?? '')}
                      onChange={({ selectedItem }) => {
                        const nextService = selectedItem as BillableService | null;
                        field.onChange(nextService?.uuid ?? '');
                        setValue('priceUuid', nextService?.servicePrices?.[0]?.uuid ?? '', { shouldValidate: true });
                      }}
                      shouldFilterItem={() => true}
                      invalid={Boolean(errors.billableServiceUuid)}
                      invalidText={errors.billableServiceUuid?.message}
                    />
                  </ResponsiveWrapper>
                )}
              />

              {(isLoadingServices || isLoadingDefaultService) && !selectedService && (
                <InlineLoading description={t('loadingBillableItems', 'Loading billable items...')} />
              )}

              {selectedService && (
                <div className={styles.selectedItem}>
                  <div className={styles.selectedItemHeader}>
                    <span className={styles.serviceName}>{selectedService.name}</span>
                    <Button
                      hasIconOnly
                      renderIcon={TrashCan}
                      iconDescription={t('removeItem', 'Remove item')}
                      kind="ghost"
                      size="sm"
                      onClick={handleClearSelection}
                    />
                  </div>

                  <div className={styles.selectedItemGrid}>
                    <Controller
                      control={control}
                      name="quantity"
                      render={({ field }) => (
                        <NumberInput
                          id="ward-bill-quantity"
                          label={t('quantity', 'Quantity')}
                          helperText={t('defaultsToDaysAdmitted', 'Defaults to days admitted ({{days}})', {
                            days: defaultQuantity,
                          })}
                          min={1}
                          value={field.value}
                          onChange={(_event, { value }) => field.onChange(value === '' ? '' : Number(value))}
                          invalid={Boolean(errors.quantity)}
                          invalidText={errors.quantity?.message}
                        />
                      )}
                    />

                    <Controller
                      control={control}
                      name="priceUuid"
                      render={({ field }) => (
                        <Dropdown
                          id="ward-bill-price"
                          titleText={t('paymentMode', 'Payment mode')}
                          label={t('selectPaymentMode', 'Select payment mode')}
                          items={selectedService.servicePrices ?? []}
                          itemToString={(item: BillableServicePrice | null) =>
                            item ? `${item.paymentMode?.name ?? item.name} — ${formatCurrency(item.price)}` : ''
                          }
                          selectedItem={
                            selectedService.servicePrices?.find((price) => price.uuid === field.value) ?? null
                          }
                          onChange={({ selectedItem }) => {
                            field.onChange((selectedItem as BillableServicePrice | null)?.uuid ?? '');
                          }}
                          invalid={Boolean(errors.priceUuid)}
                          invalidText={errors.priceUuid?.message}
                        />
                      )}
                    />
                  </div>

                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>
                      {t('unitPrice', 'Unit price')}: {formatCurrency(selectedPrice?.price ?? 0)}
                      {' × '}
                      {Number(quantity) || 0}
                    </span>
                    <span className={styles.summaryValue}>
                      {t('total', 'Total')}: {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              )}

              {submitError && (
                <InlineNotification
                  kind="error"
                  lowContrast
                  title={t('couldNotSaveBill', 'Could not save bill')}
                  subtitle={submitError}
                  onCloseButtonClick={() => setSubmitError(null)}
                />
              )}
            </Stack>
          </section>
        </div>

        <ButtonSet className={classNames(styles.buttonSet, { [styles.tablet]: isTablet, [styles.desktop]: !isTablet })}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={styles.button} kind="primary" type="submit" disabled={submitDisabled}>
            {isSubmitting ? (
              <InlineLoading className={styles.spinner} description={t('savingBill', 'Saving...')} />
            ) : (
              <span>{t('saveAndClose', 'Save & close')}</span>
            )}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default CreateWardBillWorkspace;
