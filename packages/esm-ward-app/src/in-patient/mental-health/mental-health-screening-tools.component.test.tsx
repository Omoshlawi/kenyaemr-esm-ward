import { useConfig } from '@openmrs/esm-framework';
import { render } from '@testing-library/react';
import React from 'react';
import FormEncountersTable from '../form-encounters/form-encounters-table.component';
import MentalHealthScreeningTools from './mental-health-screening-tools.component';

jest.mock('../form-encounters/form-encounters-table.component', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockFormEncountersTable = jest.mocked(FormEncountersTable);
const mockUseConfig = jest.mocked(useConfig);

describe('MentalHealthScreeningTools', () => {
  it('renders the form encounters table for every configured screening tool', () => {
    mockUseConfig.mockReturnValue({
      mentalHealthScreeningTools: [
        { label: 'AUDIT', formUuid: 'audit-form-uuid' },
        { label: 'GAD-7', formUuid: 'gad-form-uuid' },
      ],
    } as any);

    render(<MentalHealthScreeningTools patientUuid="patient-uuid" />);

    expect(mockFormEncountersTable.mock.calls[0][0]).toEqual({
      patientUuid: 'patient-uuid',
      forms: [
        { uuid: 'audit-form-uuid', label: 'AUDIT' },
        { uuid: 'gad-form-uuid', label: 'GAD-7' },
      ],
      headerTitle: 'Mental Health Screening Tools',
      displayText: 'Mental Health Screening Tools',
    });
  });
});
