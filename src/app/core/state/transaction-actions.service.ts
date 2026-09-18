import { Injectable, inject, signal } from '@angular/core';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { todayInTimeZone } from '../../domain/dates/local-date';
import {
  TRANSACTION_TYPE_LABELS,
  Transaction,
  TransactionDraft,
  toTransactionDraft,
} from '../../domain/models/transaction';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';
import { getFirebaseErrorMessage } from '../error-handling/firebase-error-message';
import { UserDataStore } from './user-data.store';

/**
 * Transaction writes shared by every screen: atomic balance updates, local balance mirror and undo.
 */
@Injectable({ providedIn: 'root' })
export class TransactionActions {
  private readonly repository = inject(TransactionRepository);
  private readonly store = inject(UserDataStore);
  private readonly snackbar = inject(SnackbarService);
  private readonly versionState = signal(0);
  private readonly lastChangedIdState = signal<string | null>(null);

  /** Incremented after every change so that screens can reload their data. */
  readonly version = this.versionState.asReadonly();
  /** Id of the last created or updated transaction, used for a short highlight. */
  readonly lastChangedId = this.lastChangedIdState.asReadonly();

  async create(draft: TransactionDraft): Promise<Transaction> {
    const { transaction, effects } = await this.repository.create(this.store.uid, normalize(draft));
    this.store.applyBalanceEffects(effects);
    this.notifyChange(transaction.id);
    this.snackbar.show(`${TRANSACTION_TYPE_LABELS[transaction.type]} salvata.`, {
      actionLabel: 'Annulla',
      action: () => void this.remove(transaction, false),
    });
    return transaction;
  }

  async update(previous: Transaction, draft: TransactionDraft): Promise<Transaction> {
    const { transaction, effects } = await this.repository.update(this.store.uid, previous, normalize(draft));
    this.store.applyBalanceEffects(effects);
    this.notifyChange(transaction.id);
    this.snackbar.show('Modifiche salvate.');
    return transaction;
  }

  async remove(transaction: Transaction, offerUndo = true): Promise<void> {
    try {
      const result = await this.repository.softDelete(this.store.uid, transaction);
      this.store.applyBalanceEffects(result.effects);
      this.notifyChange(null);
      if (offerUndo) {
        this.snackbar.show('Operazione eliminata.', {
          actionLabel: 'Annulla',
          action: () => void this.restore(result.transaction),
        });
      } else {
        this.snackbar.show('Operazione annullata.');
      }
    } catch (error) {
      this.snackbar.show(getFirebaseErrorMessage(error));
    }
  }

  async restore(transaction: Transaction): Promise<void> {
    try {
      const result = await this.repository.restore(this.store.uid, transaction);
      this.store.applyBalanceEffects(result.effects);
      this.notifyChange(transaction.id);
      this.snackbar.show('Operazione ripristinata.');
    } catch (error) {
      this.snackbar.show(getFirebaseErrorMessage(error));
    }
  }

  /** Confirms a planned transaction, optionally with a different amount for this occurrence only. */
  async confirm(transaction: Transaction, amountCents: number = transaction.amountCents): Promise<void> {
    await this.update(transaction, { ...toTransactionDraft(transaction), amountCents, status: 'confirmed' });
  }

  notifyChange(id: string | null): void {
    this.lastChangedIdState.set(id);
    this.versionState.update((version) => version + 1);
  }
}

/** Future dated operations are always stored as planned: they must not change the current balance. */
function normalize(draft: TransactionDraft): TransactionDraft {
  const today = todayInTimeZone();
  return {
    ...draft,
    description: draft.description.trim(),
    status: draft.effectiveDate > today ? 'planned' : draft.status,
  };
}
