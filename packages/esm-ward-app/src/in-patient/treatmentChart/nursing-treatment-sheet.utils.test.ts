import { CARDEX_META_PREFIX, getOrderAdministrationSummary, isActiveMedicationOrder } from './nursing-cardex-plan.resource';
import { extractAdministeredOrderKeys } from './nursing-treatment-sheet.resource';
import {
  createEmptyAdministeredOrderKeys,
  getDailyAdministrationLimit,
  getTodayAdministrationCount,
  getTodayDateKey,
  incrementAdministeredOrderCount,
  isTreatmentChartOrderLocked,
  toLocalDateKey,
} from './nursing-treatment-sheet.utils';

describe('getDailyAdministrationLimit', () => {
  it('defaults unknown or missing frequencies to once daily', () => {
    expect(getDailyAdministrationLimit(undefined)).toBe(1);
    expect(getDailyAdministrationLimit('')).toBe(1);
    expect(getDailyAdministrationLimit('custom ward schedule')).toBe(1);
  });

  it('uses OpenMRS frequencyPerDay when present', () => {
    expect(getDailyAdministrationLimit({ display: 'Three times daily', frequencyPerDay: 3 })).toBe(3);
    expect(getDailyAdministrationLimit({ frequencyPerDay: '4' })).toBe(4);
    expect(getDailyAdministrationLimit({ display: 'Once weekly', frequencyPerDay: 0.14 })).toBe(1);
  });

  it('parses common KenyaEMR frequency labels', () => {
    expect(getDailyAdministrationLimit('Once daily (OD)')).toBe(1);
    expect(getDailyAdministrationLimit('Twice daily (BD)')).toBe(2);
    expect(getDailyAdministrationLimit('Three times daily (TDS)')).toBe(3);
    expect(getDailyAdministrationLimit('Four times daily (QDS)')).toBe(4);
    expect(getDailyAdministrationLimit('STAT (immediately)')).toBe(1);
    expect(getDailyAdministrationLimit('3 times a day')).toBe(3);
    expect(getDailyAdministrationLimit('Every 8 hours')).toBe(3);
    expect(getDailyAdministrationLimit('Q6H')).toBe(4);
  });

  it('does not cap PRN administrations', () => {
    expect(getDailyAdministrationLimit('As needed (PRN)')).toBe(Number.POSITIVE_INFINITY);
    expect(getDailyAdministrationLimit({ display: 'PRN', frequencyPerDay: 0 })).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('asNeeded orders', () => {
  it('are not limited by a scheduled frequency', () => {
    const administered = createEmptyAdministeredOrderKeys();
    incrementAdministeredOrderCount(administered, 'prn-order', 'Morphine');
    incrementAdministeredOrderCount(administered, 'prn-order', 'Morphine');

    expect(
      isTreatmentChartOrderLocked(
        { id: 'prn-order', label: 'Morphine' },
        'medicationRows',
        administered,
        createEmptyAdministeredOrderKeys(),
        Number.POSITIVE_INFINITY,
      ),
    ).toBe(false);
  });
});

describe('toLocalDateKey', () => {
  it('reads a leading calendar date from stored observation values', () => {
    expect(toLocalDateKey('2026-10-21 08:15:00')).toBe('2026-10-21');
    expect(toLocalDateKey('2026-10-21T08:15:00.000Z')).toBe('2026-10-21');
  });
});

describe('isTreatmentChartOrderLocked', () => {
  const emptyFluids = createEmptyAdministeredOrderKeys();

  it('allows repeat administrations until the daily frequency is exhausted', () => {
    const administered = createEmptyAdministeredOrderKeys();
    incrementAdministeredOrderCount(administered, 'panadol-order', 'Panadol');
    incrementAdministeredOrderCount(administered, 'panadol-order', 'Panadol');

    const option = { id: 'panadol-order', label: 'Panadol' };
    expect(isTreatmentChartOrderLocked(option, 'medicationRows', administered, emptyFluids, 3)).toBe(false);

    incrementAdministeredOrderCount(administered, 'panadol-order', 'Panadol');
    expect(isTreatmentChartOrderLocked(option, 'medicationRows', administered, emptyFluids, 3)).toBe(true);
  });

  it('uses the revised order uuid so a dose change can be given again the same day', () => {
    const administered = createEmptyAdministeredOrderKeys();
    incrementAdministeredOrderCount(administered, 'panadol-old', 'Panadol');
    incrementAdministeredOrderCount(administered, 'panadol-old', 'Panadol');
    incrementAdministeredOrderCount(administered, 'panadol-old', 'Panadol');

    expect(
      isTreatmentChartOrderLocked(
        { id: 'panadol-new', label: 'Panadol' },
        'medicationRows',
        administered,
        emptyFluids,
        2,
      ),
    ).toBe(false);
  });

  it('does not lock PRN orders after they have already been given', () => {
    const administered = createEmptyAdministeredOrderKeys();
    incrementAdministeredOrderCount(administered, 'morphine-order', 'Morphine');

    expect(
      isTreatmentChartOrderLocked(
        { id: 'morphine-order', label: 'Morphine' },
        'medicationRows',
        administered,
        emptyFluids,
        Number.POSITIVE_INFINITY,
      ),
    ).toBe(false);
  });

  it('counts administrations for the selected section only', () => {
    const medications = createEmptyAdministeredOrderKeys();
    const fluids = createEmptyAdministeredOrderKeys();
    incrementAdministeredOrderCount(fluids, 'normal-saline', 'Normal Saline');

    expect(
      isTreatmentChartOrderLocked(
        { id: 'normal-saline', label: 'Normal Saline' },
        'medicationRows',
        medications,
        fluids,
        1,
      ),
    ).toBe(false);
    expect(
      isTreatmentChartOrderLocked(
        { id: 'normal-saline', label: 'Normal Saline' },
        'fluidRows',
        medications,
        fluids,
        1,
      ),
    ).toBe(true);
  });
});

describe('extractAdministeredOrderKeys', () => {
  const medicationGroupUuid = 'med-group';
  const nameConceptUuid = 'name-concept';
  const timeConceptUuid = 'time-concept';

  const buildEncounter = ({
    encounterDatetime,
    timeValue,
    orderUuid,
    name,
  }: {
    encounterDatetime: string;
    timeValue: string;
    orderUuid?: string;
    name: string;
  }) => ({
    uuid: `${name}-${timeValue}`,
    encounterDatetime,
    obs: [
      {
        uuid: `${name}-group`,
        concept: { uuid: medicationGroupUuid },
        value: null,
        groupMembers: [
          { uuid: `${name}-name`, concept: { uuid: nameConceptUuid }, value: name },
          ...(orderUuid
            ? [
                {
                  uuid: `${name}-meta`,
                  concept: { uuid: nameConceptUuid },
                  value: `${CARDEX_META_PREFIX}${JSON.stringify({ orderUuid })}`,
                },
              ]
            : []),
          { uuid: `${name}-time`, concept: { uuid: timeConceptUuid }, value: timeValue },
        ],
      },
    ],
  });

  it('counts only administrations from today for the current order', () => {
    const today = getTodayDateKey();
    const encounters = [
      buildEncounter({
        encounterDatetime: `${today} 08:00:00`,
        timeValue: `${today} 08:00:00`,
        orderUuid: 'panadol-order',
        name: 'Panadol',
      }),
      buildEncounter({
        encounterDatetime: `${today} 14:00:00`,
        timeValue: `${today} 14:00:00`,
        orderUuid: 'panadol-order',
        name: 'Panadol',
      }),
      buildEncounter({
        encounterDatetime: '2020-01-01 08:00:00',
        timeValue: '2020-01-01 08:00:00',
        orderUuid: 'panadol-order',
        name: 'Panadol',
      }),
    ];

    const administered = extractAdministeredOrderKeys(
      encounters,
      medicationGroupUuid,
      nameConceptUuid,
      timeConceptUuid,
      today,
    );

    expect(getTodayAdministrationCount({ id: 'panadol-order', label: 'Panadol' }, administered)).toBe(2);
    expect(getTodayAdministrationCount({ id: 'other-order', label: 'Panadol' }, administered)).toBe(0);
  });
});

describe('getOrderAdministrationSummary', () => {
  it('shows the current dose, route, and frequency for a revised order', () => {
    expect(
      getOrderAdministrationSummary({
        uuid: 'panadol-new',
        dose: 1,
        doseUnits: { display: 'g' },
        route: { display: 'Oral' },
        frequency: { display: 'Twice daily (BD)', frequencyPerDay: 2 },
      }),
    ).toBe('1 g · Oral · Twice daily (BD)');
  });
});

describe('isActiveMedicationOrder', () => {
  const now = new Date('2026-10-21T12:00:00.000Z');

  it('hides stopped or expired orders so they cannot be administered', () => {
    expect(isActiveMedicationOrder({ uuid: 'active' }, now)).toBe(true);
    expect(isActiveMedicationOrder({ uuid: 'stopped', dateStopped: '2026-10-21T11:00:00.000Z' }, now)).toBe(false);
    expect(isActiveMedicationOrder({ uuid: 'expired', autoExpireDate: '2026-10-20T12:00:00.000Z' }, now)).toBe(false);
    expect(isActiveMedicationOrder({ uuid: 'still-valid', autoExpireDate: '2026-10-22T12:00:00.000Z' }, now)).toBe(true);
  });
});
