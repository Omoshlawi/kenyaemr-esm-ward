import {
  type FetchResponse,
  openmrsFetch,
  type Patient,
  type Person,
  restBaseUrl,
  type Session,
  showSnackbar,
} from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { type TFunction } from 'react-i18next';
import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';
import { z } from 'zod';
import { type WardConfigObject } from '../../../config-schema';
import { type RelationshipType } from './contact-list.types';

export const personSchema = z.object({
  givenName: z.string().min(1, 'Given name required'),
  middleName: z.string().optional(),
  familyName: z.string().min(1, 'Family name required'),
  gender: z.enum(['M', 'F']),
  birthdate: z.date({ coerce: true }).max(new Date(), 'Must not be a future date'),
  address: z.string().optional(),
  county: z.string().optional(),
  subcounty: z.string().optional(),
  longitude: z.number().optional(),
  latitude: z.number().optional(),
  phoneNumber: z.string().optional(),
});

export const contactListSchema = z
  .object({
    mode: z.enum(['search', 'create']),
    relationToCase: z.string().nonempty('Required').uuid(),
    dateofLastContact: z.date({ coerce: true }).max(new Date(), 'Must not be a future date'),
    typeOfContact: z.string().array(),
    headOfHouseHold: z.string().optional(),
    isHealthCareWorker: z.enum(['Y', 'N']),
    facility: z.string().optional(),
    person: z.union([z.string().nonempty('Required').uuid(), personSchema]),
    caseId: z.string().uuid(),
  })
  .superRefine((arg, ctx) => {
    if (arg.isHealthCareWorker === 'Y' && !arg.facility) {
      ctx.addIssue({ code: 'custom', path: ['facility'], message: 'Required' });
    }
  });

export type ContactListFormValues = z.infer<typeof contactListSchema>;
export type ContactListPersonFormValues = z.infer<typeof personSchema>;

async function fetchPerson(query: string, abortController: AbortController) {
  const customRep =
    'custom:(uuid,identifiers:(identifier,preferred,identifierType:(uuid,display)),person:(uuid,display,gender,age,birthdate,attributes))';
  const patientsRes = await openmrsFetch<{ results: Array<Patient> }>(
    `${restBaseUrl}/patient?q=${query}&v=${customRep}`,
    {
      signal: abortController.signal,
    },
  );
  return patientsRes?.data?.results ?? [];
}
export const searchPatient = async (query: string) => {
  const abortController = new AbortController();
  return await fetchPerson(query, abortController);
};

const getRestErrorMessage = (error: unknown) => {
  const body = (
    error as {
      responseBody?: { error?: { message?: string; fieldErrors?: Record<string, Array<{ message?: string }>> } };
    }
  )?.responseBody?.error;
  const fieldError = Object.values(body?.fieldErrors ?? {})
    .flat()
    .find((item) => item?.message)?.message;
  return fieldError || body?.message || (error as { message?: string })?.message;
};

export const useAddressHierachy = (search: string) => {
  const url = `/module/addresshierarchy/ajax/getChildAddressHierarchyEntries.form?searchString=${search}`;
  const { data, error, isLoading } = useSWR<FetchResponse<Array<{ name: string }>>>(url, openmrsFetch);
  return {
    isLoading,
    error,
    addresses: data?.data ?? [],
  };
};

export const useRelationshipTypes = () => {
  const url = `${restBaseUrl}/relationshiptype?v=default`;
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<{ results: Array<RelationshipType> }>>(
    url,
    openmrsFetch,
  );

  return { relationshipTypes: data?.data?.results ?? [], error, isLoading };
};

async function generateOpenmrsIdentifier(source: string, t: TFunction) {
  const abortController = new AbortController();
  try {
    const res = await openmrsFetch<{ identifier: string }>(
      `${restBaseUrl}/idgen/identifiersource/${source}/identifier`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: {},
        signal: abortController.signal,
      },
    );
    showSnackbar({
      title: t('identifier', 'Identifier'),
      kind: 'success',
      subtitle: t('patientIdentifierCreated', 'Patient identifier created successfully!'),
    });
    return res.data.identifier;
  } catch (error) {
    showSnackbar({
      kind: 'error',
      title: t('errorCreatingIdentifier', 'Error creating identifier'),
      subtitle: getRestErrorMessage(error),
    });
  }
}

const toPersonAttributeValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const toIsoDate = (value?: Date | string | null) => {
  if (!value) {
    return undefined;
  }
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD') : undefined;
};

const personAttributeTypeExists = async (uuid?: string) => {
  if (!uuid) {
    return false;
  }
  try {
    const res = await openmrsFetch<{ uuid?: string }>(`${restBaseUrl}/personattributetype/${uuid}`);
    return Boolean(res?.data?.uuid);
  } catch {
    return false;
  }
};

const filterExistingPersonAttributes = async (attributes: Array<{ attributeType: string; value: string }>) => {
  const existing = await Promise.all(
    attributes.map(async (attribute) =>
      (await personAttributeTypeExists(attribute.attributeType)) ? attribute : null,
    ),
  );
  return existing.filter((attribute): attribute is { attributeType: string; value: string } => Boolean(attribute));
};

const getPersonAttributeTypeUuid = (attribute: { attributeType?: string | { uuid?: string } }) =>
  typeof attribute.attributeType === 'string' ? attribute.attributeType : attribute.attributeType?.uuid;

const joinContactTypes = (typeOfContact?: string[]) =>
  Array.isArray(typeOfContact) && typeOfContact.length ? typeOfContact.filter(Boolean).join(',') : undefined;

type ContactPersonAttributeSource = {
  phoneNumber?: string;
  typeOfContact?: string[];
  headOfHouseHold?: string;
  facility?: string;
  isHealthCareWorker?: ContactListFormValues['isHealthCareWorker'];
};

const buildPersonAttributes = (patientData: ContactPersonAttributeSource, config: WardConfigObject) =>
  [
    {
      attributeType: config.contactPersonAttributesUuid.telephone,
      value: toPersonAttributeValue(patientData.phoneNumber),
    },
    {
      attributeType: config.contactPersonAttributesUuid.contactTypeAttributeType,
      value: toPersonAttributeValue(joinContactTypes(patientData.typeOfContact)),
    },
    {
      attributeType: config.contactPersonAttributesUuid.headOfHouseholdAttributeType,
      value: toPersonAttributeValue(patientData.headOfHouseHold),
    },
    {
      attributeType: config.contactPersonAttributesUuid.healthCareWorkerFacilityAttributetype,
      value: patientData.isHealthCareWorker === 'Y' ? toPersonAttributeValue(patientData.facility) : undefined,
    },
  ].filter((attribute): attribute is { attributeType: string; value: string } =>
    Boolean(attribute.attributeType && attribute.value),
  );

async function createPatient(
  patientData: ContactListPersonFormValues,
  identifier: string,
  config: WardConfigObject,
  session: Session,
  t: TFunction,
) {
  try {
    const middleName = toPersonAttributeValue(patientData.middleName);
    const attributes = await filterExistingPersonAttributes(
      buildPersonAttributes({ phoneNumber: patientData.phoneNumber }, config),
    );
    const response = await openmrsFetch<Patient>(`${restBaseUrl}/patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        identifiers: [
          {
            identifier,
            identifierType: config.openmrsIDUuid,
            location: session.sessionLocation?.uuid,
            preferred: true,
          },
        ],
        person: {
          names: [
            {
              givenName: patientData.givenName.trim(),
              familyName: patientData.familyName.trim(),
              preferred: true,
              ...(middleName ? { middleName } : {}),
            },
          ],
          gender: patientData.gender,
          birthdate: toIsoDate(patientData.birthdate),
          addresses: [
            {
              preferred: true,
              address1: toPersonAttributeValue(patientData.address),
              countyDistrict: toPersonAttributeValue(patientData.county),
              stateProvince: toPersonAttributeValue(patientData.subcounty),
            },
          ],
          dead: false,
          attributes,
        },
      },
    });
    showSnackbar({
      title: t('patient', 'Patient'),
      kind: 'success',
      subtitle: t('patientCreated', 'Patient created successfully!'),
    });
    return response.data;
  } catch (error) {
    showSnackbar({
      kind: 'error',
      title: t('errorCreatingPatient', 'Error creating patient'),
      subtitle: getRestErrorMessage(error),
    });
  }
}

async function createRelationship(contactData: ContactListFormValues, contactPatient: string, t: TFunction) {
  try {
    const res = await openmrsFetch(`${restBaseUrl}/relationship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        startDate: toIsoDate(contactData.dateofLastContact),
        personA: contactData.caseId,
        relationshipType: contactData.relationToCase,
        personB: contactPatient,
      },
    });
    showSnackbar({
      title: t('relationship', 'Relationship'),
      kind: 'success',
      subtitle: t('relationshipCreated', 'Relationship created successfully!'),
    });
  } catch (error) {
    showSnackbar({
      kind: 'error',
      title: t('errorCreatingRelationship', 'Error creating relationship'),
      subtitle: getRestErrorMessage(error),
    });
  }
}

async function updateAttribute(person: string, attributeType: string | undefined, value?: string | null) {
  const nextValue = toPersonAttributeValue(value);
  if (!person || !attributeType || !nextValue) {
    return;
  }

  const url = `${restBaseUrl}/person/${person}/attribute?v=custom:(uuid,value,attributeType:(uuid))`;
  const res = await openmrsFetch<{ results: Person['attributes'] }>(url);
  const attribute = (res.data.results ?? []).find((attr) => getPersonAttributeTypeUuid(attr) === attributeType);
  const headers = { 'Content-Type': 'application/json' };

  if (attribute) {
    return await openmrsFetch(`${restBaseUrl}/person/${person}/attribute/${attribute.uuid}`, {
      body: { value: nextValue },
      method: 'POST',
      headers,
    });
  }

  return await openmrsFetch(`${restBaseUrl}/person/${person}/attribute`, {
    body: { attributeType, value: nextValue },
    method: 'POST',
    headers,
  });
}

const saveExistingPatientAttributes = async (person: string, data: ContactListFormValues, config: WardConfigObject) => {
  const attributes = await filterExistingPersonAttributes(
    buildPersonAttributes(
      {
        typeOfContact: data.typeOfContact,
        headOfHouseHold: data.headOfHouseHold,
        facility: data.facility,
        isHealthCareWorker: data.isHealthCareWorker,
      },
      config,
    ),
  );

  let firstError: unknown;
  for (const attribute of attributes) {
    try {
      await updateAttribute(person, attribute.attributeType, attribute.value);
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) {
    throw firstError;
  }
};

export const createContact = async (
  data: ContactListFormValues,
  config: WardConfigObject,
  t: TFunction,
  session: Session,
) => {
  let patient: string = data.person as string;
  if (data.mode === 'create') {
    const identifier = await generateOpenmrsIdentifier(config.openmrsIdentifierSourceUuid, t);
    if (!identifier) return;
    const patient_ = await createPatient(data.person as ContactListPersonFormValues, identifier, config, session, t);
    if (!patient_) return;
    patient = patient_.uuid;
  }

  await createRelationship(data, patient, t);

  try {
    await saveExistingPatientAttributes(patient, data, config);
  } catch (error) {
    showSnackbar({
      kind: 'warning',
      title: t('errorSavingContactDetails', 'Error saving contact details'),
      subtitle: getRestErrorMessage(error),
    });
  }
};
