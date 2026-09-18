import type { Timestamp } from 'firebase/firestore';

export type CategoryAppliesTo = 'expense' | 'income' | 'both';

/**
 * Categories have two levels: a macro category (parentId null) and optional sub categories.
 */
export interface Category {
  id: string;
  name: string;
  appliesTo: CategoryAppliesTo;
  parentId: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  system: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
