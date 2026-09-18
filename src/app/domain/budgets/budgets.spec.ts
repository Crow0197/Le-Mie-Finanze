import { calculateBudgetUsage } from './budgets';

const categories = [
  { id: 'food', parentId: null },
  { id: 'groceries', parentId: 'food' },
  { id: 'fees', parentId: null },
];

const transactions = [
  { type: 'expense' as const, status: 'confirmed' as const, amountCents: 30000, categoryId: 'groceries', effectiveDate: '2026-09-02' },
  { type: 'expense' as const, status: 'confirmed' as const, amountCents: 10000, categoryId: 'food', effectiveDate: '2026-09-05' },
  { type: 'expense' as const, status: 'confirmed' as const, amountCents: 5000, categoryId: 'other', effectiveDate: '2026-09-05' },
  { type: 'expense' as const, status: 'planned' as const, amountCents: 99999, categoryId: 'food', effectiveDate: '2026-09-20' },
  { type: 'expense' as const, status: 'confirmed' as const, amountCents: 7000, categoryId: 'food', effectiveDate: '2026-08-30' },
  { type: 'transfer' as const, status: 'confirmed' as const, amountCents: 50000, feeCents: 200, effectiveDate: '2026-09-10' },
  { type: 'income' as const, status: 'confirmed' as const, amountCents: 200000, effectiveDate: '2026-09-27' },
];

describe('calculateBudgetUsage', () => {
  it('counts every expense and fee for the general budget', () => {
    expect(calculateBudgetUsage({ month: '2026-09', limitCents: 50000 }, transactions, categories, 'fees')).toEqual({
      usedCents: 45200,
      remainingCents: 4800,
      percent: 90,
      level: 'warning',
    });
  });

  it('counts the macro category and its sub categories', () => {
    const usage = calculateBudgetUsage({ month: '2026-09', categoryId: 'food', limitCents: 30000 }, transactions, categories, 'fees');
    expect(usage.usedCents).toBe(40000);
    expect(usage.level).toBe('over');
    expect(usage.remainingCents).toBe(-10000);
  });

  it('stays ok below 80 percent', () => {
    expect(calculateBudgetUsage({ month: '2026-09', limitCents: 100000 }, transactions, categories, 'fees').level).toBe('ok');
  });
});
