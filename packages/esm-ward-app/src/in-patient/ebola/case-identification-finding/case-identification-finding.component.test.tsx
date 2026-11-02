import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import CaseIdentificationFinding from './case-identification-finding.component';
import { useVisitFormEncounters } from './case-identification-finding.resource';

jest.mock('./case-identification-finding.resource', () => ({
  useVisitFormEncounters: jest.fn(),
}));

jest.mock('@openmrs/esm-patient-common-lib', () => ({
  usePatientChartStore: () => ({
    patient: { id: 'patient-uuid' },
    visitContext: { uuid: 'visit-uuid' },
    mutateVisitContext: jest.fn(),
  }),
  EmptyState: ({ headerTitle, launchForm }) => (
    <div>
      <p>{headerTitle}</p>
      <p>Empty state</p>
      <button onClick={launchForm}>Record CIF</button>
    </div>
  ),
}));

const mockUseVisitFormEncounters = jest.mocked(useVisitFormEncounters);
const mockLaunchWorkspace2 = jest.mocked(launchWorkspace2);
const mockUseConfig = jest.mocked(useConfig);

const cifEncounter = {
  uuid: 'cif-encounter-uuid',
  encounterDatetime: '2026-10-20T10:00:00.000+0000',
  form: { uuid: 'cif-form-uuid', display: 'Case Identification Form' },
  encounterType: { uuid: 'enc-type-uuid', display: 'Ebola CIF', viewPrivilege: null, editPrivilege: null },
  encounterProviders: [{ provider: { person: { display: 'Dr. Wanjiku' } } }],
  obs: [
    {
      uuid: 'obs-uuid',
      concept: { uuid: 'fever-uuid', display: 'Fever', conceptClass: { uuid: 'c', display: 'Finding' } },
      display: 'Fever: Yes',
      groupMembers: null,
      value: 'Yes',
    },
  ],
} as any;

describe('CaseIdentificationFinding', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ cifFormUuid: 'cif-form-uuid', obsConceptUuidsToHide: [] } as any);
  });

  it('shows the empty state when no CIF encounters exist in the visit', () => {
    mockUseVisitFormEncounters.mockReturnValue({ encounters: [], isLoading: false, error: null, mutate: jest.fn() });

    render(<CaseIdentificationFinding patientUuid="patient-uuid" />);

    expect(screen.getByText('Empty state')).toBeInTheDocument();
  });

  it('lists CIF encounters, shows obs on expand and launches the form in edit mode', async () => {
    const user = userEvent.setup();
    mockUseVisitFormEncounters.mockReturnValue({
      encounters: [cifEncounter],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });

    render(<CaseIdentificationFinding patientUuid="patient-uuid" />);

    expect(screen.queryByText('Empty state')).not.toBeInTheDocument();
    expect(screen.getByText('Case Identification Form')).toBeInTheDocument();
    expect(screen.getByText('Dr. Wanjiku')).toBeInTheDocument();
    expect(screen.queryByText('Fever')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expand current row/i }));
    expect(screen.getByText('Fever')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /edit this encounter/i }));
    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'patient-form-entry-workspace',
      { form: { uuid: 'cif-form-uuid' }, encounterUuid: 'cif-encounter-uuid' },
      {},
      expect.objectContaining({ patientUuid: 'patient-uuid' }),
    );
  });
});
