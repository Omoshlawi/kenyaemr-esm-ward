import { type WardConfigObject } from '../../config-schema';
import {
  CARDEX_META_PREFIX,
  getOrderLabel,
  toEncounterDatetimeFromTime,
  type ActiveOrder,
} from './nursing-cardex-plan.resource';
import { type CardexFormValues } from './use-nursing-cardex-form-schema';

type NursingCardexConcepts = WardConfigObject['nursingCardex']['concepts'];
type NursingCardexFormFieldPaths = WardConfigObject['nursingCardex']['formFieldPaths'];

type BuildCardexEncounterPayloadArgs = {
  values: CardexFormValues;
  patientUuid: string;
  currentVisitUuid: string;
  sessionLocationUuid: string;
  currentProviderUuid: string;
  encounterRoleUuid: string;
  concepts: NursingCardexConcepts;
  formFieldPaths: NursingCardexFormFieldPaths;
  activeOrdersByUuid: Map<string, ActiveOrder>;
  activeOrdersByName: Map<string, ActiveOrder>;
};

function toCardexOrderMeta(order: ActiveOrder, concepts: NursingCardexConcepts) {
  return {
    metadataVersion: '2.0',
    orderUuid: order.uuid,
    orderDisplay: getOrderLabel(order),
    drugUuid: order.drug?.uuid,
    drugDisplay: order.drug?.display,
    dose: order.dose,
    doseUnits: order.doseUnits?.display,
    doseUnitsUuid: order.doseUnits?.uuid,
    route: order.route?.display,
    routeUuid: order.route?.uuid,
    frequency: order.frequency?.display,
    frequencyUuid: order.frequency?.uuid,
    quantity: order.quantity,
    quantityUnits: order.quantityUnits?.display,
    quantityUnitsUuid: order.quantityUnits?.uuid,
    duration: order.duration,
    durationUnits: order.durationUnits?.display,
    durationUnitsUuid: order.durationUnits?.uuid,
    provider: order.orderer?.person?.display || order.orderer?.display,
    ordererUuid: order.orderer?.uuid,
    ordererPersonUuid: order.orderer?.person?.uuid,
    conceptUuids: {
      encounterType: concepts.encounterType,
      form: concepts.formUuid,
      medicationGroup: concepts.medicationGivenGroup,
      fluidGroup: concepts.fluidsGivenGroup,
      nameField: concepts.nameField,
      timeField: concepts.timeField,
    },
  };
}

function buildObservationPayload({
  values,
  concepts,
  formFieldPaths,
  activeOrdersByUuid,
  activeOrdersByName,
}: Pick<
  BuildCardexEncounterPayloadArgs,
  'values' | 'concepts' | 'formFieldPaths' | 'activeOrdersByUuid' | 'activeOrdersByName'
>) {
  const observationPayload: Array<any> = [
    {
      concept: concepts.nursingNotes,
      value: values.nursingNotes,
      formFieldNamespace: 'O3',
      formFieldPath: formFieldPaths.nursingNotes,
    },
    {
      concept: concepts.actionTaken,
      value: values.medicationAdministered === 'yes' ? concepts.yes : concepts.no,
      formFieldNamespace: 'O3',
      formFieldPath: formFieldPaths.actionTaken,
    },
    {
      concept: concepts.actionTaken,
      value: values.fluidsAdministered === 'yes' ? concepts.yes : concepts.no,
      formFieldNamespace: 'O3',
      formFieldPath: formFieldPaths.actionTakenFluids,
    },
  ];

  if (values.medicationAdministered === 'yes') {
    values.medicationRows.forEach((row) => {
      if (!row.name?.trim() && !row.time?.trim()) {
        return;
      }

      const groupMembers: Array<any> = [];
      if (row.name?.trim()) {
        groupMembers.push({
          concept: concepts.nameField,
          value: row.name.trim(),
          formFieldNamespace: 'O3',
          formFieldPath: formFieldPaths.medicationName,
        });
      }

      const selectedOrder =
        (row.orderUuid ? activeOrdersByUuid.get(row.orderUuid) : undefined) ||
        activeOrdersByName.get(row.name?.trim()?.toLowerCase() ?? '');

      if (selectedOrder) {
        groupMembers.push({
          concept: concepts.nameField,
          value: `${CARDEX_META_PREFIX}${JSON.stringify(toCardexOrderMeta(selectedOrder, concepts))}`,
          formFieldNamespace: 'O3',
          formFieldPath: formFieldPaths.medicationMeta,
        });
      }

      const timeValue = toEncounterDatetimeFromTime(row.time);
      if (timeValue) {
        groupMembers.push({
          concept: concepts.timeField,
          value: timeValue,
          formFieldNamespace: 'O3',
          formFieldPath: formFieldPaths.medicationTime,
        });
      }

      if (groupMembers.length > 0) {
        observationPayload.push({
          concept: concepts.medicationGivenGroup,
          groupMembers,
          voided: false,
          formFieldNamespace: 'O3',
          formFieldPath: formFieldPaths.medicationGroup,
        });
      }
    });
  }

  if (values.fluidsAdministered === 'yes') {
    values.fluidRows.forEach((row) => {
      if (!row.name?.trim() && !row.time?.trim()) {
        return;
      }

      const groupMembers: Array<any> = [];
      if (row.name?.trim()) {
        groupMembers.push({
          concept: concepts.nameField,
          value: row.name.trim(),
          formFieldNamespace: 'O3',
          formFieldPath: formFieldPaths.fluidName,
        });
      }

      const selectedOrder =
        (row.orderUuid ? activeOrdersByUuid.get(row.orderUuid) : undefined) ||
        activeOrdersByName.get(row.name?.trim()?.toLowerCase() ?? '');

      if (selectedOrder) {
        groupMembers.push({
          concept: concepts.nameField,
          value: `${CARDEX_META_PREFIX}${JSON.stringify(toCardexOrderMeta(selectedOrder, concepts))}`,
          formFieldNamespace: 'O3',
          formFieldPath: formFieldPaths.fluidMeta,
        });
      }

      const timeValue = toEncounterDatetimeFromTime(row.time);
      if (timeValue) {
        groupMembers.push({
          concept: concepts.timeField,
          value: timeValue,
          formFieldNamespace: 'O3',
          formFieldPath: formFieldPaths.fluidTime,
        });
      }

      if (groupMembers.length > 0) {
        observationPayload.push({
          concept: concepts.fluidsGivenGroup,
          groupMembers,
          voided: false,
          formFieldNamespace: 'O3',
          formFieldPath: formFieldPaths.fluidGroup,
        });
      }
    });
  }

  return observationPayload;
}

export function buildNursingCardexEncounterPayload({
  values,
  patientUuid,
  currentVisitUuid,
  sessionLocationUuid,
  currentProviderUuid,
  encounterRoleUuid,
  concepts,
  formFieldPaths,
  activeOrdersByUuid,
  activeOrdersByName,
}: BuildCardexEncounterPayloadArgs) {
  return {
    encounterProviders: [
      {
        provider: currentProviderUuid,
        encounterRole: encounterRoleUuid,
      },
    ],
    patient: patientUuid,
    visit: currentVisitUuid,
    location: sessionLocationUuid,
    encounterType: concepts.encounterType,
    form: concepts.formUuid,
    obs: buildObservationPayload({
      values,
      concepts,
      formFieldPaths,
      activeOrdersByUuid,
      activeOrdersByName,
    }),
    orders: [],
    diagnoses: [],
  };
}
