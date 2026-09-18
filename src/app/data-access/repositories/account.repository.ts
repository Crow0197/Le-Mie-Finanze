import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { FIRESTORE } from '../../core/firebase/firebase.providers';
import { Account } from '../../domain/models/account';
import { userCollection, userItemDocument } from '../firestore-paths';

export type AccountDraft = Omit<Account, 'id' | 'currentBalanceCents' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class AccountRepository {
  private readonly firestore = inject(FIRESTORE);

  async listAll(uid: string): Promise<Account[]> {
    const snapshot = await getDocs(
      query(userCollection<Account>(this.firestore, uid, 'accounts'), orderBy('sortOrder')),
    );
    return snapshot.docs.map((document) => document.data());
  }

  async create(uid: string, draft: AccountDraft): Promise<Account> {
    const reference = doc(userCollection<Account>(this.firestore, uid, 'accounts'));
    const data = { ...draft, currentBalanceCents: draft.openingBalanceCents };
    await setDoc(userItemDocument(this.firestore, uid, 'accounts', reference.id), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...data, id: reference.id, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  }

  /** Changing the opening balance moves the current balance by the same difference. */
  async update(uid: string, account: Account, draft: AccountDraft): Promise<Account> {
    const openingDelta = draft.openingBalanceCents - account.openingBalanceCents;
    const batch = writeBatch(this.firestore);
    batch.update(userItemDocument(this.firestore, uid, 'accounts', account.id), {
      ...draft,
      currentBalanceCents: increment(openingDelta),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return {
      ...account,
      ...draft,
      currentBalanceCents: account.currentBalanceCents + openingDelta,
      updatedAt: Timestamp.now(),
    };
  }

  /** Archives the account and pauses the active recurring rules that use it, atomically. */
  async archive(uid: string, accountId: string, ruleIdsToPause: readonly string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.update(userItemDocument(this.firestore, uid, 'accounts', accountId), {
      archived: true,
      updatedAt: serverTimestamp(),
    });
    for (const ruleId of ruleIdsToPause) {
      batch.update(userItemDocument(this.firestore, uid, 'recurringRules', ruleId), {
        status: 'paused',
        pausedReason: 'accountArchived',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  async restore(uid: string, accountId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.update(userItemDocument(this.firestore, uid, 'accounts', accountId), {
      archived: false,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  }

  async reorder(uid: string, orderedIds: readonly string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    orderedIds.forEach((id, index) => {
      batch.update(userItemDocument(this.firestore, uid, 'accounts', id), {
        sortOrder: index,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  async setBalances(uid: string, balances: Record<string, number>): Promise<void> {
    const batch = writeBatch(this.firestore);
    for (const [id, currentBalanceCents] of Object.entries(balances)) {
      batch.update(userItemDocument(this.firestore, uid, 'accounts', id), {
        currentBalanceCents,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}
