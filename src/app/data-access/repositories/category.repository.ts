import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { FIRESTORE } from '../../core/firebase/firebase.providers';
import { Category } from '../../domain/models/category';
import { Transaction } from '../../domain/models/transaction';
import { userCollection, userItemDocument } from '../firestore-paths';

export type CategoryDraft = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class CategoryRepository {
  private readonly firestore = inject(FIRESTORE);

  async listAll(uid: string): Promise<Category[]> {
    const snapshot = await getDocs(
      query(userCollection<Category>(this.firestore, uid, 'categories'), orderBy('sortOrder')),
    );
    return snapshot.docs.map((document) => document.data());
  }

  async create(uid: string, draft: CategoryDraft): Promise<Category> {
    const reference = doc(userCollection<Category>(this.firestore, uid, 'categories'));
    await setDoc(userItemDocument(this.firestore, uid, 'categories', reference.id), {
      ...draft,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...draft, id: reference.id, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  }

  async update(uid: string, id: string, changes: Partial<CategoryDraft>): Promise<void> {
    await updateDoc(userItemDocument(this.firestore, uid, 'categories', id), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  }

  async delete(uid: string, id: string): Promise<void> {
    await deleteDoc(userItemDocument(this.firestore, uid, 'categories', id));
  }

  async isUsed(uid: string, id: string): Promise<boolean> {
    const snapshot = await getDocs(
      query(userCollection<Transaction>(this.firestore, uid, 'transactions'), where('categoryId', '==', id), limit(1)),
    );
    return !snapshot.empty;
  }
}
