import { buildReport } from './reports';

const categories = [
  { id: 'leisure', name: 'Svago', color: '#8a5cb8', parentId: null },
  { id: 'travel', name: 'Viaggi', color: '#8a5cb8', parentId: 'leisure' },
  { id: 'going-out', name: 'Uscite', color: '#8a5cb8', parentId: 'leisure' },
  { id: 'fees', name: 'Commissioni', color: '#687873', parentId: null },
  { id: 'salary', name: 'Stipendio', color: '#176b51', parentId: null },
];

const transactions = [
  { type: 'expense' as const, status: 'confirmed' as const, amountCents: 30000, categoryId: 'travel', effectiveDate: '2026-08-02' },
  { type: 'expense' as const, status: 'confirmed' as const, amountCents: 5000, categoryId: 'going-out', effectiveDate: '2026-09-05' },
  { type: 'income' as const, status: 'confirmed' as const, amountCents: 200000, categoryId: 'salary', effectiveDate: '2026-09-27' },
  { type: 'transfer' as const, status: 'confirmed' as const, amountCents: 50000, feeCents: 100, effectiveDate: '2026-09-10' },
  { type: 'expense' as const, status: 'planned' as const, amountCents: 99999, categoryId: 'travel', effectiveDate: '2026-09-20' },
];

describe('buildReport', () => {
  it('groups by month and excludes transfers and planned transactions', () => {
    const report = buildReport(transactions, categories, 'month', 'macro', 'fees');
    expect(report.periods).toEqual([
      { key: '2026-08', incomeCents: 0, expenseCents: 30000, netCents: -30000 },
      { key: '2026-09', incomeCents: 200000, expenseCents: 5100, netCents: 194900 },
    ]);
    expect(report.expenseCents).toBe(35100);
  });

  it('sums sub categories into their macro category', () => {
    const report = buildReport(transactions, categories, 'all', 'macro', 'fees');
    expect(report.expenseByCategory.map((item) => [item.name, item.amountCents])).toEqual([
      ['Svago', 35000],
      ['Commissioni', 100],
    ]);
  });

  it('shows sub categories in detail level', () => {
    const report = buildReport(transactions, categories, 'year', 'detail', 'fees');
    expect(report.expenseByCategory.map((item) => item.name)).toEqual(['Viaggi', 'Uscite', 'Commissioni']);
    expect(report.periods.map((period) => period.key)).toEqual(['2026']);
  });
});
