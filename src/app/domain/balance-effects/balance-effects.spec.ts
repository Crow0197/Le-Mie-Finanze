import { BalanceTransaction, diffBalanceEffects, getBalanceEffects, recalculateBalances } from './balance-effects';

const expense: BalanceTransaction = { type: 'expense', status: 'confirmed', amountCents: 2500, accountId: 'bank' };
const income: BalanceTransaction = { type: 'income', status: 'confirmed', amountCents: 150000, accountId: 'bank' };
const transfer: BalanceTransaction = {
  type: 'transfer',
  status: 'confirmed',
  amountCents: 10000,
  feeCents: 150,
  sourceAccountId: 'bank',
  destinationAccountId: 'savings',
};

describe('getBalanceEffects', () => {
  it('subtracts confirmed expenses', () => {
    expect(getBalanceEffects(expense)).toEqual({ bank: -2500 });
  });

  it('adds confirmed incomes', () => {
    expect(getBalanceEffects(income)).toEqual({ bank: 150000 });
  });

  it('moves transfers and charges the fee only to the source account', () => {
    expect(getBalanceEffects(transfer)).toEqual({ bank: -10150, savings: 10000 });
  });

  it('ignores planned and deleted transactions', () => {
    expect(getBalanceEffects({ ...expense, status: 'planned' })).toEqual({});
    expect(getBalanceEffects({ ...expense, deletedAt: new Date() })).toEqual({});
  });
});

describe('diffBalanceEffects', () => {
  it('reverts the previous state and applies the new one when editing', () => {
    const edited = { ...expense, amountCents: 4000, accountId: 'card' };
    expect(diffBalanceEffects(expense, edited)).toEqual({ bank: 2500, card: -4000 });
  });

  it('removes zero deltas', () => {
    expect(diffBalanceEffects(expense, { ...expense, description: 'x' } as BalanceTransaction)).toEqual({});
  });

  it('restores the balance when a transaction is deleted and applies it again on undo', () => {
    const deleted = { ...transfer, deletedAt: new Date() };
    expect(diffBalanceEffects(transfer, deleted)).toEqual({ bank: 10150, savings: -10000 });
    expect(diffBalanceEffects(deleted, transfer)).toEqual({ bank: -10150, savings: 10000 });
  });

  it('applies balances when a planned transaction is confirmed', () => {
    expect(diffBalanceEffects({ ...income, status: 'planned' }, income)).toEqual({ bank: 150000 });
  });
});

describe('recalculateBalances', () => {
  it('rebuilds balances from opening balance and confirmed transactions', () => {
    const accounts = [
      { id: 'bank', openingBalanceCents: 100000 },
      { id: 'savings', openingBalanceCents: 0 },
    ];
    const result = recalculateBalances(accounts, [
      expense,
      income,
      transfer,
      { ...expense, status: 'planned' },
      { ...income, deletedAt: new Date() },
    ]);
    expect(result).toEqual({ bank: 100000 - 2500 + 150000 - 10150, savings: 10000 });
  });
});
