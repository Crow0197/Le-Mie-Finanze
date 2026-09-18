import { ForecastEntry } from '../../../domain/forecast/forecast';
import { Transaction } from '../../../domain/models/transaction';
import { TransactionListEntry } from './transaction-item';

export function transactionToListEntry(transaction: Transaction): TransactionListEntry {
  return {
    type: transaction.type,
    amountCents: transaction.amountCents,
    feeCents: transaction.feeCents,
    date: transaction.effectiveDate,
    description: transaction.description,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    sourceAccountId: transaction.sourceAccountId,
    destinationAccountId: transaction.destinationAccountId,
    planned: transaction.status === 'planned',
    recurring: !!transaction.recurringRuleId,
  };
}

export function forecastToListEntry(entry: ForecastEntry): TransactionListEntry {
  return {
    type: entry.type,
    amountCents: entry.amountCents,
    feeCents: entry.feeCents,
    date: entry.date,
    description: entry.description,
    categoryId: entry.categoryId,
    accountId: entry.accountId,
    sourceAccountId: entry.sourceAccountId,
    destinationAccountId: entry.destinationAccountId,
    planned: true,
    recurring: !!entry.recurringRuleId,
    virtual: entry.virtual,
  };
}
