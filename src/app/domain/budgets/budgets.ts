import { Budget } from '../models/budget';
import { Category } from '../models/category';
import { Transaction } from '../models/transaction';

export const BUDGET_WARNING_PERCENT = 80;

export type BudgetLevel = 'ok' | 'warning' | 'over';

export interface BudgetUsage {
  usedCents: number;
  remainingCents: number;
  percent: number;
  level: BudgetLevel;
}

type BudgetTransaction = Pick<Transaction, 'type' | 'status' | 'amountCents' | 'feeCents' | 'categoryId' | 'effectiveDate'> & {
  deletedAt?: unknown;
};

/**
 * General budgets count every confirmed expense and transfer fee of the month.
 * Category budgets count the category and its sub categories.
 */
export function calculateBudgetUsage(
  budget: Pick<Budget, 'month' | 'categoryId' | 'limitCents'>,
  transactions: readonly BudgetTransaction[],
  categories: readonly Pick<Category, 'id' | 'parentId'>[],
  feesCategoryId: string,
): BudgetUsage {
  const categoryIds = budget.categoryId
    ? new Set([budget.categoryId, ...categories.filter((c) => c.parentId === budget.categoryId).map((c) => c.id)])
    : null;

  let usedCents = 0;
  for (const transaction of transactions) {
    if (transaction.status !== 'confirmed' || transaction.deletedAt || !transaction.effectiveDate.startsWith(budget.month)) {
      continue;
    }
    if (transaction.type === 'expense' && (!categoryIds || categoryIds.has(transaction.categoryId ?? ''))) {
      usedCents += transaction.amountCents;
    }
    if (transaction.type === 'transfer' && transaction.feeCents && (!categoryIds || categoryIds.has(feesCategoryId))) {
      usedCents += transaction.feeCents;
    }
  }

  const percent = budget.limitCents > 0 ? Math.round((usedCents / budget.limitCents) * 100) : 0;
  return {
    usedCents,
    remainingCents: budget.limitCents - usedCents,
    percent,
    level: percent > 100 ? 'over' : percent >= BUDGET_WARNING_PERCENT ? 'warning' : 'ok',
  };
}
