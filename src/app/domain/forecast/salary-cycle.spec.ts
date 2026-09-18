import { RecurringRule } from '../models/recurring-rule';
import { resolveSalaryCycleRange } from './salary-cycle';

const salary = (overrides: Partial<RecurringRule> = {}): RecurringRule =>
  ({
    id: 'salary',
    name: 'Stipendio',
    kind: 'salary',
    transactionType: 'income',
    amountCents: 200000,
    accountId: 'account',
    categoryId: 'income-salary',
    description: 'Stipendio',
    frequency: 'monthly',
    interval: 1,
    dayOfMonth: 14,
    startDate: '2026-01-14',
    nextOccurrenceDate: '2026-10-14',
    autoPost: true,
    status: 'active',
    pausedReason: null,
    ...overrides,
  }) as RecurringRule;

describe('resolveSalaryCycleRange', () => {
  it('goes from the last salary to the day before the next one', () => {
    expect(resolveSalaryCycleRange([salary()], '2026-09-18')).toEqual({
      startDate: '2026-09-14',
      endDate: '2026-10-13',
    });
  });

  it('starts on the salary day itself', () => {
    expect(resolveSalaryCycleRange([salary()], '2026-09-14')).toEqual({
      startDate: '2026-09-14',
      endDate: '2026-10-13',
    });
  });

  it('uses the last day of short months', () => {
    expect(resolveSalaryCycleRange([salary({ dayOfMonth: 31 })], '2026-09-18')).toEqual({
      startDate: '2026-08-31',
      endDate: '2026-09-29',
    });
  });

  it('steps back one month when the rule was created after the last payday', () => {
    expect(
      resolveSalaryCycleRange([salary({ startDate: '2026-09-17', nextOccurrenceDate: '2026-10-14' })], '2026-09-18'),
    ).toEqual({ startDate: '2026-09-14', endDate: '2026-10-13' });
  });

  it('returns null without an active salary', () => {
    expect(resolveSalaryCycleRange([salary({ status: 'paused' })], '2026-09-18')).toBeNull();
    expect(resolveSalaryCycleRange([], '2026-09-18')).toBeNull();
  });
});
