import { monthlyDates, simulate } from './simulation';

const entry = (date: string, amountCents: number, description = 'voce') => ({ date, amountCents, description });

describe('simulate', () => {
  it('follows the balance day by day with and without the scenario', () => {
    const result = simulate(
      100000,
      [entry('2026-09-20', -20000, 'affitto'), entry('2026-09-25', 50000, 'stipendio')],
      [entry('2026-09-22', -30000, 'imprevisto')],
      '2026-09-18',
      '2026-09-30',
    );
    expect(result.baseEndCents).toBe(130000);
    expect(result.scenarioEndCents).toBe(100000);
    expect(result.differenceCents).toBe(-30000);
    expect(result.points.length).toBe(13);
    expect(result.points[0]).toEqual({ date: '2026-09-18', baseCents: 100000, scenarioCents: 100000 });
    expect(result.points[4]).toEqual({ date: '2026-09-22', baseCents: 80000, scenarioCents: 50000 });
  });

  it('reports the lowest point and the first day below zero', () => {
    const result = simulate(
      10000,
      [entry('2026-09-25', 50000, 'stipendio')],
      [entry('2026-09-20', -30000, 'imprevisto')],
      '2026-09-18',
      '2026-09-30',
    );
    expect(result.minCents).toBe(-20000);
    expect(result.minDate).toBe('2026-09-20');
    expect(result.firstNegativeDate).toBe('2026-09-20');
    expect(result.scenarioEndCents).toBe(30000);
  });

  it('has no negative day when the scenario stays affordable', () => {
    const result = simulate(50000, [], [entry('2026-09-20', -10000, 'rata')], '2026-09-18', '2026-09-30');
    expect(result.firstNegativeDate).toBeNull();
    expect(result.monthlyImpactCents).toBe(-10000);
  });

  it('ignores movements outside the period', () => {
    const result = simulate(50000, [entry('2026-10-05', -10000, 'fuori')], [], '2026-09-18', '2026-09-30');
    expect(result.baseEndCents).toBe(50000);
  });
});

describe('monthlyDates', () => {
  it('returns one date per month', () => {
    expect(monthlyDates(5, '2026-09-18', '2026-12-31')).toEqual(['2026-10-05', '2026-11-05', '2026-12-05']);
  });

  it('uses the last day of short months', () => {
    expect(monthlyDates(31, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
});
