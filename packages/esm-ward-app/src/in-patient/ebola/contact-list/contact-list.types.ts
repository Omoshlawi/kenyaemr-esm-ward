import { type Person } from '@openmrs/esm-framework';

export interface RelationshipType {
  uuid: string;
  display: string;
  displayAIsToB: string;
  displayBIsToA: string;
  description: string;
  aIsToB: string;
  bIsToA: string;
}

export interface Relationship {
  display: string;
  uuid: string;
  personA: { person: Person };
  personB: { person: Person };
  relationshipType: RelationshipType;
  startDate: string;
}

export interface Contact {
  uuid: string;
  surname?: string;
  otherNames?: string;
  sex?: string;
  age?: number;
  relationToCase?: string;
  dateofLastContact?: string;
  typeOfContact?: string;
  headOfHouseHold?: string;
  address?: string;
  county?: string;
  subcounty?: string;
  longitude?: string;
  latitude?: string;
  phoneNumber?: string;
  isHealthCareWorker?: string;
  facility?: string;
  relationShipUuid: string;
}
