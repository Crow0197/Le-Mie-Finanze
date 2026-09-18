import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { RecurrenceSyncService } from '../../core/state/recurrence-sync.service';
import { TransactionActions } from '../../core/state/transaction-actions.service';
import { UserDataStore } from '../../core/state/user-data.store';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { addDaysToLocalDate, todayInTimeZone } from '../../domain/dates/local-date';
import { buildVirtualOccurrences, calculateNetSavings, toForecastEntry } from '../../domain/forecast/forecast';
import { RECURRENCE_FREQUENCY_LABELS, RecurringRule } from '../../domain/models/recurring-rule';
import { Transaction } from '../../domain/models/transaction';
import { nextOccurrenceOnOrAfter } from '../../domain/recurrence/recurrence';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { AppDialogService } from '../../shared/ui/dialog/app-dialog.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon } from '../../shared/ui/icon/icon';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';
import { TransactionItem } from '../../shared/ui/transaction-item/transaction-item';
import {
  forecastToListEntry,
  transactionToListEntry,
} from '../../shared/ui/transaction-item/transaction-list-entry';
import { ConfirmPlannedDialog } from './confirm-planned-dialog';
import { RecurringRuleForm, RecurringRuleFormData, WEEKDAY_LABELS } from './recurring-rule-form';

const UPCOMING_DAYS = 60;

@Component({
  selector: 'app-recurring-page',
  imports: [FormsModule, NgTemplateOutlet, LocalDatePipe, MoneyPipe, EmptyState, Icon, Skeleton, TransactionItem],
  templateUrl: './recurring-page.html',
})
export class RecurringPage {
  protected readonly store = inject(UserDataStore);
  private readonly repository = inject(TransactionRepository);
  private readonly transactionActions = inject(TransactionActions);
  private readonly recurrenceSync = inject(RecurrenceSyncService);
  private readonly appDialog = inject(AppDialogService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly frequencyLabels = RECURRENCE_FREQUENCY_LABELS;
  protected readonly today = todayInTimeZone();
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly planned = signal<Transaction[]>([]);
  /** New account chosen for rules paused because their account was archived. */
  protected readonly replacementAccounts = signal<Record<string, string>>({});

  protected readonly salaryRules = computed(() =>
    this.store.rules().filter((rule) => rule.kind === 'salary' && rule.status !== 'completed'),
  );
  protected readonly otherRules = computed(() =>
    this.store
      .rules()
      .filter((rule) => rule.kind !== 'salary')
      .sort((a, b) => statusOrder(a) - statusOrder(b) || a.name.localeCompare(b.name)),
  );

  protected readonly due = computed(() =>
    this.planned()
      .filter((transaction) => transaction.effectiveDate <= this.today)
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
      .map((transaction) => ({ transaction, entry: transactionToListEntry(transaction) })),
  );

  private readonly upcomingEntries = computed(() => {
    const salaryIds = new Set(this.salaryRules().map((rule) => rule.id));
    const stored = this.planned()
      .filter((transaction) => transaction.effectiveDate > this.today)
      .map((transaction) => toForecastEntry(transaction, salaryIds));
    const keys = new Set(stored.map((entry) => entry.occurrenceKey).filter((key): key is string => !!key));
    const virtual = buildVirtualOccurrences(
      this.store.rules(),
      addDaysToLocalDate(this.today, 1),
      addDaysToLocalDate(this.today, UPCOMING_DAYS),
      keys,
    );
    return [...stored, ...virtual].sort((a, b) => a.date.localeCompare(b.date));
  });

  protected readonly upcoming = computed(() => this.upcomingEntries().map(forecastToListEntry));

  /** Recap shown above the 60-day list, so the user sees at a glance whether it nets positive or negative. */
  protected readonly upcomingSummary = computed(() => calculateNetSavings(this.upcomingEntries()));

  constructor() {
    effect(() => {
      this.transactionActions.version();
      if (this.store.loaded()) {
        untracked(() => void this.load());
      }
    });
  }

  protected scheduleLabel(rule: RecurringRule): string {
    if (rule.frequency === 'weekly') {
      return `Ogni ${WEEKDAY_LABELS[rule.dayOfWeek ?? 1].toLowerCase()}`;
    }
    const day = `giorno ${rule.dayOfMonth}`;
    if (rule.frequency === 'customMonths') {
      return `Ogni ${rule.interval} mesi, ${day}`;
    }
    return `${this.frequencyLabels[rule.frequency]}, ${day}`;
  }

  protected accountName(rule: RecurringRule): string {
    return this.store.accountsById().get(rule.accountId)?.name ?? 'Conto non trovato';
  }

  protected openRuleForm(kind: 'salary' | 'standard', rule?: RecurringRule): void {
    this.appDialog.open<boolean, RecurringRuleFormData>(RecurringRuleForm, { kind, rule }, 'rule-form-title');
  }

  protected confirm(transaction: Transaction): void {
    this.appDialog
      .open<number, Transaction>(ConfirmPlannedDialog, transaction, 'confirm-planned-title')
      .closed.subscribe((amountCents) => {
        if (amountCents) {
          void this.run(() => this.transactionActions.confirm(transaction, amountCents));
        }
      });
  }

  protected remove(transaction: Transaction): void {
    void this.transactionActions.remove(transaction);
  }

  protected setReplacement(ruleId: string, accountId: string): void {
    this.replacementAccounts.update((value) => ({ ...value, [ruleId]: accountId }));
  }

  protected async pause(rule: RecurringRule): Promise<void> {
    await this.run(async () => {
      await this.store.updateRule(rule.id, { status: 'paused', pausedReason: null });
      this.snackbar.show(`${rule.name} sospesa.`);
    });
  }

  /** Resumes from today: occurrences skipped while the rule was paused are not recovered. */
  protected async resume(rule: RecurringRule): Promise<void> {
    const accountId = rule.pausedReason === 'accountArchived' ? this.replacementAccounts()[rule.id] : rule.accountId;
    const account = this.store.accountsById().get(accountId ?? '');
    if (!account || account.archived) {
      this.snackbar.show('Scegli prima un conto attivo per questa ricorrenza.');
      return;
    }
    const nextOccurrenceDate = nextOccurrenceOnOrAfter(rule, this.today);
    await this.run(async () => {
      await this.store.updateRule(rule.id, {
        accountId: account.id,
        status: nextOccurrenceDate ? 'active' : 'completed',
        pausedReason: null,
        nextOccurrenceDate: nextOccurrenceDate ?? rule.nextOccurrenceDate,
      });
      await this.recurrenceSync.sync();
      this.snackbar.show(`${rule.name} riattivata.`);
    });
  }

  protected async complete(rule: RecurringRule): Promise<void> {
    await this.run(async () => {
      await this.store.updateRule(rule.id, { status: 'completed', pausedReason: null, endDate: this.today });
      this.snackbar.show(`${rule.name} conclusa.`);
    });
  }

  protected removeRule(rule: RecurringRule): void {
    const data: ConfirmDialogData = {
      title: `Eliminare ${rule.name}?`,
      message: 'La ricorrenza sparisce dalle previsioni. I movimenti già registrati restano nello storico.',
      confirmLabel: 'Elimina',
      danger: true,
    };
    this.appDialog.open<boolean>(ConfirmDialog, data, 'confirm-dialog-title').closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.run(async () => {
          await this.store.removeRule(rule.id);
          this.snackbar.show(`${rule.name} eliminata.`);
        });
      }
    });
  }

  private async load(): Promise<void> {
    this.errorMessage.set(null);
    try {
      const planned = await this.repository.listPlanned(this.store.uid);
      this.planned.set(planned.filter((transaction) => !transaction.deletedAt));
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      this.snackbar.show(getFirebaseErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}

function statusOrder(rule: RecurringRule): number {
  return rule.status === 'active' ? 0 : rule.status === 'paused' ? 1 : 2;
}
