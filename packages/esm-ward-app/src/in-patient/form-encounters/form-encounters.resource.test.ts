import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import { useVisitFormEncounters } from './form-encounters.resource';

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseSWR = jest.mocked(useSWR);

const encounter = (uuid: string, formUuid: string, encounterDatetime: string) => ({
  uuid,
  encounterDatetime,
  form: { uuid: formUuid },
});

describe('useVisitFormEncounters', () => {
  beforeEach(() => {
    mockUseSWR.mockReset();
    mockUseSWR.mockReturnValue({
      data: {
        data: {
          uuid: 'visit-uuid',
          encounters: [
            encounter('older-audit', 'audit-form-uuid', '2026-10-01T10:00:00.000+0000'),
            encounter('other-form', 'other-form-uuid', '2026-10-02T10:00:00.000+0000'),
            encounter('newer-gad', 'gad-form-uuid', '2026-10-03T10:00:00.000+0000'),
          ],
        },
      },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    } as any);
  });

  it('keeps encounters from all the given forms, newest first', () => {
    const { result } = renderHook(() => useVisitFormEncounters('visit-uuid', ['audit-form-uuid', 'gad-form-uuid']));

    expect(result.current.encounters.map(({ uuid }) => uuid)).toEqual(['newer-gad', 'older-audit']);
  });

  it('keeps the same encounters array when re-rendered with an equal list of forms', () => {
    const { result, rerender } = renderHook(() => useVisitFormEncounters('visit-uuid', ['audit-form-uuid']));
    const firstEncounters = result.current.encounters;

    rerender();

    expect(result.current.encounters).toBe(firstEncounters);
  });

  it('does not fetch without a visit or without forms', () => {
    renderHook(() => useVisitFormEncounters(undefined, ['audit-form-uuid']));
    renderHook(() => useVisitFormEncounters('visit-uuid', []));

    expect(mockUseSWR.mock.calls.every(([url]) => url === null)).toBe(true);
  });
});
