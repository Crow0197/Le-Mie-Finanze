import { Injectable, inject } from '@angular/core';
import { Timestamp, doc, getDocs, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { FIRESTORE } from '../../core/firebase/firebase.providers';
import { SavingsGoal } from '../../domain/models/savings-goal';
import { userCollection, userItemDocument } from '../firestore-paths';

export type SavingsGoalDraft = Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class SavingsGoalRepository {
  private readonly firestore = inject(FIRESTORE);

  async listAll(uid: string): Promise<SavingsGoal[]> {
    const snapshot = await getDocs(query(userCollection<SavingsGoal>(this.firestore, uid, 'savingsGoals')));
    return snapshot.docs.map((document) => document.data());
  }

  async create(uid: string, draft: SavingsGoalDraft): Promise<SavingsGoal> {
    const reference = doc(userCollection<SavingsGoal>(this.firestore, uid, 'savingsGoals'));
    await setDoc(userItemDocument(this.firestore, uid, 'savingsGoals', reference.id), {
      ...draft,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...draft, id: reference.id, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  }

  async update(uid: string, id: string, changes: Partial<SavingsGoalDraft>): Promise<void> {
    await updateDoc(userItemDocument(this.firestore, uid, 'savingsGoals', id), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  }
}
