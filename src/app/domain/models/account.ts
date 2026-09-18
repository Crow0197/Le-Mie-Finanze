import type { Timestamp } from 'firebase/firestore';

export type AccountType = 'bank' | 'card' | 'cash' | 'savings' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalanceCents: number;
  currentBalanceCents: number;
  includeInNetWorth: boolean;
  includeInAvailable: boolean;
  icon: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Conto bancario',
  card: 'Carta',
  cash: 'Contanti',
  savings: 'Risparmio',
  other: 'Altro',
};
