import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import FormEncountersTable from './form-encounters-table.component';
import { useVisitFormEncounters } from './form-encounters.resource';

jest.mock('./form-encounters.resource', () => ({
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

const screeningForms = [
  { uuid: 'audit-form-uuid', label: 'AUDIT' },
  { uuid: 'gad-form-uuid', label: 'GAD-7' },
];

const mockEncounters = (encounters: Array<any>) =>
  mockUseVisitFormEncounters.mockReturnValue({ encounters, isLoading: false, error: null, mutate: jest.fn() });

const renderSingleForm = () =>
  render(
    <FormEncountersTable
      patientUuid="patient-uuid"
      forms={[{ uuid: 'cif-form-uuid' }]}
      headerTitle="Case Identification Finding"
      displayText="CIF"
    />,
  );

const renderScreeningForms = () =>
  render(
    <FormEncountersTable
      patientUuid="patient-uuid"
      forms={screeningForms}
      headerTitle="Screening Tools"
      displayText="Screening Tools"
    />,
  );

const expectFormLaunched = (formUuid: string, encounterUuid: string) =>
  expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
    'patient-form-entry-workspace',
    { form: { uuid: formUuid }, encounterUuid },
    {},
    expect.objectContaining({ patientUuid: 'patient-uuid' }),
  );

const openAddMenu = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /additional actions/i }));

// Carbon positions the menu using layout, which jsdom lacks, so it stays hidden from role queries
const getMenuItem = (label: string) => screen.getByText(label);

describe('FormEncountersTable', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ obsConceptUuidsToHide: [] } as any);
    mockLaunchWorkspace2.mockClear();
  });

  describe('with one form', () => {
    it('shows the empty state when no encounters exist in the visit', () => {
      mockEncounters([]);

      renderSingleForm();

      expect(screen.getByText('Empty state')).toBeInTheDocument();
    });

    it('lists encounters, shows obs on expand and launches the form in edit mode', async () => {
      const user = userEvent.setup();
      mockEncounters([cifEncounter]);

      renderSingleForm();

      expect(screen.queryByText('Empty state')).not.toBeInTheDocument();
      expect(screen.getByText('Case Identification Form')).toBeInTheDocument();
      expect(screen.getByText('Dr. Wanjiku')).toBeInTheDocument();
      expect(screen.queryByText('Fever')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /expand current row/i }));
      expect(screen.getByText('Fever')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /edit this encounter/i }));
      expectFormLaunched('cif-form-uuid', 'cif-encounter-uuid');
    });

    it('launches a new form from the Add button', async () => {
      const user = userEvent.setup();
      mockEncounters([cifEncounter]);

      renderSingleForm();

      await user.click(screen.getByRole('button', { name: 'Add' }));
      expectFormLaunched('cif-form-uuid', '');
    });
  });

  describe('with several forms', () => {
    it('fetches encounters for every form', () => {
      mockEncounters([]);

      renderScreeningForms();

      expect(mockUseVisitFormEncounters).toHaveBeenCalledWith('visit-uuid', ['audit-form-uuid', 'gad-form-uuid']);
    });

    it('offers each form from the menu when there are no encounters', async () => {
      const user = userEvent.setup();
      mockEncounters([]);

      renderScreeningForms();

      expect(screen.queryByText('Empty state')).not.toBeInTheDocument();

      await openAddMenu(user);
      expect(getMenuItem('AUDIT')).toBeInTheDocument();

      await user.click(getMenuItem('GAD-7'));
      expectFormLaunched('gad-form-uuid', '');
    });

    it('offers each form from the menu when encounters are listed', async () => {
      const user = userEvent.setup();
      mockEncounters([cifEncounter]);

      renderScreeningForms();

      await openAddMenu(user);
      await user.click(getMenuItem('AUDIT'));
      expectFormLaunched('audit-form-uuid', '');
    });

    it('edits an encounter in the form that created it, not the first configured form', async () => {
      const user = userEvent.setup();
      mockEncounters([
        {
          ...cifEncounter,
          uuid: 'gad-encounter-uuid',
          form: { uuid: 'gad-form-uuid', display: 'GAD-7 Form' },
        },
      ]);

      renderScreeningForms();

      await user.click(screen.getByRole('button', { name: /expand current row/i }));
      await user.click(screen.getByRole('button', { name: /edit this encounter/i }));
      expectFormLaunched('gad-form-uuid', 'gad-encounter-uuid');
    });
  });
});
