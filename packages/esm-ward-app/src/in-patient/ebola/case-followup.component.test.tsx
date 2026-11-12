import { useSession, useVisit } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import useCurrentPatientAdmissionEncounter from '../../hooks/useCurrentPatientAdmissionEncounter';
import { useIsIsolationAdmission } from '../../hooks/useIsIsolationWard';
import CaseFollowUp from './case-followup.component';
import { useContactFollowUp } from './case-followup.resource';
import { addDaysToIsoDate, toDisplayDate, toLocalIsoDate } from './case-followup.utils';
import { useRelationships } from './contact-list/use-contact-mapping';

jest.mock('./case-followup.resource', () => {
  const actual = jest.requireActual('./case-followup.resource');
  return {
    ...actual,
    useContactFollowUp: jest.fn(),
    useEbolaContactFollowupConfig: () => actual.defaultEbolaContactFollowupConfig,
  };
});

jest.mock('./contact-list/use-contact-mapping', () => ({
  useRelationships: jest.fn(),
}));

jest.mock('../../hooks/useCurrentPatientAdmissionEncounter', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../hooks/useIsIsolationWard', () => ({
  useIsIsolationAdmission: jest.fn(),
}));

jest.mock('@openmrs/esm-patient-common-lib', () => {
  const patient = {
    name: [{ given: ['Amina'], family: 'Otieno' }],
    gender: 'female',
    age: 36,
  };
  return {
    usePatientChartStore: () => ({
      patient,
      visitContext: {},
      mutateVisitContext: jest.fn(),
    }),
  };
});

const mockUseSession = jest.mocked(useSession);
const mockUseVisit = jest.mocked(useVisit);
const mockUseRelationships = jest.mocked(useRelationships);
const mockUseAdmission = jest.mocked(useCurrentPatientAdmissionEncounter);
const mockUseIsolation = jest.mocked(useIsIsolationAdmission);
const mockUseContactFollowUp = jest.mocked(useContactFollowUp);

const listedContact = {
  uuid: 'contact-person-uuid',
  surname: 'Njoroge',
  otherNames: 'Peter',
  sex: 'M',
  age: 41,
  dateofLastContact: '28-10-2026',
  phoneNumber: '0712345678',
  relationShipUuid: 'rel-1',
};

describe('CaseFollowUp', () => {
  beforeEach(() => {
    mockUseContactFollowUp.mockReturnValue({
      payload: null,
      encounterUuid: undefined,
      storedMarks: [],
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    });
    mockUseRelationships.mockReturnValue({
      contacts: [],
      isLoading: false,
      error: undefined,
      relationships: [],
      headers: [],
      mutate: jest.fn(),
    });
    mockUseAdmission.mockReturnValue({
      admissionEncounter: { encounterDatetime: '2026-10-22T07:00:00.000Z' },
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
      currentVisit: { uuid: 'visit-1', startDatetime: '2026-10-22T07:00:00.000Z' },
      dischargeEncounter: undefined,
      isPatientAdmitted: true,
    } as ReturnType<typeof useCurrentPatientAdmissionEncounter>);
    mockUseSession.mockReturnValue({
      sessionLocation: { uuid: 'location-1' },
      currentProvider: { uuid: 'provider-1' },
    } as ReturnType<typeof useSession>);
    mockUseVisit.mockReturnValue({
      activeVisit: { uuid: 'visit-1', startDatetime: '2026-10-22T07:00:00.000Z' },
      currentVisit: null,
      currentVisitIsRetrospective: null,
      mutate: jest.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof useVisit>);
    mockUseIsolation.mockReturnValue({
      isIsolationAdmission: true,
      hasAdmissionLocation: true,
      isLoading: false,
    });
  });

  it('keeps the index patient on the first follow-up row with days admitted', () => {
    render(<CaseFollowUp patientUuid="patient-1" />);

    const indexRow = screen.getByTestId('index-followup-row');
    expect(indexRow).toHaveTextContent('Index');
    expect(indexRow).toHaveTextContent('Otieno');
    expect(indexRow).toHaveTextContent('Amina');
    expect(indexRow).toHaveTextContent(/days admitted/i);
    expect(screen.queryByText(/There are no contacts to display/i)).not.toBeInTheDocument();
  });

  it('does not add or register contacts from follow-up', () => {
    render(<CaseFollowUp patientUuid="patient-1" />);

    expect(screen.queryByRole('button', { name: /Add Contact/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Register new contact/i })).not.toBeInTheDocument();
  });

  it('lists follow-up patients from their OpenMRS person UUIDs under the index', () => {
    mockUseRelationships.mockReturnValue({
      contacts: [listedContact],
      isLoading: false,
      error: undefined,
      relationships: [],
      headers: [],
      mutate: jest.fn(),
    });

    render(<CaseFollowUp patientUuid="patient-1" />);

    expect(screen.getByTestId('index-followup-row')).toHaveTextContent('Index');
    expect(screen.getByTestId('contact-followup-row')).toHaveTextContent('Njoroge');
    expect(screen.getByTestId('contact-followup-row')).toHaveTextContent('Peter');
    expect(screen.getByTestId('contact-followup-row')).toHaveTextContent('0712345678');
    expect(screen.getByRole('link', { name: 'Njoroge' })).toHaveAttribute(
      'href',
      expect.stringContaining('/patient/contact-person-uuid/chart'),
    );
    expect(screen.getByRole('link', { name: 'Peter' })).toHaveAttribute(
      'href',
      expect.stringContaining('/patient/contact-person-uuid/chart'),
    );
    expect(screen.getByRole('link', { name: 'Otieno' })).toHaveAttribute(
      'href',
      expect.stringContaining('/patient/patient-1/chart'),
    );
  });

  it('aligns isolation day 1 with 22 Oct and a listed contact arriving on 28 Oct with that date column', () => {
    mockUseRelationships.mockReturnValue({
      contacts: [listedContact],
      isLoading: false,
      error: undefined,
      relationships: [],
      headers: [],
      mutate: jest.fn(),
    });

    render(<CaseFollowUp patientUuid="patient-1" />);

    expect(screen.getByText('Day of Follow-up')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: `Day 1, ${toDisplayDate('2026-10-22')}` })).toHaveTextContent('1');
    expect(screen.getByRole('columnheader', { name: 'Day 7' })).toHaveTextContent('7');
    expect(screen.getByRole('columnheader', { name: 'Day 21' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Day 27' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: `Day 1, ${toDisplayDate('2026-10-28')}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(
        new RegExp(`Day 6 \\(${toDisplayDate('2026-10-27')}\\): contact has not entered isolation yet`, 'i'),
      ),
    ).toBeInTheDocument();
  });

  it('lets today choose 0 or X once the listed contact has entered isolation', async () => {
    const user = userEvent.setup();
    const today = toLocalIsoDate(new Date());
    const todayDisplay = toDisplayDate(today);
    const [year, month, day] = today.split('-');

    mockUseAdmission.mockReturnValue({
      admissionEncounter: { encounterDatetime: `${today}T07:00:00.000Z` },
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
      currentVisit: { uuid: 'visit-1', startDatetime: `${today}T07:00:00.000Z` },
      dischargeEncounter: undefined,
      isPatientAdmitted: true,
    } as ReturnType<typeof useCurrentPatientAdmissionEncounter>);
    mockUseRelationships.mockReturnValue({
      contacts: [
        {
          ...listedContact,
          dateofLastContact: `${day}-${month}-${year}`,
        },
      ],
      isLoading: false,
      error: undefined,
      relationships: [],
      headers: [],
      mutate: jest.fn(),
    });

    render(<CaseFollowUp patientUuid="patient-1" />);

    const todayCells = screen.getAllByRole('button', { name: new RegExp(`Day \\d+ \\(${todayDisplay}\\)`) });
    expect(todayCells.length).toBeGreaterThan(0);
    expect(todayCells[0]).toBeEnabled();

    await user.click(todayCells[0]);
    expect(await screen.findByText('0')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText(/No fever or bleeding/i)).toBeInTheDocument();
    expect(screen.getByText(/Died or fever\/bleeding/i)).toBeInTheDocument();

    await user.click(screen.getByText(/No fever or bleeding/i));
    expect(screen.getByRole('button', { name: /0, no fever or bleeding/i })).toBeInTheDocument();
  });

  it('keeps today open after follow-up was already submitted so 0 and X can still change', async () => {
    const user = userEvent.setup();
    const today = toLocalIsoDate(new Date());
    const todayDisplay = toDisplayDate(today);

    mockUseAdmission.mockReturnValue({
      admissionEncounter: { encounterDatetime: `${today}T07:00:00.000Z` },
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
      currentVisit: { uuid: 'visit-1', startDatetime: `${today}T07:00:00.000Z` },
      dischargeEncounter: undefined,
      isPatientAdmitted: true,
    } as ReturnType<typeof useCurrentPatientAdmissionEncounter>);
    mockUseVisit.mockReturnValue({
      activeVisit: { uuid: 'visit-1', startDatetime: `${today}T07:00:00.000Z` },
      currentVisit: null,
      currentVisitIsRetrospective: null,
      mutate: jest.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof useVisit>);
    mockUseContactFollowUp.mockReturnValue({
      payload: {
        version: 1,
        status: 'submitted',
        isolationStartDate: today,
        contacts: [],
      },
      encounterUuid: 'encounter-1',
      storedMarks: [{ contactId: 'patient-1', day: 1, mark: '0', obsDate: today, obsUuid: 'obs-today' }],
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    });

    render(<CaseFollowUp patientUuid="patient-1" />);

    const todayButton = screen.getByRole('button', {
      name: new RegExp(`Day 1 \\(${todayDisplay}\\): 0, no fever or bleeding\\. Open to change`, 'i'),
    });
    expect(todayButton).toBeEnabled();

    await user.click(todayButton);
    await user.click(screen.getByText(/Died or fever\/bleeding/i));
    expect(
      screen.getByRole('button', { name: /X, died or developed fever or bleeding. Open to change/i }),
    ).toBeInTheDocument();
  });

  it('locks yesterday after it has been submitted and leaves today editable', () => {
    const today = toLocalIsoDate(new Date());
    const yesterday = addDaysToIsoDate(today, -1) ?? today;
    const todayDisplay = toDisplayDate(today);
    const yesterdayDisplay = toDisplayDate(yesterday);

    mockUseAdmission.mockReturnValue({
      admissionEncounter: { encounterDatetime: `${yesterday}T07:00:00.000Z` },
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
      currentVisit: { uuid: 'visit-1', startDatetime: `${yesterday}T07:00:00.000Z` },
      dischargeEncounter: undefined,
      isPatientAdmitted: true,
    } as ReturnType<typeof useCurrentPatientAdmissionEncounter>);
    mockUseVisit.mockReturnValue({
      activeVisit: { uuid: 'visit-1', startDatetime: `${yesterday}T07:00:00.000Z` },
      currentVisit: null,
      currentVisitIsRetrospective: null,
      mutate: jest.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof useVisit>);
    mockUseContactFollowUp.mockReturnValue({
      payload: {
        version: 1,
        status: 'submitted',
        isolationStartDate: yesterday,
        contacts: [],
      },
      encounterUuid: 'encounter-1',
      storedMarks: [
        { contactId: 'patient-1', day: 1, mark: '0', obsDate: yesterday, obsUuid: 'obs-yesterday' },
        { contactId: 'patient-1', day: 2, mark: 'X', obsDate: today, obsUuid: 'obs-today' },
      ],
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    });

    render(<CaseFollowUp patientUuid="patient-1" />);

    expect(
      screen.getByLabelText(new RegExp(`Day 1 \\(${yesterdayDisplay}\\): 0, no fever or bleeding\\.?$`, 'i')),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: new RegExp(`Day 1 \\(${yesterdayDisplay}\\)`, 'i') }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: new RegExp(`Day 2 \\(${todayDisplay}\\): X, died or developed fever or bleeding. Open to change`, 'i'),
      }),
    ).toBeEnabled();
  });

  it('keeps follow-up view only until the index patient is admitted to isolation', () => {
    mockUseIsolation.mockReturnValue({
      isIsolationAdmission: false,
      hasAdmissionLocation: false,
      isLoading: false,
    });
    mockUseRelationships.mockReturnValue({
      contacts: [listedContact],
      isLoading: false,
      error: undefined,
      relationships: [],
      headers: [],
      mutate: jest.fn(),
    });

    render(<CaseFollowUp patientUuid="patient-1" />);

    expect(screen.getByText(/Admit this index patient to the isolation ward/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow-up is view only/i)).toBeInTheDocument();
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.getByTestId('index-followup-row')).toHaveTextContent('Otieno');
    expect(screen.getByTestId('contact-followup-row')).toHaveTextContent('Njoroge');
    expect(screen.queryByRole('button', { name: /Save as Draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reset/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Day \d+/i })).toHaveLength(0);
  });
});
