import {
  getDefaultsFromConfigSchema,
  type Location,
  showSnackbar,
  useAppContext,
  useConfig,
  useFeatureFlag,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockAdmissionLocation, mockLocationInpatientWard, mockPatientAlice, mockVisitAlice } from '__mocks__';
import React from 'react';
import { mockWardViewContext } from '../../mock';
import { configSchema, type WardConfigObject } from '../config-schema';
import useWardLocation from '../hooks/useWardLocation';
import { type WardPatient, type WardViewContext } from '../types';
import { useAdmitPatient } from '../ward.resource';
import AdmitPatientButton from './admit-patient-button.component';

const defaultConfig: WardConfigObject = getDefaultsFromConfigSchema(configSchema);
const pediatricWardTagUuid = defaultConfig.inpatientLocationTags.pediatricWard;

jest.mocked(useConfig<WardConfigObject>).mockReturnValue(defaultConfig);

jest.mock('../hooks/useWardLocation', () => jest.fn());
jest.mocked(useWardLocation).mockReturnValue({
  location: mockLocationInpatientWard,
  isLoadingLocation: false,
  errorFetchingLocation: null,
  invalidLocation: false,
});

jest.mock('../ward.resource', () => ({
  useAdmitPatient: jest.fn(),
}));
const mockedUseAdmitPatient: ReturnType<typeof useAdmitPatient> = {
  admitPatient: jest.fn(),
  isLoadingEmrConfiguration: false,
  errorFetchingEmrConfiguration: false,
};
jest.mocked(useAdmitPatient).mockReturnValue(mockedUseAdmitPatient);
const mockedAdmitPatient = jest.mocked(mockedUseAdmitPatient.admitPatient);
// @ts-ignore - we only need these two keys for now
mockedAdmitPatient.mockResolvedValue({ ok: true, data: { uuid: 'encounter-uuid' } });

const mockedShowSnackbar = jest.mocked(showSnackbar);
const mockedUseAppContext = jest.mocked(useAppContext<WardViewContext>);

// The bed management module is not installed, so `onAdmit` admits directly instead of
// launching the bed selection workspace.
jest.mocked(useFeatureFlag).mockReturnValue(false);

/**
 * Returns the ward view context with the given location tags applied to the ward, so we can
 * exercise the pediatric ward check without mutating the shared mocks.
 */
function wardViewContextWithTags(tags: Location['tags']): WardViewContext {
  const { wardPatientGroupDetails } = mockWardViewContext;
  return {
    ...mockWardViewContext,
    wardPatientGroupDetails: {
      ...wardPatientGroupDetails,
      admissionLocationResponse: {
        ...wardPatientGroupDetails.admissionLocationResponse,
        admissionLocation: {
          ...mockAdmissionLocation,
          ward: { ...mockLocationInpatientWard, tags },
        },
      },
    },
  };
}

const pediatricWardContext = wardViewContextWithTags([{ uuid: pediatricWardTagUuid, display: 'Pediatric Ward' }]);

/** No beds and bed management off: Admit writes the encounter directly instead of opening the bed form. */
function withoutBeds(context: WardViewContext): WardViewContext {
  const details = context.wardPatientGroupDetails;
  return {
    ...context,
    wardPatientGroupDetails: details ? { ...details, bedLayouts: [] } : details,
  };
}

const mockAdultWardPatient: WardPatient = {
  patient: mockPatientAlice,
  visit: mockVisitAlice,
  bed: null,
  inpatientAdmission: null,
  inpatientRequest: null,
};

const mockChildWardPatient: WardPatient = {
  ...mockAdultWardPatient,
  patient: { ...mockPatientAlice, person: { ...mockPatientAlice.person, age: 5 } },
};

function renderAdmitPatientButton(wardPatient: WardPatient) {
  render(<AdmitPatientButton wardPatient={wardPatient} dispositionType="ADMIT" onAdmitPatientSuccess={jest.fn()} />);
}

describe('AdmitPatientButton', () => {
  it('should not admit a patient older than 12 to a pediatric ward', async () => {
    const user = userEvent.setup();
    mockedUseAppContext.mockReturnValue(pediatricWardContext);

    renderAdmitPatientButton(mockAdultWardPatient);
    await user.click(screen.getByRole('button', { name: /admit patient/i }));

    expect(mockedShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle: 'Patients older than 12 years cannot be admitted to the pediatric ward',
      }),
    );
    expect(mockedAdmitPatient).not.toHaveBeenCalled();
  });

  it('should admit a patient aged 12 or under to a pediatric ward', async () => {
    const user = userEvent.setup();
    mockedUseAppContext.mockReturnValue(withoutBeds(pediatricWardContext));

    renderAdmitPatientButton(mockChildWardPatient);
    await user.click(screen.getByRole('button', { name: /admit patient/i }));

    expect(mockedAdmitPatient).toHaveBeenCalledWith(mockChildWardPatient.patient, 'ADMIT', mockVisitAlice.uuid);
    expect(mockedShowSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });

  it('should admit a patient older than 12 to a ward that is not a pediatric ward', async () => {
    const user = userEvent.setup();
    mockedUseAppContext.mockReturnValue(withoutBeds(mockWardViewContext));

    renderAdmitPatientButton(mockAdultWardPatient);
    await user.click(screen.getByRole('button', { name: /admit patient/i }));

    expect(mockedAdmitPatient).toHaveBeenCalledWith(mockAdultWardPatient.patient, 'ADMIT', mockVisitAlice.uuid);
    expect(mockedShowSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });
});
