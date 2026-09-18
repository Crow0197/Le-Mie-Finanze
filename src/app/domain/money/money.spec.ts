import {
  formatCents,
  formatCentsForInput,
  formatSignedCents,
  parseAmountToCents,
  parseSignedAmountToCents,
} from './money';

const normalizeSpaces = (value: string) => value.replace(/\s/g, ' ');

describe('formatCents', () => {
  it('formats cents as euro in Italian locale', () => {
    expect(normalizeSpaces(formatCents(12345))).toBe('123,45 €');
  });

  it('formats thousands and negative values', () => {
    expect(normalizeSpaces(formatCents(123456789))).toBe('1.234.567,89 €');
    expect(normalizeSpaces(formatCents(-500))).toBe('-5,00 €');
  });

  it('formats zero', () => {
    expect(normalizeSpaces(formatCents(0))).toBe('0,00 €');
  });
});

describe('parseAmountToCents', () => {
  it('parses integer amounts', () => {
    expect(parseAmountToCents('12')).toBe(1200);
  });

  it('parses comma decimals', () => {
    expect(parseAmountToCents('12,3')).toBe(1230);
    expect(parseAmountToCents('12,34')).toBe(1234);
  });

  it('parses thousands separators', () => {
    expect(parseAmountToCents('1.234,56')).toBe(123456);
    expect(parseAmountToCents('1.234')).toBe(123400);
  });

  it('parses dot decimals from mobile keyboards', () => {
    expect(parseAmountToCents('12.5')).toBe(1250);
    expect(parseAmountToCents('12.34')).toBe(1234);
  });

  it('ignores spaces and euro symbol', () => {
    expect(parseAmountToCents(' 45,90 € ')).toBe(4590);
  });

  it('avoids floating point errors', () => {
    expect(parseAmountToCents('0,29')).toBe(29);
    expect(parseAmountToCents('1,15')).toBe(115);
  });

  it('rejects invalid values', () => {
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents('-5')).toBeNull();
    expect(parseAmountToCents('12,345')).toBeNull();
    expect(parseAmountToCents('1,2,3')).toBeNull();
  });
});

describe('parseSignedAmountToCents', () => {
  it('accepts zero and negative balances', () => {
    expect(parseSignedAmountToCents('0')).toBe(0);
    expect(parseSignedAmountToCents('-12,50')).toBe(-1250);
    expect(parseSignedAmountToCents('300')).toBe(30000);
    expect(parseSignedAmountToCents('abc')).toBeNull();
  });
});

describe('formatCentsForInput and formatSignedCents', () => {
  it('formats values for inputs and signed amounts', () => {
    expect(formatCentsForInput(123456)).toBe('1234,56');
    expect(formatCentsForInput(-5)).toBe('-0,05');
    expect(normalizeSpaces(formatSignedCents(1250, 'positive'))).toBe('+12,50 €');
    expect(normalizeSpaces(formatSignedCents(1250, 'negative'))).toBe('−12,50 €');
  });
});
