import type { Timestamp } from 'firebase/firestore';
import { TransactionType } from './transaction';

export interface QuickTemplate {
  id: string;
  name: string;
  type: TransactionType;
  amountCents?: number;
  description?: string;
  categoryId?: string;
  accountId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  notes?: string;
  favorite: boolean;
  sortOrder: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const MAX_FAVORITE_TEMPLATES = 4;
