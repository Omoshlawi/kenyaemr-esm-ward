import {
  type FetchResponse,
  launchWorkspace2,
  openmrsFetch,
  type Person,
  restBaseUrl,
  showModal,
  showSnackbar,
  useConfig,
} from '@openmrs/esm-framework';
import { type WardConfigObject } from '../../../config-schema';
import { type Relationship, type Contact } from './contact-list.types';
import dayjs from 'dayjs';
import useSWR, { mutate } from 'swr';
import { type TFunction, useTranslation } from 'react-i18next';
import { useMemo } from 'react';

export const useContactTypeMapping = () => {
  const {
    contactTypesConceptUuids: {
      hadDirectPhysicalContactWithCase,
      sleptOrAteAtTheSameHouseHoldAsCase,
      touchedBodyFluidsOfCase,
      touchedOrCleanedLinensOrDishesOfCase,
    },
  } = useConfig<WardConfigObject>();
  return {
    ContactTypeMapping: {
      [touchedBodyFluidsOfCase]: 'Touched body fluids of the case (blood, vomit, saliva, urine, feces)',
      [hadDirectPhysicalContactWithCase]: 'Had direct physical contact with body of the case (alive or dead)',
      [touchedOrCleanedLinensOrDishesOfCase]: 'Touched or cleaned the linens, clothes, or dishes of the case',
      [sleptOrAteAtTheSameHouseHoldAsCase]: 'Slept or ate in the same household as the case',
    },
    DisplayMapping: {
      [touchedBodyFluidsOfCase]: '1',
      [hadDirectPhysicalContactWithCase]: '2',
      [touchedOrCleanedLinensOrDishesOfCase]: '3',
      [sleptOrAteAtTheSameHouseHoldAsCase]: '4',
    },
  };
};

const mapContact = (
  person: Person,
  lastContactDate: string,
  relationShipType: string,
  relationShipUuid: string,
  config: WardConfigObject,
): Contact => {
  return {
    uuid: person.uuid,
    surname: person.preferredName?.familyName,
    otherNames: [person.preferredName?.givenName, person.preferredName?.middleName].filter(Boolean).join(', '),
    sex: person.gender,
    age: person.age,
    relationToCase: relationShipType,
    dateofLastContact: dayjs(lastContactDate).format('DD-MM-YYYY'),
    address: person.preferredAddress?.address1,
    county: person.preferredAddress?.countyDistrict,
    subcounty: person.preferredAddress?.stateProvince,
    phoneNumber: person.attributes?.find(
      (att) => att.attributeType?.uuid === config.contactPersonAttributesUuid.telephone,
    )?.value,
    headOfHouseHold: person.attributes?.find(
      (att) => att.attributeType?.uuid === config.contactPersonAttributesUuid.headOfHouseholdAttributeType,
    )?.value,
    typeOfContact: person.attributes?.find(
      (att) => att.attributeType?.uuid === config.contactPersonAttributesUuid.contactTypeAttributeType,
    )?.value,
    isHealthCareWorker: person.attributes?.find(
      (att) => att.attributeType?.uuid === config.contactPersonAttributesUuid.healthCareWorkerFacilityAttributetype,
    )?.value
      ? 'Y'
      : 'N',
    facility: person.attributes?.find(
      (att) => att.attributeType?.uuid === config.contactPersonAttributesUuid.healthCareWorkerFacilityAttributetype,
    )?.value,
    relationShipUuid,
  };
};

export const useRelationships = (patientUuid: string) => {
  const person =
    '(uuid,preferredName,age,display,dead,causeOfDeath,gender,attributes:(uuid,display,value,attributeType:(uuid,display)),preferredAddress)';
  const customeRepresentation =
    `custom:(display,uuid,personA:(person:${person})` +
    `,personB:(person:${person}),` +
    'relationshipType:(uuid,display,description,aIsToB,bIsToA,displayAIsToB,displayBIsToA),startDate)';

  const url = `/ws/rest/v1/relationship?v=${customeRepresentation}&person=${patientUuid}`;
  const config = useConfig<WardConfigObject>();
  const { data, error, isLoading } = useSWR<FetchResponse<{ results: Array<Relationship> }>>(url, openmrsFetch);
  const { t } = useTranslation();
  const headers = useMemo(
    () => [
      {
        header: t('surname', 'Surname'),
        key: 'surname',
      },
      {
        header: t('otherNames', 'Other names'),
        key: 'otherNames',
      },
      {
        header: t('sex', 'Sex'),
        key: 'sex',
      },
      {
        header: t('age', 'Age'),
        key: 'age',
      },
      {
        header: t('relationToCase', 'Relationship to case'),
        key: 'relationToCase',
      },
      {
        header: t('dateofLastContact', 'Date of last contact'),
        key: 'dateofLastContact',
      },
      {
        header: t('typeOfContact', 'Type of contact'),
        key: 'typeOfContact',
      },
      {
        header: t('headOfHouseHold', 'Head of household'),
        key: 'headOfHouseHold',
      },
      {
        header: t('address', 'Address'),
        key: 'address',
      },
      {
        header: t('county', 'County'),
        key: 'county',
      },
      {
        header: t('subcounty', 'Sub County'),
        key: 'subcounty',
      },
      {
        header: t('phoneNumber', 'Phone number'),
        key: 'phoneNumber',
      },
      {
        header: t('isHealthCareWorker', 'Is health care worker'),
        key: 'isHealthCareWorker',
      },
      {
        header: t('facility', 'Facility'),
        key: 'facility',
      },
      {
        header: t('actions', 'Actions'),
        key: 'actions',
      },
    ],
    [t],
  );
  const contacts = useMemo(() => {
    const relationships = data?.data?.results ?? [];
    return relationships.map<Contact>((relationship) => {
      if (patientUuid === relationship.personA.person.uuid) {
        return mapContact(
          relationship.personB.person,
          relationship.startDate,
          relationship.relationshipType.displayBIsToA,
          relationship.uuid,
          config,
        );
      } else {
        return mapContact(
          relationship.personA.person,
          relationship.startDate,
          relationship.relationshipType.displayAIsToB,
          relationship.uuid,
          config,
        );
      }
    });
  }, [config, data?.data?.results, patientUuid]);

  return {
    isLoading,
    error,
    relationships: data?.data?.results ?? [],
    contacts,
    headers,
  };
};

export const deleteRelationship = async (relationshipUuid: string, t: TFunction) => {
  const dispose = showModal('relationship-delete-confirm-dialog', {
    onClose: () => dispose(),
    onDelete: async () => {
      try {
        const url = `${restBaseUrl}/relationship/${relationshipUuid}`;
        await openmrsFetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        mutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/relationship`));
        dispose();
        showSnackbar({
          title: t('success', 'Success'),
          kind: 'success',
          subtitle: t('relationshipDeleted', 'Relationship deleted successfully!'),
        });
      } catch (e) {
        showSnackbar({
          title: t('error', 'Error'),
          kind: 'error',
          subtitle: t('errorDeletingRelationship', 'Error deleting relationship'),
        });
      }
    },
  });
};

export const handleLaunchContactTracingForm = (contactUuid: string, formUuid: string) => {
  launchWorkspace2('kenyaemr-custom-form-entry-workspace', {
    formUuid,
    patientUuid: contactUuid,
    encounterUuid: '',
    mutateForm: () => {
      mutate((key) => true, undefined, {
        revalidate: true,
      });
    },
  });
};
