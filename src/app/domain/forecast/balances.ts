import { Account } from '../models/account';

type BalanceAccount = Pick<Account, 'currentBalanceCents' | 'includeInNetWorth' | 'includeInAvailable'>;

export function calculateNetWorthCents(accounts: readonly BalanceAccount[]): number {
  return accounts
    .filter((account) => account.includeInNetWorth)
    .reduce((total, account) => total + account.currentBalanceCents, 0);
}

export function calculateAvailableCents(accounts: readonly BalanceAccount[]): number {
  return accounts
    .filter((account) => account.includeInAvailable)
    .reduce((total, account) => total + account.currentBalanceCents, 0);
}
