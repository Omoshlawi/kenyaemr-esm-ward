import { useConfig } from '@openmrs/esm-framework';
import { render } from '@testing-library/react';
import React from 'react';
import FormEncountersTable from '../../form-encounters/form-encounters-table.component';
import CaseIdentificationFinding from './case-identification-finding.component';

jest.mock('../../form-encounters/form-encounters-table.component', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockFormEncountersTable = jest.mocked(FormEncountersTable);
const mockUseConfig = jest.mocked(useConfig);

describe('CaseIdentificationFinding', () => {
  it('renders the form encounters table for the configured CIF form', () => {
    mockUseConfig.mockReturnValue({ cifFormUuid: 'cif-form-uuid' } as any);

    render(<CaseIdentificationFinding patientUuid="patient-uuid" />);

    expect(mockFormEncountersTable.mock.calls[0][0]).toEqual({
      patientUuid: 'patient-uuid',
      forms: [{ uuid: 'cif-form-uuid' }],
      headerTitle: 'Case Identification Finding',
      displayText: 'CIF',
    });
  });
});
