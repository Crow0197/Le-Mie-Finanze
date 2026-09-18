import { daysBetween } from '../dates/local-date';
import { RecurringRule } from '../models/recurring-rule';
import { Transaction } from '../models/transaction';
import { buildOccurrenceKey, listOccurrences, nextOccurrenceOnOrAfter } from '../recurrence/recurrence';

export interface ForecastEntry {
  date: string;
  type: Transaction['type'];
  amountCents: number;
  feeCents?: number;
  description: string;
  categoryId?: string;
  accountId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  occurrenceKey?: string;
  recurringRuleId?: string;
  isSalary: boolean;
  /** True when generated from a rule and not stored in Firestore. */
  virtual: boolean;
}

export function toForecastEntry(transaction: Transaction, salaryRuleIds: ReadonlySet<string>): ForecastEntry {
  return {
    date: transaction.effectiveDate,
    type: transaction.type,
    amountCents: transaction.amountCents,
    feeCents: transaction.feeCents,
    description: transaction.description,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    sourceAccountId: transaction.sourceAccountId,
    destinationAccountId: transaction.destinationAccountId,
    occurrenceKey: transaction.occurrenceKey,
    recurringRuleId: transaction.recurringRuleId,
    isSalary: !!transaction.recurringRuleId && salaryRuleIds.has(transaction.recurringRuleId),
    virtual: false,
  };
}

/**
 * Occurrences of active rules between from and to that are not stored yet.
 * Stored occurrences are recognised by their occurrenceKey to avoid double counting.
 */
export function buildVirtualOccurrences(
  rules: readonly RecurringRule[],
  from: string,
  to: string,
  storedOccurrenceKeys: ReadonlySet<string>,
): ForecastEntry[] {
  const entries: ForecastEntry[] = [];
  for (const rule of rules) {
    if (rule.status !== 'active') {
      continue;
    }
    const start = rule.nextOccurrenceDate > from ? rule.nextOccurrenceDate : from;
    for (const date of listOccurrences(rule, start, to)) {
      const occurrenceKey = buildOccurrenceKey(rule.id, date);
      if (storedOccurrenceKeys.has(occurrenceKey)) {
        continue;
      }
      entries.push({
        date,
        type: rule.transactionType,
        amountCents: rule.amountCents,
        description: rule.description || rule.name,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        occurrenceKey,
        recurringRuleId: rule.id,
        isSalary: rule.kind === 'salary',
        virtual: true,
      });
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export interface NextSalary {
  date: string;
  amountCents: number;
}

/**
 * First salary occurrence not registered yet. Multiple salaries on the same day are summed.
 */
export function findNextSalary(
  rules: readonly RecurringRule[],
  today: string,
  plannedSalaryEntries: readonly ForecastEntry[] = [],
): NextSalary | null {
  const candidates: NextSalary[] = [];
  for (const rule of rules) {
    if (rule.kind !== 'salary' || rule.status !== 'active') {
      continue;
    }
    const from = rule.nextOccurrenceDate > today ? rule.nextOccurrenceDate : today;
    const date = nextOccurrenceOnOrAfter(rule, from);
    if (date) {
      candidates.push({ date, amountCents: rule.amountCents });
    }
  }
  for (const entry of plannedSalaryEntries) {
    if (entry.isSalary && entry.date >= today) {
      candidates.push({ date: entry.date, amountCents: entry.amountCents });
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  const firstDate = candidates.map((candidate) => candidate.date).sort()[0];
  return {
    date: firstDate,
    amountCents: candidates
      .filter((candidate) => candidate.date === firstDate)
      .reduce((total, candidate) => total + candidate.amountCents, 0),
  };
}

export interface AvailableUntilSalary {
  /** Spendable balance the period starts from. */
  startingCents: number;
  /** Incomes expected before the salary, salary excluded. */
  incomeCents: number;
  /** Expenses expected before the salary: recurring ones and planned operations. */
  expenseCents: number;
  safetyBufferCents: number;
  availableCents: number;
  deficitCents: number;
  dailyCents: number;
  daysRemaining: number;
}

export function calculateAvailableUntilSalary(params: {
  spendableBalanceCents: number;
  entriesBeforeSalary: readonly ForecastEntry[];
  safetyBufferCents: number;
  today: string;
  salaryDate: string;
}): AvailableUntilSalary {
  const { incomeCents, expenseCents } = calculateNetSavings(params.entriesBeforeSalary);
  const raw = params.spendableBalanceCents + incomeCents - expenseCents - params.safetyBufferCents;
  const daysRemaining = Math.max(1, daysBetween(params.today, params.salaryDate));
  const availableCents = Math.max(0, raw);
  return {
    startingCents: params.spendableBalanceCents,
    incomeCents,
    expenseCents,
    safetyBufferCents: params.safetyBufferCents,
    availableCents,
    deficitCents: raw < 0 ? -raw : 0,
    dailyCents: Math.floor(availableCents / daysRemaining),
    daysRemaining,
  };
}

export interface NetSavings {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

/** Transfers are excluded; transfer fees count as expenses. */
export function calculateNetSavings(
  entries: readonly Pick<ForecastEntry, 'type' | 'amountCents' | 'feeCents'>[],
): NetSavings {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const entry of entries) {
    if (entry.type === 'income') {
      incomeCents += entry.amountCents;
    } else if (entry.type === 'expense') {
      expenseCents += entry.amountCents;
    } else {
      expenseCents += entry.feeCents ?? 0;
    }
  }
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

export function forecastBalanceAt(netWorthCents: number, futureEntries: readonly ForecastEntry[]): number {
  return netWorthCents + calculateNetSavings(futureEntries).netCents;
}
