import { Category } from '../models/category';
import { Transaction } from '../models/transaction';

export type ReportGranularity = 'day' | 'month' | 'year' | 'all';
export type ReportLevel = 'macro' | 'detail';

export interface ReportCategoryTotal {
  categoryId: string;
  name: string;
  color: string;
  amountCents: number;
}

export interface ReportPeriod {
  key: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

export interface Report {
  periods: ReportPeriod[];
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  expenseByCategory: ReportCategoryTotal[];
  incomeByCategory: ReportCategoryTotal[];
}

type ReportTransaction = Pick<
  Transaction,
  'type' | 'status' | 'amountCents' | 'feeCents' | 'categoryId' | 'effectiveDate'
> & { deletedAt?: unknown };

export const UNCATEGORIZED_ID = 'uncategorized';

/**
 * Confirmed incomes and expenses grouped by period and category. Transfers are excluded,
 * transfer fees are counted as expenses of the fees category.
 */
export function buildReport(
  transactions: readonly ReportTransaction[],
  categories: readonly Pick<Category, 'id' | 'name' | 'color' | 'parentId'>[],
  granularity: ReportGranularity,
  level: ReportLevel,
  feesCategoryId: string,
): Report {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const periods = new Map<string, ReportPeriod>();
  const expenses = new Map<string, ReportCategoryTotal>();
  const incomes = new Map<string, ReportCategoryTotal>();

  const add = (target: Map<string, ReportCategoryTotal>, categoryId: string | undefined, amountCents: number) => {
    let category = categoryId ? categoriesById.get(categoryId) : undefined;
    if (category && level === 'macro' && category.parentId) {
      category = categoriesById.get(category.parentId) ?? category;
    }
    const id = category?.id ?? UNCATEGORIZED_ID;
    const total = target.get(id) ?? {
      categoryId: id,
      name: category?.name ?? 'Senza categoria',
      color: category?.color ?? '#687873',
      amountCents: 0,
    };
    total.amountCents += amountCents;
    target.set(id, total);
  };

  for (const transaction of transactions) {
    if (transaction.status !== 'confirmed' || transaction.deletedAt) {
      continue;
    }
    const key = periodKey(transaction.effectiveDate, granularity);
    const period = periods.get(key) ?? { key, incomeCents: 0, expenseCents: 0, netCents: 0 };

    if (transaction.type === 'income') {
      period.incomeCents += transaction.amountCents;
      add(incomes, transaction.categoryId, transaction.amountCents);
    } else if (transaction.type === 'expense') {
      period.expenseCents += transaction.amountCents;
      add(expenses, transaction.categoryId, transaction.amountCents);
    } else if (transaction.feeCents) {
      period.expenseCents += transaction.feeCents;
      add(expenses, feesCategoryId, transaction.feeCents);
    }
    period.netCents = period.incomeCents - period.expenseCents;
    periods.set(key, period);
  }

  const sortedPeriods = [...periods.values()].sort((a, b) => a.key.localeCompare(b.key));
  const incomeCents = sortedPeriods.reduce((total, period) => total + period.incomeCents, 0);
  const expenseCents = sortedPeriods.reduce((total, period) => total + period.expenseCents, 0);
  const byAmount = (a: ReportCategoryTotal, b: ReportCategoryTotal) => b.amountCents - a.amountCents;

  return {
    periods: sortedPeriods,
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    expenseByCategory: [...expenses.values()].sort(byAmount),
    incomeByCategory: [...incomes.values()].sort(byAmount),
  };
}

export function periodKey(date: string, granularity: ReportGranularity): string {
  switch (granularity) {
    case 'day':
      return date;
    case 'month':
      return date.slice(0, 7);
    case 'year':
      return date.slice(0, 4);
    case 'all':
      return 'all';
  }
}
