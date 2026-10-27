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
import { revalidateRelationships, useContactTypeMapping } from './use-contact-mapping';

const emptyCreatePerson: ContactListPersonFormValues = {
  givenName: '',
  middleName: '',
  familyName: '',
  gender: undefined as unknown as ContactListPersonFormValues['gender'],
  birthdate: undefined as unknown as Date,
  address: '',
  county: '',
  subcounty: '',
  phoneNumber: '',
};

type ContactListFormProps = {
  patientUuid: string;
  initialMode?: ContactListFormValues['mode'];
  onContactAdded?: () => void;
};
const AddContactForm: React.FC<Workspace2DefinitionProps<ContactListFormProps, object, object>> = ({
  closeWorkspace,
  workspaceProps,
}) => {
  const { patientUuid, initialMode = 'search', onContactAdded } = workspaceProps ?? {};
  const { t } = useTranslation();
  const session = useSession();
  const config = useConfig<WardConfigObject>();
  const { ContactTypeMapping, DisplayMapping } = useContactTypeMapping();
  const form = useForm<ContactListFormValues>({
    defaultValues: {
      mode: initialMode,
      person: initialMode === 'create' ? emptyCreatePerson : '',
      relationToCase: '',
      typeOfContact: [],
      headOfHouseHold: '',
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
      await revalidateRelationships();
      onContactAdded?.();
      showSnackbar({
        kind: 'success',
        title: t('success', 'Success'),
        subtitle: t('contactAddedSuccessfully', 'Contact added successfully!'),
      });
      closeWorkspace?.();
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('error', 'Error'),
        subtitle:
          error instanceof Error ? error.message : t('unexpectedError', 'An unexpected error occurred while saving.'),
      });
    }
  };
  return (
    <Workspace2 title={t('contactListForm', 'Contact List Form')} hasUnsavedChanges={false}>
      <Form className={styles.form} onSubmit={form.handleSubmit(handleSubmit)}>
        <Stack gap={4} className={styles.grid}>
          <Column>
            <Controller
              control={form.control}
              name="mode"
              render={({ field }) => (
                <ContentSwitcher
                  size="md"
                  selectedIndex={field.value == 'search' ? 0 : 1}
                  onChange={({ name }) => {
                    field.onChange(name);
                    form.setValue('person', name === 'create' ? emptyCreatePerson : '');
                    form.clearErrors('person');
                  }}>
                  <Switch name="search" text={t('searchPatient', 'Search patient')} />
                  <Switch name="create" text={t('createPatient', 'Create patient')} />
                </ContentSwitcher>
              )}
            />
            <p className={styles.modeHint}>
              {t(
                'addContactModeHint',
                'Search if this person is already registered. Choose Create patient to enter details for someone who is not yet in the system.',
              )}
            </p>
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
                        onAdd={() => {
                          form.setValue('mode', 'create');
                          form.setValue('person', emptyCreatePerson);
                          form.clearErrors('person');
                        }}
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
                  legendText={t('isHealthCareWorker', 'Is healthcare worker')}
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
            {t('cancel', 'Cancel')}
          </Button>
          <Button kind="primary" type="submit">
            {t('submit', 'Submit')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default AddContactForm;
