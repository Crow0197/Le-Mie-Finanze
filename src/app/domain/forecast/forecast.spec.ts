import { RecurringRule } from '../models/recurring-rule';
import {
  ForecastEntry,
  buildVirtualOccurrences,
  calculateAvailableUntilSalary,
  calculateNetSavings,
  findNextSalary,
  forecastBalanceAt,
} from './forecast';

const rule = (overrides: Partial<RecurringRule>): RecurringRule =>
  ({
    id: 'salary',
    name: 'Stipendio',
    kind: 'salary',
    transactionType: 'income',
    amountCents: 180000,
    accountId: 'bank',
    categoryId: 'income-salary',
    description: 'Stipendio',
    frequency: 'monthly',
    interval: 1,
    dayOfMonth: 27,
    startDate: '2026-01-01',
    nextOccurrenceDate: '2026-09-27',
    autoPost: true,
    status: 'active',
    ...overrides,
  }) as RecurringRule;

const entry = (overrides: Partial<ForecastEntry>): ForecastEntry => ({
  date: '2026-09-20',
  type: 'expense',
  amountCents: 1000,
  description: '',
  isSalary: false,
  virtual: false,
  ...overrides,
});

describe('findNextSalary', () => {
  it('finds the next salary occurrence not registered yet', () => {
    expect(findNextSalary([rule({})], '2026-09-17')).toEqual({ date: '2026-09-27', amountCents: 180000 });
  });

  it('sums salaries falling on the same day and uses the earliest date', () => {
    const rules = [
      rule({}),
      rule({ id: 'second', amountCents: 20000 }),
      rule({ id: 'late', dayOfMonth: 28, nextOccurrenceDate: '2026-09-28' }),
    ];
    expect(findNextSalary(rules, '2026-09-17')).toEqual({ date: '2026-09-27', amountCents: 200000 });
  });

  it('returns null without salary rules', () => {
    expect(findNextSalary([rule({ kind: 'standard' })], '2026-09-17')).toBeNull();
    expect(findNextSalary([rule({ status: 'paused' })], '2026-09-17')).toBeNull();
  });
});

describe('calculateAvailableUntilSalary', () => {
  it('applies planned entries and safety buffer', () => {
    const result = calculateAvailableUntilSalary({
      spendableBalanceCents: 100000,
      entriesBeforeSalary: [entry({ amountCents: 30000 }), entry({ type: 'income', amountCents: 5000 })],
      safetyBufferCents: 20000,
      today: '2026-09-17',
      salaryDate: '2026-09-27',
    });
    expect(result).toEqual({
      startingCents: 100000,
      incomeCents: 5000,
      expenseCents: 30000,
      safetyBufferCents: 20000,
      availableCents: 55000,
      deficitCents: 0,
      dailyCents: 5500,
      daysRemaining: 10,
    });
  });

  it('never shows a negative available amount and reports the deficit', () => {
    const result = calculateAvailableUntilSalary({
      spendableBalanceCents: 10000,
      entriesBeforeSalary: [entry({ amountCents: 30000 })],
      safetyBufferCents: 0,
      today: '2026-09-17',
      salaryDate: '2026-09-18',
    });
    expect(result.availableCents).toBe(0);
    expect(result.deficitCents).toBe(20000);
  });
});

describe('calculateNetSavings', () => {
  it('excludes transfers but counts transfer fees as expenses', () => {
    expect(
      calculateNetSavings([
        entry({ type: 'income', amountCents: 200000 }),
        entry({ amountCents: 50000 }),
        entry({ type: 'transfer', amountCents: 90000, feeCents: 100 }),
      ]),
    ).toEqual({ incomeCents: 200000, expenseCents: 50100, netCents: 149900 });
  });
});

describe('forecast', () => {
  it('forecasts the balance with stored and virtual entries', () => {
    const stored = [entry({ amountCents: 40000, occurrenceKey: 'rent_20261001' })];
    const virtual = buildVirtualOccurrences([rule({})], '2026-09-18', '2026-10-31', new Set());
    expect(virtual.map((item) => item.date)).toEqual(['2026-09-27', '2026-10-27']);
    expect(forecastBalanceAt(100000, [...stored, ...virtual])).toBe(100000 - 40000 + 360000);
  });

  it('does not count occurrences already stored twice', () => {
    const virtual = buildVirtualOccurrences([rule({})], '2026-09-18', '2026-10-31', new Set(['salary_20260927']));
    expect(virtual.map((item) => item.date)).toEqual(['2026-10-27']);
  });

  it('ignores paused rules', () => {
    expect(buildVirtualOccurrences([rule({ status: 'paused' })], '2026-09-18', '2026-10-31', new Set())).toEqual([]);
  });
});
