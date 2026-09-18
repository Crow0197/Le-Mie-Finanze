const DEFAULT_LOCALE = 'it-IT';
const DEFAULT_CURRENCY = 'EUR';

export function formatCents(
  cents: number,
  locale: string = DEFAULT_LOCALE,
  currency: string = DEFAULT_CURRENCY,
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/**
 * Converte un importo digitato dall'utente in centesimi senza passare da numeri decimali.
 * La virgola è il separatore decimale; senza virgola, un punto seguito da una o due cifre
 * finali viene trattato come decimale (tastiere numeriche mobile), altrimenti come migliaia.
 */
export function parseAmountToCents(input: string): number | null {
  const value = input.trim().replace(/[\s€]/g, '');
  if (!value) {
    return null;
  }

  let integerPart: string;
  let decimalPart = '';
  const commaIndex = value.lastIndexOf(',');

  if (commaIndex >= 0) {
    integerPart = value.slice(0, commaIndex).replace(/\./g, '');
    decimalPart = value.slice(commaIndex + 1);
  } else {
    const match = /^(.*)\.(\d{1,2})$/.exec(value);
    if (match) {
      integerPart = match[1].replace(/\./g, '');
      decimalPart = match[2];
    } else {
      integerPart = value.replace(/\./g, '');
    }
  }

  if (!/^\d+$/.test(integerPart) || !/^\d{0,2}$/.test(decimalPart)) {
    return null;
  }

  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Like parseAmountToCents but also accepts zero and negative values, for balances. */
export function parseSignedAmountToCents(input: string): number | null {
  const value = input.trim();
  const negative = value.startsWith('-');
  const cents = parseAmountToCents(negative ? value.slice(1) : value);
  if (cents === null) {
    return value === '0' ? 0 : null;
  }
  return negative ? -cents : cents;
}

/** Formats cents for an input field, for example 123456 -> "1234,56". */
export function formatCentsForInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
}

/** Amount with an explicit sign, so the meaning never depends on color alone. */
export function formatSignedCents(cents: number, sign: 'positive' | 'negative' | 'none'): string {
  const formatted = formatCents(Math.abs(cents));
  if (sign === 'positive') {
    return `+${formatted}`;
  }
  if (sign === 'negative') {
    return `−${formatted}`;
  }
  return formatted;
}
