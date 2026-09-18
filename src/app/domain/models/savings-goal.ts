import type { Timestamp } from 'firebase/firestore';

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmountCents: number;
  targetDate?: string;
  accountId?: string;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
