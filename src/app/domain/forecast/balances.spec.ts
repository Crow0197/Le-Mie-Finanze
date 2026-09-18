import { calculateAvailableCents, calculateNetWorthCents } from './balances';

const accounts = [
  { currentBalanceCents: 150000, includeInNetWorth: true, includeInAvailable: true },
  { currentBalanceCents: 500000, includeInNetWorth: true, includeInAvailable: false },
  { currentBalanceCents: -2500, includeInNetWorth: true, includeInAvailable: true },
  { currentBalanceCents: 99999, includeInNetWorth: false, includeInAvailable: false },
];

describe('calculateNetWorthCents', () => {
  it('sums only accounts included in net worth, negative balances included', () => {
    expect(calculateNetWorthCents(accounts)).toBe(647500);
  });

  it('returns zero without accounts', () => {
    expect(calculateNetWorthCents([])).toBe(0);
  });
});

describe('calculateAvailableCents', () => {
  it('sums only accounts included in available money', () => {
    expect(calculateAvailableCents(accounts)).toBe(147500);
  });
});
