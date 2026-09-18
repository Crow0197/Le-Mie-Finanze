import { RecurrenceSchedule, buildOccurrenceKey, listOccurrences, nextOccurrenceOnOrAfter } from './recurrence';

const monthly = (dayOfMonth: number, startDate = '2026-01-01'): RecurrenceSchedule => ({
  frequency: 'monthly',
  interval: 1,
  dayOfMonth,
  startDate,
});

describe('monthly recurrences', () => {
  it('uses the last valid day in short months for day 31', () => {
    expect(listOccurrences(monthly(31), '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('handles day 30 and day 29 in February of normal and leap years', () => {
    expect(listOccurrences(monthly(30), '2026-02-01', '2026-03-31')).toEqual(['2026-02-28', '2026-03-30']);
    expect(listOccurrences(monthly(29, '2028-01-01'), '2028-02-01', '2028-02-29')).toEqual(['2028-02-29']);
    expect(listOccurrences(monthly(29), '2026-02-01', '2026-02-28')).toEqual(['2026-02-28']);
  });

  it('does not drift after a short month', () => {
    expect(listOccurrences(monthly(31, '2026-02-01'), '2026-02-01', '2026-03-31')).toEqual([
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('skips the start month when the day is before the start date', () => {
    expect(listOccurrences(monthly(10, '2026-01-15'), '2026-01-01', '2026-02-28')).toEqual(['2026-02-10']);
  });

  it('crosses the end of the year', () => {
    expect(listOccurrences(monthly(27, '2026-11-01'), '2026-11-01', '2027-02-28')).toEqual([
      '2026-11-27',
      '2026-12-27',
      '2027-01-27',
      '2027-02-27',
    ]);
  });

  it('respects the end date', () => {
    expect(listOccurrences({ ...monthly(5), endDate: '2026-03-04' }, '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-05',
      '2026-02-05',
    ]);
  });

  it('supports every N months', () => {
    expect(
      listOccurrences(
        { frequency: 'customMonths', interval: 3, dayOfMonth: 15, startDate: '2026-01-01' },
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']);
  });
});

describe('weekly and yearly recurrences', () => {
  it('uses the configured weekday', () => {
    // 2026-03-02 is a Monday; dayOfWeek 5 is Friday.
    expect(
      listOccurrences(
        { frequency: 'weekly', interval: 1, dayOfWeek: 5, startDate: '2026-03-02' },
        '2026-03-01',
        '2026-03-31',
      ),
    ).toEqual(['2026-03-06', '2026-03-13', '2026-03-20', '2026-03-27']);
  });

  it('keeps weekly dates stable across daylight saving time changes', () => {
    expect(
      listOccurrences(
        { frequency: 'weekly', interval: 1, dayOfWeek: 0, startDate: '2026-03-22' },
        '2026-03-22',
        '2026-04-05',
      ),
    ).toEqual(['2026-03-22', '2026-03-29', '2026-04-05']);
  });

  it('moves 29 February to 28 February in non leap years', () => {
    expect(
      listOccurrences(
        { frequency: 'yearly', interval: 1, dayOfMonth: 29, startDate: '2028-02-29' },
        '2028-01-01',
        '2031-12-31',
      ),
    ).toEqual(['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28']);
  });
});

describe('nextOccurrenceOnOrAfter', () => {
  it('returns the same day when it is an occurrence', () => {
    expect(nextOccurrenceOnOrAfter(monthly(27), '2026-09-27')).toBe('2026-09-27');
  });

  it('returns null after the end date', () => {
    expect(nextOccurrenceOnOrAfter({ ...monthly(27), endDate: '2026-09-30' }, '2026-10-01')).toBeNull();
  });
});

describe('buildOccurrenceKey', () => {
  it('builds a deterministic key', () => {
    expect(buildOccurrenceKey('rule1', '2026-02-28')).toBe('rule1_20260228');
  });
});
