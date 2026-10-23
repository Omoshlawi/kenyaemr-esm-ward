import {
  type FetchResponse,
  openmrsFetch,
  type Patient,
  type Person,
  restBaseUrl,
  type Session,
  showSnackbar,
} from '@openmrs/esm-framework';
import { type TFunction } from 'react-i18next';
import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';
import { z } from 'zod';
import { type WardConfigObject } from '../../../config-schema';
import { type RelationshipType } from './contact-list.types';

const personShema = z.object({
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
    person: z.union([z.string().nonempty('Required').uuid(), personShema]),
    caseId: z.string().uuid(),
  })
  .superRefine((arg, ctx) => {
    if (arg.isHealthCareWorker === 'Y' && !arg.facility) {
      ctx.addIssue({ code: 'custom', path: ['facility'], message: 'Required' });
    }
  });

export type ContactListFormValues = z.infer<typeof contactListSchema>;
export type ContactListPersonFormValues = z.infer<typeof personShema>;

async function fetchPerson(query: string, abortController: AbortController) {
  const customREp = 'custom:(uuid,identifiers,person:(uuid,display,gender,age,birthdate,attributes))';
  const patientsRes = await openmrsFetch<{ results: Array<Patient> }>(
    `${restBaseUrl}/patient?q=${query}&v=${customREp}`,
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
      subtitle: (error as any)?.message,
    });
  }
}

async function createPatient(
  patientData: ContactListPersonFormValues &
    Pick<ContactListFormValues, 'typeOfContact' | 'headOfHouseHold' | 'facility' | 'isHealthCareWorker'>,
  identifier: string,
  config: WardConfigObject,
  session: Session,
  t: TFunction,
) {
  try {
    const response = await openmrsFetch<Patient>(`/ws/rest/v1/patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifiers: [
          {
            identifier: identifier,
            identifierType: config.openmrsIDUuid,
            location: session.sessionLocation?.uuid,
          },
        ],
        person: {
          names: [
            {
              givenName: patientData.givenName,
              middleName: patientData.middleName,
              familyName: patientData.familyName,
            },
          ],
          gender: patientData.gender,
          birthdate: patientData.birthdate,
          addresses: [
            {
              preferred: true,
              address1: patientData.address,
              countyDistrict: patientData.county,
              stateProvince: patientData.subcounty,
            },
          ],
          dead: false,
          attributes: [
            ...(patientData.phoneNumber
              ? [
                  {
                    attributeType: config.contactPersonAttributesUuid.telephone,
                    value: patientData.phoneNumber,
                  },
                ]
              : []),
            ...(patientData.typeOfContact
              ? [
                  {
                    attributeType: config.contactPersonAttributesUuid.contactTypeAttributeType,
                    value: patientData.typeOfContact.join(','),
                  },
                ]
              : []),
            ...(patientData.headOfHouseHold
              ? [
                  {
                    attributeType: config.contactPersonAttributesUuid.headOfHouseholdAttributeType,
                    value: patientData.headOfHouseHold,
                  },
                ]
              : []),
            ...(patientData.isHealthCareWorker && patientData.facility
              ? [
                  {
                    attributeType: config.contactPersonAttributesUuid.healthCareWorkerFacilityAttributetype,
                    value: patientData.facility,
                  },
                ]
              : []),
          ],
        },
      }),
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
      subtitle: (error as any)?.message,
    });
  }
}

async function createRelationship(contactData: ContactListFormValues, contactPatient: string, t: TFunction) {
  try {
    const res = await openmrsFetch(`/ws/rest/v1/relationship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: contactData.dateofLastContact,
        personA: contactData.caseId,
        relationshipType: contactData.relationToCase,
        personB: contactPatient,
      }),
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
      subtitle: (error as any)?.message,
    });
  }
}

async function updateAttribute<T = string>(
  person: string,
  atrributeType: string,
  value: (currentAttributeValue?: T) => T,
) {
  const url = `${restBaseUrl}/person/${person}/attribute`;
  const res = await openmrsFetch<{ results: Person['attributes'] }>(url);
  const attribute = (res.data.results ?? []).find((attr) => attr.attributeType?.uuid === atrributeType);
  if (attribute) {
    const _value = value(attribute.value as T);
    if (_value === undefined || _value === null) return;
    return await openmrsFetch(`${url}/${attribute.uuid}`, {
      body: JSON.stringify({ attributeType: atrributeType, value: _value }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  const _value = value();
  if (_value === undefined || _value === null) return;
  return await openmrsFetch(url, {
    body: JSON.stringify({ attributeType: atrributeType, value: _value }),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

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
    const personPayload: ContactListPersonFormValues &
      Pick<ContactListFormValues, 'typeOfContact' | 'headOfHouseHold' | 'facility' | 'isHealthCareWorker'> = {
      ...(data.person as ContactListPersonFormValues),
      typeOfContact: data.typeOfContact,
      headOfHouseHold: data.headOfHouseHold,
      facility: data.facility,
      isHealthCareWorker: data.isHealthCareWorker,
    };
    const patient_ = await createPatient(personPayload, identifier, config, session, t);
    if (!patient_) return;
    patient = patient_.uuid;
  }
  if (data.mode === 'search') {
    await updateAttribute<string | undefined>(
      patient,
      config.contactPersonAttributesUuid.contactTypeAttributeType,
      (attr) => {
        return data.typeOfContact.join(',');
      },
    );
    await updateAttribute<string | undefined>(
      patient,
      config.contactPersonAttributesUuid.headOfHouseholdAttributeType,
      (attr) => {
        return data.headOfHouseHold;
      },
    );
    await updateAttribute<string | undefined>(
      patient,
      config.contactPersonAttributesUuid.healthCareWorkerFacilityAttributetype,
      (attr) => {
        return data.isHealthCareWorker ? data.facility : undefined;
      },
    );
  }
  await createRelationship(data, patient, t);
};
