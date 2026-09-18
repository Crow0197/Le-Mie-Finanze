import { Injectable, inject } from '@angular/core';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { addDaysToLocalDate, todayInTimeZone } from '../../domain/dates/local-date';
import { RecurringRule } from '../../domain/models/recurring-rule';
import { buildOccurrenceKey, listOccurrences, nextOccurrenceOnOrAfter } from '../../domain/recurrence/recurrence';
import { TransactionActions } from './transaction-actions.service';
import { UserDataStore } from './user-data.store';

/**
 * Client side recurrence engine: stores every due occurrence of the active rules up to today.
 * Occurrences use deterministic ids, so running it again (or on another device) never duplicates them.
 */
@Injectable({ providedIn: 'root' })
export class RecurrenceSyncService {
  private readonly store = inject(UserDataStore);
  private readonly repository = inject(TransactionRepository);
  private readonly transactionActions = inject(TransactionActions);
  private running: Promise<void> | null = null;

  sync(): Promise<void> {
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  private async run(): Promise<void> {
    await this.store.load();
    const today = todayInTimeZone();
    let changed = false;

    for (const rule of this.store.rules()) {
      if (rule.status !== 'active' || rule.nextOccurrenceDate > today) {
        continue;
      }
      for (const date of listOccurrences(rule, rule.nextOccurrenceDate, today)) {
        const nextOccurrenceDate = nextOccurrenceOnOrAfter(rule, addDaysToLocalDate(date, 1));
        const created = await this.repository.postOccurrence(this.store.uid, {
          rule,
          draft: buildOccurrenceDraft(rule, date),
          nextOccurrenceDate: nextOccurrenceDate ?? addDaysToLocalDate(date, 1),
          completed: nextOccurrenceDate === null,
        });
        this.store.patchRule(rule.id, {
          nextOccurrenceDate: nextOccurrenceDate ?? addDaysToLocalDate(date, 1),
          ...(nextOccurrenceDate === null ? { status: 'completed' } : {}),
        });
        changed ||= created;
      }
    }

    if (changed) {
      // Balances were updated inside Firestore transactions: reload them instead of guessing.
      await this.store.refresh();
      this.transactionActions.notifyChange(null);
    }
  }
}

function buildOccurrenceDraft(rule: RecurringRule, date: string) {
  return {
    type: rule.transactionType,
    status: rule.autoPost ? ('confirmed' as const) : ('planned' as const),
    amountCents: rule.amountCents,
    effectiveDate: date,
    description: rule.description || rule.name,
    notes: rule.notes,
    categoryId: rule.categoryId,
    accountId: rule.accountId,
    recurringRuleId: rule.id,
    occurrenceKey: buildOccurrenceKey(rule.id, date),
  };
}
