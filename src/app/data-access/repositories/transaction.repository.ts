import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Query,
  QueryConstraint,
  QueryDocumentSnapshot,
  Timestamp,
  WriteBatch,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
} from 'firebase/firestore';
import { FIRESTORE } from '../../core/firebase/firebase.providers';
import { BalanceEffects, diffBalanceEffects } from '../../domain/balance-effects/balance-effects';
import { DateRange } from '../../domain/dates/local-date';
import { RecurringRule } from '../../domain/models/recurring-rule';
import { Transaction, TransactionDraft } from '../../domain/models/transaction';
import { userCollection, userItemDocument } from '../firestore-paths';

export interface TransactionPage {
  items: Transaction[];
  cursor: QueryDocumentSnapshot<Transaction> | null;
  hasMore: boolean;
}

export interface OccurrencePosting {
  rule: RecurringRule;
  draft: TransactionDraft;
  nextOccurrenceDate: string;
  completed: boolean;
}

@Injectable({ providedIn: 'root' })
export class TransactionRepository {
  private readonly firestore = inject(FIRESTORE);

  /** Saves the transaction and updates account balances in a single atomic batch. */
  async create(uid: string, draft: TransactionDraft): Promise<{ transaction: Transaction; effects: BalanceEffects }> {
    const reference = doc(this.collection(uid));
    const effects = diffBalanceEffects(null, draft);
    const batch = writeBatch(this.firestore);
    batch.set(userItemDocument(this.firestore, uid, 'transactions', reference.id), {
      ...draft,
      deletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.applyEffects(batch, uid, effects);
    await batch.commit();
    const now = Timestamp.now();
    return { transaction: { ...draft, id: reference.id, deletedAt: null, createdAt: now, updatedAt: now }, effects };
  }

  /** Reverts the previous balance effects and applies the new ones together with the document change. */
  async update(
    uid: string,
    previous: Transaction,
    draft: TransactionDraft,
  ): Promise<{ transaction: Transaction; effects: BalanceEffects }> {
    const effects = diffBalanceEffects(previous, draft);
    const batch = writeBatch(this.firestore);
    batch.set(userItemDocument(this.firestore, uid, 'transactions', previous.id), {
      ...draft,
      deletedAt: null,
      createdAt: previous.createdAt,
      updatedAt: serverTimestamp(),
    });
    this.applyEffects(batch, uid, effects);
    await batch.commit();
    return { transaction: { ...draft, id: previous.id, deletedAt: null, createdAt: previous.createdAt, updatedAt: Timestamp.now() }, effects };
  }

  async softDelete(uid: string, transaction: Transaction): Promise<{ transaction: Transaction; effects: BalanceEffects }> {
    const deletedAt = Timestamp.now();
    return this.setDeletedAt(uid, transaction, deletedAt);
  }

  async restore(uid: string, transaction: Transaction): Promise<{ transaction: Transaction; effects: BalanceEffects }> {
    return this.setDeletedAt(uid, transaction, null);
  }

  /** Cursor based page ordered by date, newest first. */
  async listPage(
    uid: string,
    range: DateRange,
    cursor: QueryDocumentSnapshot<Transaction> | null,
    pageSize: number,
  ): Promise<TransactionPage> {
    const constraints: QueryConstraint[] = [...this.rangeConstraints(range), orderBy('effectiveDate', 'desc')];
    if (cursor) {
      constraints.push(startAfter(cursor));
    }
    constraints.push(limit(pageSize + 1));
    const snapshot = await getDocs(query(this.collection(uid), ...constraints));
    const documents = snapshot.docs.slice(0, pageSize);
    return {
      items: documents.map((document) => document.data()),
      cursor: documents.at(-1) ?? null,
      hasMore: snapshot.docs.length > pageSize,
    };
  }

  async listRange(uid: string, range: DateRange): Promise<Transaction[]> {
    return this.list(query(this.collection(uid), ...this.rangeConstraints(range)));
  }

  async listRecent(uid: string, count: number): Promise<Transaction[]> {
    return this.list(query(this.collection(uid), orderBy('effectiveDate', 'desc'), limit(count)));
  }

  async listPlanned(uid: string): Promise<Transaction[]> {
    return this.list(query(this.collection(uid), where('status', '==', 'planned')));
  }

  async listAll(uid: string): Promise<Transaction[]> {
    return this.list(query(this.collection(uid)));
  }

  /**
   * Stores a recurring occurrence with a deterministic id. Reading the document inside the transaction
   * makes the operation idempotent, so the same occurrence can never be created twice.
   */
  async postOccurrence(uid: string, posting: OccurrencePosting): Promise<boolean> {
    const id = posting.draft.occurrenceKey ?? '';
    const transactionReference = userItemDocument(this.firestore, uid, 'transactions', id);
    const ruleReference = userItemDocument(this.firestore, uid, 'recurringRules', posting.rule.id);

    return runTransaction(this.firestore, async (firestoreTransaction) => {
      const existing = await firestoreTransaction.get(transactionReference);
      if (!existing.exists()) {
        firestoreTransaction.set(transactionReference, {
          ...posting.draft,
          deletedAt: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        for (const [accountId, delta] of Object.entries(diffBalanceEffects(null, posting.draft))) {
          firestoreTransaction.update(userItemDocument(this.firestore, uid, 'accounts', accountId), {
            currentBalanceCents: increment(delta),
            updatedAt: serverTimestamp(),
          });
        }
      }
      firestoreTransaction.update(ruleReference, {
        nextOccurrenceDate: posting.nextOccurrenceDate,
        ...(posting.completed ? { status: 'completed' } : {}),
        updatedAt: serverTimestamp(),
      });
      return !existing.exists();
    });
  }

  private async setDeletedAt(
    uid: string,
    transaction: Transaction,
    deletedAt: Timestamp | null,
  ): Promise<{ transaction: Transaction; effects: BalanceEffects }> {
    const next = { ...transaction, deletedAt };
    const effects = diffBalanceEffects(transaction, next);
    const batch = writeBatch(this.firestore);
    batch.update(userItemDocument(this.firestore, uid, 'transactions', transaction.id), {
      deletedAt,
      updatedAt: serverTimestamp(),
    });
    this.applyEffects(batch, uid, effects);
    await batch.commit();
    return { transaction: next, effects };
  }

  private applyEffects(batch: WriteBatch, uid: string, effects: BalanceEffects): void {
    for (const [accountId, delta] of Object.entries(effects)) {
      batch.update(userItemDocument(this.firestore, uid, 'accounts', accountId), {
        currentBalanceCents: increment(delta),
        updatedAt: serverTimestamp(),
      });
    }
  }

  private rangeConstraints(range: DateRange): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];
    if (range.startDate) {
      constraints.push(where('effectiveDate', '>=', range.startDate));
    }
    if (range.endDate) {
      constraints.push(where('effectiveDate', '<=', range.endDate));
    }
    return constraints;
  }

  private async list(transactionsQuery: Query<Transaction, DocumentData>): Promise<Transaction[]> {
    const snapshot = await getDocs(transactionsQuery);
    return snapshot.docs.map((document) => document.data());
  }

  private collection(uid: string) {
    return userCollection<Transaction>(this.firestore, uid, 'transactions');
  }
}
