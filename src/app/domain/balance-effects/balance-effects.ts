import { Transaction } from '../models/transaction';

/** Balance change in cents for each account id. */
export type BalanceEffects = Record<string, number>;

export type BalanceTransaction = Pick<
  Transaction,
  'type' | 'status' | 'amountCents' | 'accountId' | 'sourceAccountId' | 'destinationAccountId' | 'feeCents'
> & { deletedAt?: unknown };

export function getBalanceEffects(transaction: BalanceTransaction | null): BalanceEffects {
  const effects: BalanceEffects = {};
  if (!transaction || transaction.status !== 'confirmed' || transaction.deletedAt) {
    return effects;
  }

  switch (transaction.type) {
    case 'expense':
      addEffect(effects, transaction.accountId, -transaction.amountCents);
      break;
    case 'income':
      addEffect(effects, transaction.accountId, transaction.amountCents);
      break;
    case 'transfer':
      addEffect(effects, transaction.sourceAccountId, -(transaction.amountCents + (transaction.feeCents ?? 0)));
      addEffect(effects, transaction.destinationAccountId, transaction.amountCents);
      break;
  }
  return effects;
}

/** Effects to apply to move from the previous transaction state to the next one. */
export function diffBalanceEffects(
  previous: BalanceTransaction | null,
  next: BalanceTransaction | null,
): BalanceEffects {
  const result: BalanceEffects = {};
  for (const [accountId, delta] of Object.entries(getBalanceEffects(previous))) {
    addEffect(result, accountId, -delta);
  }
  for (const [accountId, delta] of Object.entries(getBalanceEffects(next))) {
    addEffect(result, accountId, delta);
  }
  return Object.fromEntries(Object.entries(result).filter(([, delta]) => delta !== 0));
}

export function recalculateBalances(
  accounts: readonly { id: string; openingBalanceCents: number }[],
  transactions: readonly BalanceTransaction[],
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const account of accounts) {
    balances[account.id] = account.openingBalanceCents;
  }
  for (const transaction of transactions) {
    for (const [accountId, delta] of Object.entries(getBalanceEffects(transaction))) {
      if (accountId in balances) {
        balances[accountId] += delta;
      }
    }
  }
  return balances;
}

function addEffect(effects: BalanceEffects, accountId: string | undefined, delta: number): void {
  if (!accountId) {
    return;
  }
  effects[accountId] = (effects[accountId] ?? 0) + delta;
}
