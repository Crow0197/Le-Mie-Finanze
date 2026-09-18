import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { FIRESTORE } from '../../core/firebase/firebase.providers';
import { QuickTemplate } from '../../domain/models/quick-template';
import { userCollection, userItemDocument } from '../firestore-paths';

export type QuickTemplateDraft = Omit<QuickTemplate, 'id' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class QuickTemplateRepository {
  private readonly firestore = inject(FIRESTORE);

  async listAll(uid: string): Promise<QuickTemplate[]> {
    const snapshot = await getDocs(
      query(userCollection<QuickTemplate>(this.firestore, uid, 'quickTemplates'), orderBy('sortOrder')),
    );
    return snapshot.docs.map((document) => document.data());
  }

  async create(uid: string, draft: QuickTemplateDraft): Promise<QuickTemplate> {
    const reference = doc(userCollection<QuickTemplate>(this.firestore, uid, 'quickTemplates'));
    await setDoc(userItemDocument(this.firestore, uid, 'quickTemplates', reference.id), {
      ...draft,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...draft, id: reference.id, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  }

  async update(uid: string, id: string, changes: Partial<QuickTemplateDraft>): Promise<void> {
    await updateDoc(userItemDocument(this.firestore, uid, 'quickTemplates', id), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  }

  async reorder(uid: string, orderedIds: readonly string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    orderedIds.forEach((id, index) => {
      batch.update(userItemDocument(this.firestore, uid, 'quickTemplates', id), {
        sortOrder: index,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}
