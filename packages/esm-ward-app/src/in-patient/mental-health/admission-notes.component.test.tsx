import { useConfig } from '@openmrs/esm-framework';
import { render } from '@testing-library/react';
import React from 'react';
import FormEncountersTable from '../form-encounters/form-encounters-table.component';
import AdmissionNotes from './admission-notes.component';

jest.mock('../form-encounters/form-encounters-table.component', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockFormEncountersTable = jest.mocked(FormEncountersTable);
const mockUseConfig = jest.mocked(useConfig);

describe('AdmissionNotes', () => {
  it('renders the form encounters table for the configured admission notes form', () => {
    mockUseConfig.mockReturnValue({
      admissionFormUuid: 'admission-form-uuid',
      admissionNotesFormUuid: 'admission-notes-form-uuid',
    } as any);

    render(<AdmissionNotes patientUuid="patient-uuid" />);

    expect(mockFormEncountersTable.mock.calls[0][0]).toEqual({
      patientUuid: 'patient-uuid',
      forms: [{ uuid: 'admission-notes-form-uuid' }],
      headerTitle: 'Admission Notes',
      displayText: 'Admission Notes',
    });
  });
});
