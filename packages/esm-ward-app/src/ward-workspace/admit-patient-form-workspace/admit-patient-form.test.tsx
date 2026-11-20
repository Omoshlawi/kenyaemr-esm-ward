import React from 'react';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import {
  createAttachment,
  type DefaultWorkspaceProps,
  showSnackbar,
  useAppContext,
  useConfig,
  useFeatureFlag,
  useSession,
} from '@openmrs/esm-framework';
import { mockInpatientRequestAlice, mockLocationInpatientWard, mockPatientAlice } from '__mocks__';
import { renderWithSwr } from 'tools';
import { mockWardPatientGroupDetails, mockWardViewContext } from '../../../mock';
import { useAssignedBedByPatient } from '../../hooks/useAssignedBedByPatient';
import type { WardPatient, WardViewContext } from '../../types';
import { assignPatientToBed, removePatientFromBed, useAdmitPatient } from '../../ward.resource';
import AdmitPatientFormWorkspace from './admit-patient-form.workspace';
import useWardLocation from '../../hooks/useWardLocation';
import { useAdmissionLocationTags } from '../../in-patient/in-patient.resource';

jest.mock('@openmrs/esm-framework', () => ({
  ...jest.requireActual('@openmrs/esm-framework'),
  Workspace2: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../in-patient/in-patient.resource', () => ({
  useAdmissionLocationTags: jest.fn(),
}));

jest.mock('../bed-selector.component', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (bedId: number) => void }) => (
    <button type="button" onClick={() => onChange(3)}>
      Select bed 3
    </button>
  ),
}));

jest.mock('./facility-bed-capacity-notification.component', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../hooks/useAdmissionLocation', () => ({
  useAdmissionLocation: jest.fn(),
}));

jest.mock('../../hooks/useWardLocation', () => jest.fn());

jest.mock('../../hooks/useInpatientRequest', () => ({
  useInpatientRequest: jest.fn(),
}));

jest.mock('../../hooks/useWardPatientGrouping', () => ({
  useWardPatientGrouping: jest.fn(),
}));

jest.mock('../../hooks/useInpatientAdmission', () => ({
  useInpatientAdmission: jest.fn(),
}));

jest.mock('../../hooks/useAssignedBedByPatient', () => ({
  useAssignedBedByPatient: jest.fn(),
}));

jest.mock('../../ward.resource', () => ({
  useAdmitPatient: jest.fn(),
  assignPatientToBed: jest.fn(),
  removePatientFromBed: jest.fn(),
}));

const mockedUseWardLocation = jest.mocked(useWardLocation);
const mockedUseFeatureFlag = jest.mocked(useFeatureFlag);
const mockedShowSnackbar = jest.mocked(showSnackbar);
const mockedUseSession = jest.mocked(useSession);
const mockedUseAssignedBedByPatient = jest.mocked(useAssignedBedByPatient);
const mockedAssignPatientToBed = jest.mocked(assignPatientToBed);
const mockedRemovePatientFromBed = jest.mocked(removePatientFromBed);
const mockedUseAdmitPatient = jest.mocked(useAdmitPatient);

jest.mocked(useAppContext<WardViewContext>).mockReturnValue(mockWardViewContext);

const mockedAdmitPatient = jest.fn();
const mockUseAdmitPatientObj: ReturnType<typeof useAdmitPatient> = {
  admitPatient: mockedAdmitPatient,
  isLoadingEmrConfiguration: false,
  errorFetchingEmrConfiguration: false,
};
jest.mocked(useAdmitPatient).mockReturnValue(mockUseAdmitPatientObj);

const mockWorkspaceProps: DefaultWorkspaceProps = {
  closeWorkspaceWithSavedChanges: jest.fn(),
  promptBeforeClosing: jest.fn(),
  setTitle: jest.fn(),
  closeWorkspace: jest.fn(),
};

const mockWardPatientAliceProps: WardPatient = {
  visit: mockInpatientRequestAlice.visit,
  patient: mockPatientAlice,
  bed: null,
  inpatientAdmission: null,
  inpatientRequest: mockInpatientRequestAlice,
};

function renderAdmissionForm() {
  renderWithSwr(
    <AdmitPatientFormWorkspace
      {...{ ...mockWorkspaceProps, wardPatient: mockWardPatientAliceProps, WardPatientHeader: jest.fn() }}
    />,
  );
}

describe.skip('Testing AdmitPatientForm', () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      currentProvider: {
        uuid: 'current-provider-uuid',
        identifier: 'current-provider-identifier',
      },
      authenticated: true,
      sessionId: 'session-id',
    });

    mockedUseFeatureFlag.mockReturnValue(true);

    mockedUseWardLocation.mockReturnValue({
      location: mockLocationInpatientWard,
      invalidLocation: false,
      isLoadingLocation: false,
      errorFetchingLocation: null,
    });

    // @ts-ignore - we don't need to mock the entire object
    mockedUseAssignedBedByPatient.mockReturnValue({
      data: {
        data: {
          results: [
            {
              bedId: 1,
              bedNumber: '1',
              bedType: null,
              patients: [mockPatientAlice],
              physicalLocation: mockLocationInpatientWard,
            },
          ],
        },
      },
    });

    // @ts-ignore - we only need these two keys for now
    mockedAdmitPatient.mockResolvedValue({
      ok: true,
      data: {
        uuid: 'encounter-uuid',
      },
    });

    // @ts-ignore - we only need the ok key for now
    mockedAssignPatientToBed.mockResolvedValue({
      ok: true,
    });

    // @ts-ignore - we only need the ok key for now
    mockedRemovePatientFromBed.mockResolvedValue({
      ok: true,
    });
  });

  it('should render admit patient form', async () => {
    const user = userEvent.setup();
    renderAdmissionForm();
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);
    expect(mockWorkspaceProps.closeWorkspace).toHaveBeenCalledWith({
      ignoreChanges: true,
    });
    screen.getByText('Admit');
    expect(screen.getByText('Select a bed')).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: 'bed1 · Alice Johnson' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'bed2 · Empty' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'bed3 · Empty' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'bed4 · Empty' })).toBeInTheDocument();
  });

  it.skip('should block the form if emr configuration is not fetched properly', () => {
    mockedUseAdmitPatient.mockReturnValueOnce({
      admitPatient: mockedAdmitPatient,
      isLoadingEmrConfiguration: false,
      errorFetchingEmrConfiguration: true,
    });

    renderAdmissionForm();

    const admitButton = screen.getByText('Admit');
    expect(admitButton).toBeDisabled();
  });

  it('should render admit patient form if bed management module is present, but no beds are configured', () => {
    mockedUseFeatureFlag.mockReturnValue(true);
    const replacedProperty = jest.replaceProperty(mockWardPatientGroupDetails(), 'bedLayouts', []);
    renderAdmissionForm();
    expect(screen.getByText('Select a bed')).toBeInTheDocument();
    expect(screen.getByText(/No beds configured/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Admit' })).toBeDisabled();
    replacedProperty.restore();
  });

  it('should allow admission to empty beds even when their status is stale (OCCUPIED but no patients)', async () => {
    const staleBedLayouts = [
      {
        rowNumber: 1,
        columnNumber: 1,
        bedNumber: 'bed3',
        bedId: 3,
        bedUuid: '0000-bed3',
        status: 'OCCUPIED',
        bedType: null,
        location: mockLocationInpatientWard.display,
        patients: [],
        bedTagMaps: [],
      },
    ];
    const replacedProperty = jest.replaceProperty(
      mockWardPatientGroupDetails(),
      'bedLayouts',
      staleBedLayouts as never,
    );

    const user = userEvent.setup();
    renderAdmissionForm();

    expect(screen.queryByText(/All beds are occupied/i)).not.toBeInTheDocument();
    const bedOption = screen.getByRole('radio', { name: 'bed3 · Empty' });
    await user.click(bedOption);
    const admitButton = screen.getByRole('button', { name: 'Admit' });
    expect(admitButton).toBeEnabled();

    replacedProperty.restore();
  });

  it('should submit the form, create encounter and submit bed', async () => {
    const user = userEvent.setup();
    renderAdmissionForm();
    const bedOption = screen.getByRole('radio', { name: 'bed3 · Empty' });
    await user.click(bedOption);
    const admitButton = screen.getByRole('button', { name: 'Admit' });
    expect(admitButton).toBeEnabled();
    await user.click(admitButton);
    expect(mockedAdmitPatient).toHaveBeenCalledWith(mockPatientAlice, 'ADMIT', mockInpatientRequestAlice.visit.uuid);
    expect(mockedAssignPatientToBed).toHaveBeenCalledWith(3, mockPatientAlice.uuid, 'encounter-uuid');
    expect(mockedShowSnackbar).toHaveBeenCalledWith({
      kind: 'success',
      subtitle: 'Alice Johnson has been successfully admitted and assigned to bed bed3',
      title: 'Patient admitted successfully',
    });
  });

  it('should show snackbar if there was an issue creating an encounter', async () => {
    mockedAdmitPatient.mockRejectedValue(new Error('Failed to create encounter'));
    const user = userEvent.setup();
    renderAdmissionForm();
    const bedOption = screen.getByRole('radio', { name: 'bed3 · Empty' });
    await user.click(bedOption);
    const admitButton = screen.getByRole('button', { name: 'Admit' });
    expect(admitButton).toBeEnabled();
    await user.click(admitButton);
    expect(mockedShowSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Failed to admit patient',
      subtitle: 'Failed to create encounter',
    });
  });

  it('should show warning snackbar if encounter was created and bed assignment was not successful', async () => {
    mockedAssignPatientToBed.mockRejectedValue(new Error('Failed to assign bed'));

    const user = userEvent.setup();
    renderAdmissionForm();
    const bedOption = screen.getByRole('radio', { name: 'bed3 · Empty' });
    await user.click(bedOption);
    const admitButton = screen.getByRole('button', { name: 'Admit' });
    expect(admitButton).toBeEnabled();
    await user.click(admitButton);
    expect(mockedShowSnackbar).toHaveBeenCalledWith({
      kind: 'warning',
      title: 'Patient admitted successfully',
      subtitle: 'Patient admitted successfully but fail to assign bed to patient',
    });
  });

  it('should admit patient if no bed is selected', async () => {
    const user = userEvent.setup();
    renderAdmissionForm();
    const admitButton = screen.getByRole('button', { name: 'Admit' });
    expect(admitButton).toBeEnabled();
    await user.click(admitButton);
    expect(mockedAdmitPatient).toHaveBeenCalledWith(mockPatientAlice, 'ADMIT', mockInpatientRequestAlice.visit.uuid);
    expect(mockedRemovePatientFromBed).toHaveBeenCalledWith(1, mockPatientAlice.uuid);
    expect(mockedShowSnackbar).toHaveBeenCalledWith({
      kind: 'success',
      subtitle: 'Patient admitted successfully to Inpatient Ward',
      title: 'Patient admitted successfully',
    });
  });
});

describe('AdmitPatientForm admission attachment', () => {
  const psychiatricTagUuid = '37bedf9c-07b1-4d8b-9ba3-ad3b9d48e10d';
  const categoryQuestionUuid = '11c54b66-d733-460c-81ad-5347371fa41b';
  const voluntaryUuid = 'ae2b3f93-bd11-4d8f-88ee-bc8d20ab7154';
  const mockedCreateAttachment = jest.mocked(createAttachment);
  const mockedUseAdmissionLocationTags = jest.mocked(useAdmissionLocationTags);
  const closeWorkspace = jest.fn();
  const pdf = new File(['content'], 'consent.pdf', { type: 'application/pdf' });

  function renderForm() {
    const props = { workspaceProps: { wardPatient: mockWardPatientAliceProps }, closeWorkspace };
    renderWithSwr(
      <AdmitPatientFormWorkspace {...(props as unknown as React.ComponentProps<typeof AdmitPatientFormWorkspace>)} />,
    );
  }

  function mockWardTags(tagUuids: Array<string>) {
    mockedUseAdmissionLocationTags.mockReturnValue({
      tags: tagUuids.map((uuid) => ({ uuid, display: uuid, name: uuid, description: '' })),
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    });
  }

  async function fillPsychiatricFields(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Voluntary' }));
    await user.upload(screen.getByLabelText('Add file'), pdf);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAppContext<WardViewContext>).mockReturnValue(mockWardViewContext);
    jest.mocked(useAdmitPatient).mockReturnValue(mockUseAdmitPatientObj);
    jest.mocked(useConfig).mockReturnValue({
      admissionFormUuid: 'admission-form-uuid',
      inpatientLocationTags: { psychiatricWard: psychiatricTagUuid },
      psychiatricCategories: {
        question: categoryQuestionUuid,
        voluntary: voluntaryUuid,
        involuntary: '6455c7db-f438-4c15-a146-defcbf9b3f2b',
        emergencyAdmission: '06f34d63-c694-421f-8a96-37a70d9e14ad',
        forensicAdmission: '7f10db1a-23dd-4769-b191-3b6a63a21f64',
      },
    });
    mockedUseWardLocation.mockReturnValue({
      location: mockLocationInpatientWard,
      invalidLocation: false,
      isLoadingLocation: false,
      errorFetchingLocation: null,
    });
    // @ts-ignore - only the fields read by the form are needed
    mockedUseAssignedBedByPatient.mockReturnValue({ data: { data: { results: [] } }, isLoading: false });
    mockedAdmitPatient.mockResolvedValue({ ok: true, data: { uuid: 'encounter-uuid' } });
    // @ts-ignore - only the ok key is needed
    mockedAssignPatientToBed.mockResolvedValue({ ok: true });
    // @ts-ignore - the response is not read
    mockedCreateAttachment.mockResolvedValue({ ok: true });
  });

  it('uploads the attachment after admission for a psychiatric ward', async () => {
    mockWardTags([psychiatricTagUuid]);
    const user = userEvent.setup();
    renderForm();

    await fillPsychiatricFields(user);
    await user.click(screen.getByRole('button', { name: 'Select bed 3' }));
    await user.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() => expect(mockedCreateAttachment).toHaveBeenCalledTimes(1));
    expect(mockedCreateAttachment).toHaveBeenCalledWith(
      mockPatientAlice.uuid,
      expect.objectContaining({ file: pdf, fileName: 'consent.pdf', fileDescription: 'Admission attachment' }),
    );
    expect(mockedAdmitPatient.mock.invocationCallOrder[0]).toBeLessThan(
      mockedCreateAttachment.mock.invocationCallOrder[0],
    );
    expect(mockedAdmitPatient.mock.calls[0][3]).toEqual([{ concept: categoryQuestionUuid, value: voluntaryUuid }]);
  });

  it('warns and still assigns the bed when the upload fails', async () => {
    mockWardTags([psychiatricTagUuid]);
    mockedCreateAttachment.mockRejectedValue(new Error('Upload failed'));
    const user = userEvent.setup();
    renderForm();

    await fillPsychiatricFields(user);
    await user.click(screen.getByRole('button', { name: 'Select bed 3' }));
    await user.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() =>
      expect(mockedAssignPatientToBed).toHaveBeenCalledWith(3, mockPatientAlice.uuid, 'encounter-uuid'),
    );
    expect(mockedShowSnackbar).toHaveBeenCalledWith({
      kind: 'warning',
      title: 'Attachment not uploaded',
      subtitle: 'Patient admitted successfully but failed to upload the attachment',
    });
  });

  it('does not admit a psychiatric patient without a category and attachment', async () => {
    mockWardTags([psychiatricTagUuid]);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Select bed 3' }));
    await user.click(screen.getByRole('button', { name: 'Admit' }));

    expect(await screen.findByText('Attachment is required for psychiatric wards')).toBeInTheDocument();
    expect(screen.getAllByText('Psychiatric category is required for psychiatric wards').length).toBeGreaterThan(0);
    expect(mockedAdmitPatient).not.toHaveBeenCalled();
  });

  it('admits without psychiatric fields, obs or an upload on other wards', async () => {
    mockWardTags([]);
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Psychiatric category')).not.toBeInTheDocument();
    expect(screen.queryByText('Add file')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select bed 3' }));
    await user.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() => expect(mockedAdmitPatient).toHaveBeenCalledTimes(1));
    expect(mockedAdmitPatient.mock.calls[0][3]).toEqual([]);
    await waitFor(() => expect(closeWorkspace).toHaveBeenCalled());
    expect(mockedCreateAttachment).not.toHaveBeenCalled();
  });
});
