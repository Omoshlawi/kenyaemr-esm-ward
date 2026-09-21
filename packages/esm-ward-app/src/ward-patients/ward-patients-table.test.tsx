import { ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithSwr } from '../../../../tools/test-utils';
import WardPatientsTable from './ward-patients-table';
import {
  WARD_PATIENTS_ADMITTED_SLOT,
  WARD_PATIENTS_AWAITING_ADMISSION_SLOT,
  WARD_PATIENTS_DISCHARGE_IN_SLOT,
  WARD_PATIENTS_DISCHARGED_SLOT,
  WARD_PATIENTS_UNASSIGNED_SLOT,
} from './ward-patients-slots';

describe('WardPatientsTable', () => {
  beforeEach(() => {
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
  });

  it('renders an ExtensionSlot for each tab panel', () => {
    renderWithSwr(<WardPatientsTable />);

    expect(ExtensionSlot).toHaveBeenCalledWith(
      expect.objectContaining({ name: WARD_PATIENTS_AWAITING_ADMISSION_SLOT }),
      expect.anything(),
    );
    expect(ExtensionSlot).toHaveBeenCalledWith(
      expect.objectContaining({ name: WARD_PATIENTS_ADMITTED_SLOT }),
      expect.anything(),
    );
    expect(ExtensionSlot).toHaveBeenCalledWith(
      expect.objectContaining({ name: WARD_PATIENTS_UNASSIGNED_SLOT }),
      expect.anything(),
    );
    expect(ExtensionSlot).toHaveBeenCalledWith(
      expect.objectContaining({ name: WARD_PATIENTS_DISCHARGE_IN_SLOT }),
      expect.anything(),
    );
    expect(ExtensionSlot).toHaveBeenCalledWith(
      expect.objectContaining({ name: WARD_PATIENTS_DISCHARGED_SLOT }),
      expect.anything(),
    );
  });

  it('shows a fallback message when a tab slot has no extensions', () => {
    jest.mocked(useAssignedExtensions).mockReturnValue([]);

    renderWithSwr(<WardPatientsTable />);

    expect(screen.getAllByText('No component configured for this ward patients tab')).toHaveLength(5);
  });
});
