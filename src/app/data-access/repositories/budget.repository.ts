import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { FIRESTORE } from '../../core/firebase/firebase.providers';
import { Budget } from '../../domain/models/budget';
import { userCollection, userItemDocument } from '../firestore-paths';

export type BudgetDraft = Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class BudgetRepository {
  private readonly firestore = inject(FIRESTORE);

  async listByMonth(uid: string, month: string): Promise<Budget[]> {
    const snapshot = await getDocs(
      query(userCollection<Budget>(this.firestore, uid, 'budgets'), where('month', '==', month)),
    );
    return snapshot.docs.map((document) => document.data()).filter((budget) => !budget.archived);
  }

  async create(uid: string, draft: BudgetDraft): Promise<Budget> {
    const reference = doc(userCollection<Budget>(this.firestore, uid, 'budgets'));
    await setDoc(userItemDocument(this.firestore, uid, 'budgets', reference.id), {
      ...draft,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...draft, id: reference.id, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  }

  async update(uid: string, id: string, changes: Partial<BudgetDraft>): Promise<void> {
    await updateDoc(userItemDocument(this.firestore, uid, 'budgets', id), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  }

  async createMany(uid: string, drafts: readonly BudgetDraft[]): Promise<Budget[]> {
    const batch = writeBatch(this.firestore);
    const now = Timestamp.now();
    const created = drafts.map((draft) => {
      const reference = doc(userCollection<Budget>(this.firestore, uid, 'budgets'));
      batch.set(userItemDocument(this.firestore, uid, 'budgets', reference.id), {
        ...draft,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { ...draft, id: reference.id, createdAt: now, updatedAt: now };
    });
    await batch.commit();
    return created;
  }
}
