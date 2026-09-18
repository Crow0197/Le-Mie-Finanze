import { endOfMonthDate, formatLocalDate, isLocalDate, resolveViewPeriod, todayInTimeZone } from './local-date';

describe('local dates', () => {
  it('computes today in Europe/Rome regardless of device time zone', () => {
    expect(todayInTimeZone('Europe/Rome', new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });

  it('computes the end of month for leap years', () => {
    expect(endOfMonthDate('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonthDate('2026-02-10')).toBe('2026-02-28');
  });

  it('validates local dates', () => {
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-02-28')).toBe(true);
  });

  it('resolves view periods', () => {
    expect(resolveViewPeriod({ preset: 'all' }, '2026-01-15')).toEqual({});
    expect(resolveViewPeriod({ preset: 'previousMonth' }, '2026-01-15')).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    });
    expect(resolveViewPeriod({ preset: 'last3Months' }, '2026-03-15')).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    });
  });
});

describe('formatLocalDate', () => {
  it('formats dates in Italian', () => {
    expect(formatLocalDate('2026-09-17')).toBe('17 set 2026');
    expect(formatLocalDate('2026-09', 'month')).toBe('settembre 2026');
  });
});
