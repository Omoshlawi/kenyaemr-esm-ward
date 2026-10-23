import {
  Button,
  ButtonSet,
  Column,
  ContentSwitcher,
  Form,
  MultiSelect,
  RadioButton,
  RadioButtonGroup,
  Stack,
  Switch,
  TextInput,
} from '@carbon/react';
import { Calculator } from '@carbon/react/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  OpenmrsDatePicker,
  type Patient,
  ResponsiveWrapper,
  restBaseUrl,
  showModal,
  showSnackbar,
  useConfig,
  useSession,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { Controller, type SubmitHandler, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Autosuggest } from '../../../autosuggest/autosuggest.component';
import PatientSearchInfo from '../../../autosuggest/patient-search-info.component';
import SearchEmptyState from '../../../autosuggest/search-empty-state.component';
import { type WardConfigObject } from '../../../config-schema';
import AddressHierarchy from './adresshierarchy.component';
import styles from './contact-list-form.scss';
import {
  type ContactListFormValues,
  type ContactListPersonFormValues,
  contactListSchema,
  createContact,
  searchPatient,
} from './contact-list.resource';
import RelationshipTypeInput from './relationship-type.component';
import { useContactTypeMapping } from './use-contact-mapping';
import { mutate } from 'swr';
type ContactListFormProps = {
  patientUuid: string;
};
const AddContactForm: React.FC<Workspace2DefinitionProps<ContactListFormProps, object, object>> = ({
  closeWorkspace,
  workspaceProps,
}) => {
  const { patientUuid } = workspaceProps ?? {};
  const { t } = useTranslation();
  const session = useSession();
  const config = useConfig<WardConfigObject>();
  const { ContactTypeMapping, DisplayMapping } = useContactTypeMapping();
  const form = useForm<ContactListFormValues>({
    defaultValues: {
      mode: 'search',
      person: '',
      relationToCase: '',
      isHealthCareWorker: 'N',
      caseId: patientUuid,
    },
    resolver: zodResolver(contactListSchema),
  });
  const { mode, person, isHealthCareWorker } = useWatch({ control: form.control });
  const types = useMemo(
    () => Object.entries(ContactTypeMapping).map(([value, label]) => ({ value: DisplayMapping[value], label })),
    [ContactTypeMapping, DisplayMapping],
  );

  const handleCalculateBirthDate = () => {
    const dispose = showModal('birth-date-calculator', {
      onClose: () => dispose(),
      props: { date: new Date(), onBirthDateChange: (date: Date) => form.setValue('person.birthdate', date) },
    });
  };
  const handleSubmit: SubmitHandler<ContactListFormValues> = async (data) => {
    try {
      await createContact(data, config, t, session);
      mutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/relationship`), undefined, {
        revalidate: true,
      });
      showSnackbar({
        kind: 'success',
        title: t('success', 'Success'),
        subtitle: t('contactAddeddSuccessfully', 'Contact added successfully!'),
      });
      closeWorkspace?.();
    } catch (error) {
      showSnackbar({ kind: 'error', title: t('error', 'Error'), subtitle: (error as any)?.message });
    }
  };
  return (
    <Workspace2 title={t('contactListForm', 'Contact List Form')} hasUnsavedChanges={false}>
      <Form className={styles.form} onSubmit={form.handleSubmit(handleSubmit, (e) => console.error(e))}>
        <Stack gap={4} className={styles.grid}>
          <Column>
            <Controller
              control={form.control}
              name="mode"
              render={({ field }) => (
                <ContentSwitcher
                  size="md"
                  selectedIndex={field.value == 'search' ? 0 : 1}
                  onChange={({ index, name, text }) => {
                    field.onChange(name);
                  }}>
                  <Switch name="search" text={t('searchPatient', 'Search patient')} />
                  <Switch name="create" text={t('createPatient', 'Create patient')} />
                </ContentSwitcher>
              )}
            />
          </Column>
          {mode === 'search' && (
            <Column>
              <Controller
                control={form.control}
                name="person"
                render={({ field, fieldState: { error } }) => (
                  <Autosuggest
                    className={styles.input}
                    labelText={t('patient', 'Patient')}
                    placeholder={t('patientPlaceHolder', 'Search patient')}
                    invalid={Boolean(error?.message)}
                    invalidText={error?.message}
                    getDisplayValue={(item: Patient) => item.person?.display}
                    renderSuggestionItem={(item) => <PatientSearchInfo patient={item} />}
                    getFieldValue={(item: Patient) => item.uuid}
                    getSearchResults={searchPatient}
                    renderEmptyState={(value) => (
                      <SearchEmptyState
                        searchValue={value}
                        message={t('patientNotFound', 'Patient Not Found')}
                        onAdd={() => form.setValue('mode', 'create')}
                      />
                    )}
                    onClear={() => field.onChange('')}
                    onSuggestionSelected={(field_, value) => {
                      if (value) {
                        field.onChange(value);
                      }
                    }}
                  />
                )}
              />
            </Column>
          )}
          {mode === 'create' && (
            <>
              <Column>
                <Controller
                  control={form.control}
                  name="person.givenName"
                  render={({ field, fieldState: { error } }) => (
                    <TextInput
                      id={field.name}
                      invalid={!!error?.message}
                      invalidText={error?.message}
                      {...field}
                      placeholder={t('firstNamePlaceholder', 'First name')}
                      labelText={t('firstName', 'First name')}
                    />
                  )}
                />
              </Column>
              <Column>
                <Controller
                  control={form.control}
                  name="person.middleName"
                  render={({ field, fieldState: { error } }) => (
                    <TextInput
                      id={field.name}
                      invalid={!!error?.message}
                      invalidText={error?.message}
                      {...field}
                      placeholder={t('middleNamePlaceholder', 'Middle name')}
                      labelText={t('middleName', 'Middle name')}
                    />
                  )}
                />
              </Column>
              <Column>
                <Controller
                  control={form.control}
                  name="person.familyName"
                  render={({ field, fieldState: { error } }) => (
                    <TextInput
                      id={field.name}
                      invalid={!!error?.message}
                      invalidText={error?.message}
                      {...field}
                      placeholder={t('lastNamePlaceholder', 'Last name')}
                      labelText={t('lastName', 'Last name')}
                    />
                  )}
                />
              </Column>
              <Column>
                <Controller
                  control={form.control}
                  name="person.gender"
                  render={({ field, fieldState: { error } }) => (
                    <RadioButtonGroup
                      legendText={t('sex', 'Sex')}
                      {...field}
                      invalid={!!error?.message}
                      invalidText={error?.message}>
                      <RadioButton labelText={t('male', 'Male')} value="M" id="M" />
                      <RadioButton labelText={t('female', 'Female')} value="F" id="F" />
                    </RadioButtonGroup>
                  )}
                />
              </Column>
              <Column>
                <Controller
                  control={form.control}
                  name="person.birthdate"
                  render={({ field, fieldState: { error } }) => (
                    <ResponsiveWrapper>
                      <OpenmrsDatePicker
                        {...field}
                        id="person-birdthdate"
                        labelText={t('dateOfBirth', 'Date of birth')}
                        value={field.value as Date}
                        // minDate={oneYearAgo()}
                        maxDate={new Date()}
                        invalid={Boolean(error?.message)}
                        invalidText={error?.message}
                      />
                    </ResponsiveWrapper>
                  )}
                />
              </Column>
              <Column>
                <Button kind="ghost" renderIcon={Calculator} onClick={handleCalculateBirthDate}>
                  {t('fromAge', 'From Age')}
                </Button>
              </Column>
              <Column>
                <Controller
                  control={form.control}
                  name="person.address"
                  render={({ field, fieldState: { error } }) => (
                    <TextInput
                      id={field.name}
                      invalid={!!error?.message}
                      invalidText={error?.message}
                      {...field}
                      placeholder={t('physicalAddress', 'Physical Address/Landmark')}
                      labelText={t('address', 'Address')}
                    />
                  )}
                />
              </Column>
              <Column>
                <Controller
                  control={form.control}
                  name="person.phoneNumber"
                  render={({ field, fieldState: { error } }) => (
                    <TextInput
                      {...field}
                      id={field.name}
                      invalid={!!error?.message}
                      invalidText={error?.message}
                      placeholder={t('phoneNumberPlaceholder', 'Phone number')}
                      labelText={t('phoneNumber', 'Phone number')}
                    />
                  )}
                />
              </Column>
              <Column>
                <Controller
                  control={form.control}
                  name="person.county"
                  render={({ field, fieldState: { error } }) => (
                    <AddressHierarchy
                      {...field}
                      id={field.name}
                      search=""
                      invalid={!!error?.message}
                      invalidText={error?.message}
                      placeholder={t('countyPlaceholder', 'County')}
                      titleText={t('county', 'County')}
                    />
                  )}
                />
              </Column>
              {(person as ContactListPersonFormValues)?.county && (
                <Column>
                  <Controller
                    control={form.control}
                    name="person.subcounty"
                    render={({ field, fieldState: { error } }) => (
                      <AddressHierarchy
                        {...field}
                        search={(person as ContactListPersonFormValues)?.county}
                        id={field.name}
                        invalid={!!error?.message}
                        invalidText={error?.message}
                        placeholder={t('subcountyPlaceholder', 'Sub County')}
                        titleText={t('subcounty', 'Sub County')}
                      />
                    )}
                  />
                </Column>
              )}
            </>
          )}
          <Column>
            <Controller
              control={form.control}
              name="relationToCase"
              render={({ field, fieldState: { error } }) => (
                <RelationshipTypeInput
                  {...field}
                  id={field.name}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  placeholder={t('relationToCase', 'Relation to case')}
                  titleText={t('relationToCase', 'Relation to case')}
                />
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="dateofLastContact"
              render={({ field, fieldState: { error } }) => (
                <ResponsiveWrapper>
                  <OpenmrsDatePicker
                    {...field}
                    id="date-of-last-contact"
                    labelText={t('dateOfLastContact', 'Date of last contact')}
                    value={field.value as Date}
                    // minDate={oneYearAgo()}
                    maxDate={new Date()}
                    invalid={Boolean(error?.message)}
                    invalidText={error?.message}
                  />
                </ResponsiveWrapper>
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="typeOfContact"
              render={({ field, fieldState: { error } }) => (
                <MultiSelect
                  {...field}
                  label={t('typeOfContact', 'Type of contact')}
                  items={types}
                  selectedItems={field.value?.map((v) => ({ value: v, label: ContactTypeMapping[v] })) ?? []}
                  onChange={({ selectedItems }) => {
                    field.onChange(selectedItems?.map((item) => item.value) ?? []);
                  }}
                  itemToString={(item) => item?.label ?? ''}
                  id={field.name}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  placeholder={t('typeOfContact', 'Type of contact')}
                  titleText={t('typeOfContact', 'Type of contact')}
                />
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="headOfHouseHold"
              render={({ field, fieldState: { error } }) => (
                <TextInput
                  {...field}
                  id={field.name}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  placeholder={t('headOfHouseHold', 'Head of Household')}
                  labelText={t('headOfHouseHold', 'Head of Household')}
                />
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="isHealthCareWorker"
              render={({ field, fieldState: { error } }) => (
                <RadioButtonGroup
                  legendText={t('isHeathCareWorker', 'Is healthcare worker')}
                  {...field}
                  invalid={!!error?.message}
                  invalidText={error?.message}>
                  <RadioButton labelText={t('yes', 'Yes')} value="Y" id="Y" />
                  <RadioButton labelText={t('no', 'No')} value="N" id="N" />
                </RadioButtonGroup>
              )}
            />
          </Column>
          {isHealthCareWorker === 'Y' && (
            <Column>
              <Controller
                control={form.control}
                name="facility"
                render={({ field, fieldState: { error } }) => (
                  <TextInput
                    {...field}
                    id={field.name}
                    invalid={!!error?.message}
                    invalidText={error?.message}
                    placeholder={t('healthFacility', 'Health Facility')}
                    labelText={t('healthFacility', 'Health Facility')}
                  />
                )}
              />
            </Column>
          )}
        </Stack>
        <ButtonSet className={styles.btnSet}>
          <Button kind="secondary" onClick={() => closeWorkspace()}>
            Cancel
          </Button>
          <Button kind="primary" type="submit">
            Submit
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default AddContactForm;
