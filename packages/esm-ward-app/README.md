# Ward App

The `Ward` app is a frontend module that enables users to manage patients (typically inpatients) within a ward. The ward app presents a view in which all patients currently present on the ward are displayed as cards, with a workspace from which one can view patients who are waiting to be admitted to the ward or where users can search for patients to admit to the ward. Users can also view the details of any patient currently on the ward and perform actions including transferring to another ward or to a bed on the current ward, to complete a form, view a patient summary, or any number of other chart-related actions.

## Backend Configuration

The `Ward` app brings together functionality from several back-end modules and requires a fair amount of back-end configuration to get up and running. The most extensive set of configurations are necessary to enable the system to represent ADT workflow events within the EMR API module.

### EMR API

The EMR API module supports configuration of all ADT workflows, including encounter types that represent Admissions, Transfers, and Discharges, and Disposition observations that represent requests for Admission, Discharge, and Transfer.

The EMR API module also supports a range of other metadata configurations that the ward app may require.

To test whether one's system is properly configured, one can use the REST API to try to retrieve the EMR API configuration object. This response must be successful and properly configured.

Please see the [EMR API Configuration overview page](https://rest.openmrs.org/#emrapi-configuration) in the REST API documentation for details of what the EMR API configuration contains.

Please see the [EMR API README](https://github.com/openmrs/openmrs-module-emrapi) for specific details on how the EMR API module should be configured.

## Frontend Configuration

See the [config-schema](./src/config-schema.ts) for details on the configuration options available to the ward app.

## Ward Patient Table Tab Extension Slots

The default ward table view renders four fixed tabs (Awaiting Admission, Admitted, Discharge In, Discharged). Each tab panel is backed by an extension slot so implementers can replace the default table UI without forking the ward app.

| Tab | Slot name | Default extension name |
|-----|-----------|------------------------|
| Awaiting Admission | `ward-patients-awaiting-admission-slot` | `ward-patients-awaiting-admission` |
| Admitted | `ward-patients-admitted-slot` | `ward-patients-admitted` |
| Discharge In | `ward-patients-discharge-in-slot` | `ward-patients-discharge-in` |
| Discharged | `ward-patients-discharged-slot` | `ward-patients-discharged` |

### Custom component requirements

- Render under `DefaultWardView` so `useAppContext('ward-view-context')` provides ward patient data.
- Reuse types from [`src/types/index.ts`](./src/types/index.ts): `WardViewContext`, `WardPatient`, etc.
- Optional shared UI helpers: `HyperLinkPatientCell`, `EmptyState`, `ErrorState`, `getOpenmrsId`.

### Replacing a default table

In your module's `routes.json`, register the replacement extension:

```json
{
  "name": "my-custom-awaiting-admission",
  "component": "myAwaitingAdmissionTable",
  "slot": "ward-patients-awaiting-admission-slot"
}
```

The default table components are exported from this module (`wardPatientsAwaitingAdmissionTable`, `wardPatientsAdmittedTable`, `wardPatientsDischargeInTable`, `wardPatientsDischargedTable`) if you need to wrap or extend them.

## Bed Management

The ward app is designed to support patient bed assignments and to be used in conjunction with the bedmanagement module and the bed-management-app ESM. However, bed management is entirely optional. Patients will appear on a ward if they:

* Are considered admitted to the current session location by the EMR API module
* Are assigned to a bed in the current session location within the Bed Management module

Patients may appear on the ward who are not admitted if they are only assigned to a bed. Patients may also appear on the ward who are admitted and not assigned to a bed.

## Related Documentation

* [OpenMRS REST API Documentation](https://rest.openmrs.org)
* [EMR API Module](https://github.com/openmrs/openmrs-module-emrapi)
* [Bed Management Module](https://github.com/openmrs/openmrs-module-bedmanagement)
