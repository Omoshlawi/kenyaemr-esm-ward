import { ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithSwr } from '../../../../tools/test-utils';
import { useCriticalCareWardTab } from '../hooks/useCriticalCareWardTab';
import WardPatientsTable, { WARD_PATIENTS_CRITICAL_CARE_SLOT } from './ward-patients-table';
import {
  WARD_PATIENTS_ADMITTED_SLOT,
  WARD_PATIENTS_AWAITING_ADMISSION_SLOT,
  WARD_PATIENTS_DISCHARGE_IN_SLOT,
  WARD_PATIENTS_DISCHARGED_SLOT,
  WARD_PATIENTS_UNASSIGNED_SLOT,
} from './ward-patients-slots';

jest.mock('../hooks/useCriticalCareWardTab', () => ({
  useCriticalCareWardTab: jest.fn(),
}));

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

  it('renders five tabs with expected labels', () => {
    renderWithSwr(<WardPatientsTable />);

    expect(screen.getByText('Awaiting Admission')).toBeInTheDocument();
    expect(screen.getByText('Admitted')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Discharge In')).toBeInTheDocument();
    expect(screen.getByText('Discharged')).toBeInTheDocument();
    expect(screen.queryByText('ICU')).not.toBeInTheDocument();
  });

  it('renders an ExtensionSlot for each tab panel', () => {
    renderWithSwr(<WardPatientsTable />);

    [
      WARD_PATIENTS_AWAITING_ADMISSION_SLOT,
      WARD_PATIENTS_ADMITTED_SLOT,
      WARD_PATIENTS_UNASSIGNED_SLOT,
      WARD_PATIENTS_DISCHARGE_IN_SLOT,
      WARD_PATIENTS_DISCHARGED_SLOT,
    ].forEach((slotName) => {
      expect(ExtensionSlot).toHaveBeenCalledWith(expect.objectContaining({ name: slotName }), expect.anything());
    });
  });

  it('shows a fallback message when a tab slot has no extensions', () => {
    jest.mocked(useAssignedExtensions).mockReturnValue([]);

    renderWithSwr(<WardPatientsTable />);

    expect(screen.getAllByText('No component configured for this ward patients tab')).toHaveLength(5);
  });

  it('shows a critical-care tab next to Discharged when the selected ward matches', () => {
    mockUseCriticalCareWardTab.mockReturnValue({
      tab: { kind: 'icu', label: 'ICU' },
      locationUuid: 'icu-location-uuid',
      isLoading: false,
    });

    renderWithSwr(<WardPatientsTable />);

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs.slice(-2)).toEqual(['Discharged', 'ICU']);
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
