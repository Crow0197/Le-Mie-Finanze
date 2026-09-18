import { Transaction } from '../models/transaction';
import { validateBackup } from './backup';
import { buildTransactionsCsv, formatCsvAmount } from './transactions-csv';

describe('buildTransactionsCsv', () => {
  it('uses Italian separators and escapes values', () => {
    const csv = buildTransactionsCsv(
      [
        {
          id: '1',
          type: 'expense',
          status: 'confirmed',
          amountCents: 123456,
          effectiveDate: '2026-09-17',
          description: 'Spesa; "grande"',
          accountId: 'bank',
          categoryId: 'food',
          deletedAt: null,
        } as Transaction,
      ],
      [{ id: 'bank', name: 'Banca' }],
      [{ id: 'food', name: 'Alimentari' }],
    );
    expect(csv.split('\r\n')[1]).toBe('2026-09-17;Spesa;Confermata;"Spesa; ""grande""";Alimentari;Banca;;-1234,56;;');
  });

  it('formats amounts', () => {
    expect(formatCsvAmount(5)).toBe('0,05');
    expect(formatCsvAmount(-120000)).toBe('-1200,00');
  });
});

describe('validateBackup', () => {
  const valid = {
    app: 'le-mie-finanze',
    schemaVersion: 1,
    exportedAt: '2026-09-17T10:00:00.000Z',
    settings: {},
    collections: {
      accounts: [{ id: 'bank' }],
      categories: [],
      transactions: [{ id: 't1', amountCents: 100 }],
      recurringRules: [],
      quickTemplates: [],
      savingsGoals: [],
      budgets: [],
    },
  };

  it('accepts a valid backup', () => {
    expect(validateBackup(valid).errors).toEqual([]);
  });

  it('rejects foreign files and invalid amounts', () => {
    expect(validateBackup({ foo: 1 }).backup).toBeNull();
    const invalid = { ...valid, collections: { ...valid.collections, transactions: [{ id: 't1', amountCents: -5 }] } };
    expect(validateBackup(invalid).errors.length).toBe(1);
  });
});
