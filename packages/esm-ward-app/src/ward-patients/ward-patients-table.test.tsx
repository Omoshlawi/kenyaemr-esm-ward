import { ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithSwr } from '../../../../tools/test-utils';
import { useCriticalCareWardTab } from '../hooks/useCriticalCareWardTab';
import WardPatientsTable, { WARD_PATIENTS_CRITICAL_CARE_SLOT } from './ward-patients-table';

jest.mock('../hooks/useCriticalCareWardTab', () => ({
  useCriticalCareWardTab: jest.fn(),
}));

jest.mock('./awaiting-admission-patients', () => () => <div>AwaitingAdmissionPatients</div>);
jest.mock('./admitted-patients', () => () => <div>AdmittedPatients</div>);
jest.mock('./discharge-in-patients', () => () => <div>DischargeInPatients</div>);
jest.mock('./discharge-patients', () => () => <div>DischargePatients</div>);

const mockUseCriticalCareWardTab = jest.mocked(useCriticalCareWardTab);

describe('WardPatientsTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCriticalCareWardTab.mockReturnValue({
      tab: null,
      locationUuid: undefined,
      isLoading: false,
    });
    jest.mocked(useAssignedExtensions).mockReturnValue([{ name: 'mock-extension' } as any]);
    jest
      .mocked(ExtensionSlot)
      .mockImplementation(({ name }: { name: string }) => <div data-testid={`extension-slot-${name}`}>{name}</div>);
  });

  it('renders the four standard admissions tabs', () => {
    renderWithSwr(<WardPatientsTable />);

    expect(screen.getByText('Awaiting Admission')).toBeInTheDocument();
    expect(screen.getByText('Admitted')).toBeInTheDocument();
    expect(screen.getByText('Discharge In')).toBeInTheDocument();
    expect(screen.getByText('Discharged')).toBeInTheDocument();
    expect(screen.queryByText('ICU')).not.toBeInTheDocument();
  });

  it('shows a critical-care tab next to Discharged when the selected ward matches', () => {
    mockUseCriticalCareWardTab.mockReturnValue({
      tab: { kind: 'icu', label: 'ICU' },
      locationUuid: 'icu-location-uuid',
      isLoading: false,
    });

    renderWithSwr(<WardPatientsTable />);

    expect(screen.getByText('ICU')).toBeInTheDocument();
    expect(ExtensionSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        name: WARD_PATIENTS_CRITICAL_CARE_SLOT,
        state: expect.objectContaining({
          locationUuid: 'icu-location-uuid',
          wardKind: 'icu',
          label: 'ICU',
        }),
      }),
      expect.anything(),
    );
  });

  it('shows a fallback message when the critical-care slot has no extensions', () => {
    mockUseCriticalCareWardTab.mockReturnValue({
      tab: { kind: 'hdu', label: 'HDU' },
      locationUuid: 'hdu-location-uuid',
      isLoading: false,
    });
    jest.mocked(useAssignedExtensions).mockReturnValue([]);

    renderWithSwr(<WardPatientsTable />);

    expect(screen.getByText('HDU dashboard not loaded')).toBeInTheDocument();
    expect(ExtensionSlot).not.toHaveBeenCalled();
  });
});
