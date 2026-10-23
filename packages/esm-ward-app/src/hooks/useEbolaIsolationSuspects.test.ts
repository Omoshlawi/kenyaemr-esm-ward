import { excludeAdmittedIsolationSuspects, type EbolaIsolationSuspect } from './useEbolaIsolationSuspects';

const suspect = (uuid: string): EbolaIsolationSuspect =>
  ({
    patient: { uuid },
    visit: { uuid: `visit-${uuid}` },
    dispositionType: 'ADMIT',
  }) as EbolaIsolationSuspect;

describe('excludeAdmittedIsolationSuspects', () => {
  it('keeps suspects who are not yet in a bed or unassigned', () => {
    const queued = excludeAdmittedIsolationSuspects(
      [suspect('a'), suspect('b'), suspect('c')],
      ['b'],
      [{ patient: { uuid: 'c' } }],
    );

    expect(queued.map((row) => row.patient.uuid)).toEqual(['a']);
  });

  it('returns an empty list when every suspect is already admitted', () => {
    expect(excludeAdmittedIsolationSuspects([suspect('a')], ['a'], [])).toEqual([]);
  });
});
