import type { Timestamp } from 'firebase/firestore';

export type TransactionType = 'expense' | 'income' | 'transfer';
export type TransactionStatus = 'confirmed' | 'planned';

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amountCents: number;
  effectiveDate: string;
  description: string;
  notes?: string;
  categoryId?: string;
  accountId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  feeCents?: number;
  recurringRuleId?: string;
  occurrenceKey?: string;
  deletedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TransactionDraft = Omit<Transaction, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>;

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Spesa',
  income: 'Entrata',
  transfer: 'Trasferimento',
};

export function toTransactionDraft(transaction: Transaction): TransactionDraft {
  return {
    type: transaction.type,
    status: transaction.status,
    amountCents: transaction.amountCents,
    effectiveDate: transaction.effectiveDate,
    description: transaction.description,
    notes: transaction.notes,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    sourceAccountId: transaction.sourceAccountId,
    destinationAccountId: transaction.destinationAccountId,
    feeCents: transaction.feeCents,
    recurringRuleId: transaction.recurringRuleId,
    occurrenceKey: transaction.occurrenceKey,
  };
}
