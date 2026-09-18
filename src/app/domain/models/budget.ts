import type { Timestamp } from 'firebase/firestore';

export interface Budget {
  id: string;
  /** Month in YYYY-MM format. */
  month: string;
  /** Missing for the general monthly budget. */
  categoryId?: string;
  limitCents: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
