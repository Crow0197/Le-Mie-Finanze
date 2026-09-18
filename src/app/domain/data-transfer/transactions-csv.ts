import { TRANSACTION_TYPE_LABELS, Transaction } from '../models/transaction';

const SEPARATOR = ';';

interface NamedItem {
  id: string;
  name: string;
}

/** CSV for spreadsheet apps configured for Italy: semicolon separator and comma decimals. */
export function buildTransactionsCsv(
  transactions: readonly Transaction[],
  accounts: readonly NamedItem[],
  categories: readonly NamedItem[],
): string {
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const name = (map: Map<string, string>, id?: string) => (id ? (map.get(id) ?? '') : '');

  const header = [
    'Data',
    'Tipo',
    'Stato',
    'Descrizione',
    'Categoria',
    'Conto',
    'Conto destinazione',
    'Importo',
    'Commissione',
    'Note',
  ];
  const rows = transactions
    .filter((transaction) => !transaction.deletedAt)
    .map((transaction) => [
      transaction.effectiveDate,
      TRANSACTION_TYPE_LABELS[transaction.type],
      transaction.status === 'confirmed' ? 'Confermata' : 'Pianificata',
      transaction.description,
      name(categoryNames, transaction.categoryId),
      name(accountNames, transaction.type === 'transfer' ? transaction.sourceAccountId : transaction.accountId),
      name(accountNames, transaction.destinationAccountId),
      formatCsvAmount(transaction.type === 'expense' ? -transaction.amountCents : transaction.amountCents),
      transaction.feeCents ? formatCsvAmount(transaction.feeCents) : '',
      transaction.notes ?? '',
    ]);

  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(SEPARATOR)).join('\r\n');
}

export function formatCsvAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
}

export function escapeCsvValue(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
