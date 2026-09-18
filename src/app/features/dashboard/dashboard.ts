import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { TransactionActions } from '../../core/state/transaction-actions.service';
import { UserDataStore } from '../../core/state/user-data.store';
import { ViewPeriodService } from '../../core/state/view-period.service';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import {
  addDaysToLocalDate,
  endOfMonthDate,
  startOfMonthDate,
  todayInTimeZone,
} from '../../domain/dates/local-date';
import { calculateAvailableCents, calculateNetWorthCents } from '../../domain/forecast/balances';
import {
  buildVirtualOccurrences,
  calculateAvailableUntilSalary,
  calculateNetSavings,
  findNextSalary,
  toForecastEntry,
} from '../../domain/forecast/forecast';
import { Transaction } from '../../domain/models/transaction';
import { VIEW_PERIOD_LABELS, ViewPeriodPreset } from '../../domain/models/user-settings';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon, toIconName } from '../../shared/ui/icon/icon';
import { InfoHint } from '../../shared/ui/info-hint/info-hint';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { TransactionItem } from '../../shared/ui/transaction-item/transaction-item';
import { withTimeout } from '../../shared/utils/with-timeout';
import {
  forecastToListEntry,
  transactionToListEntry,
} from '../../shared/ui/transaction-item/transaction-list-entry';
import { TransactionFormService } from '../transactions/transaction-form/transaction-form.service';

const UPCOMING_DAYS = 60;

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink, LocalDatePipe, MoneyPipe, EmptyState, Icon, InfoHint, Skeleton, TransactionItem],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly store = inject(UserDataStore);
  protected readonly viewPeriod = inject(ViewPeriodService);
  private readonly repository = inject(TransactionRepository);
  private readonly transactionActions = inject(TransactionActions);
  private readonly transactionForm = inject(TransactionFormService);

  protected readonly toIconName = toIconName;
  /** Quick period switch; the custom dates stay in "Altro", where both dates can be picked. */
  protected readonly periodPresets: readonly ViewPeriodPreset[] = [
    'salaryCycle',
    'currentMonth',
    'previousMonth',
    'currentYear',
    'all',
  ];
  protected readonly periodLabels = VIEW_PERIOD_LABELS;
  protected readonly today = signal(todayInTimeZone());
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly recent = signal<Transaction[]>([]);
  private readonly planned = signal<Transaction[]>([]);
  private readonly monthTransactions = signal<Transaction[]>([]);

  protected readonly userName = computed(() => this.store.settings()?.displayName ?? '');
  protected readonly netWorthCents = computed(() => calculateNetWorthCents(this.store.activeAccounts()));
  protected readonly recentItems = computed(() =>
    this.recent()
      .slice(0, 5)
      .map((transaction) => ({ transaction, entry: transactionToListEntry(transaction) })),
  );

  private readonly salaryRuleIds = computed(
    () => new Set(this.store.rules().filter((rule) => rule.kind === 'salary').map((rule) => rule.id)),
  );
  private readonly plannedEntries = computed(() =>
    this.planned().map((transaction) => toForecastEntry(transaction, this.salaryRuleIds())),
  );
  private readonly storedKeys = computed(
    () => new Set(this.planned().map((transaction) => transaction.occurrenceKey).filter((key): key is string => !!key)),
  );

  protected readonly hasSalary = computed(() =>
    this.store.rules().some((rule) => rule.kind === 'salary' && rule.status === 'active'),
  );
  protected readonly nextSalary = computed(() =>
    findNextSalary(this.store.rules(), this.today(), this.plannedEntries()),
  );

  protected readonly available = computed(() => {
    const salary = this.nextSalary();
    if (!salary) {
      return null;
    }
    const today = this.today();
    const before = [
      ...this.plannedEntries().filter((entry) => entry.date < salary.date && !entry.isSalary),
      ...buildVirtualOccurrences(
        this.store.rules(),
        today,
        addDaysToLocalDate(salary.date, -1),
        this.storedKeys(),
      ).filter((entry) => !entry.isSalary),
    ];
    return calculateAvailableUntilSalary({
      spendableBalanceCents: calculateAvailableCents(this.store.activeAccounts()),
      entriesBeforeSalary: before,
      safetyBufferCents: this.store.settings()?.safetyBufferCents ?? 0,
      today,
      salaryDate: salary.date,
    });
  });

  protected readonly monthForecast = computed(() => {
    const today = this.today();
    const monthEnd = endOfMonthDate(today);
    const confirmed = this.monthTransactions().filter(
      (transaction) => transaction.status === 'confirmed' && !transaction.deletedAt,
    );
    const plannedInMonth = this.plannedEntries().filter(
      (entry) => entry.date >= startOfMonthDate(today) && entry.date <= monthEnd,
    );
    const virtual = buildVirtualOccurrences(this.store.rules(), addDaysToLocalDate(today, 1), monthEnd, this.storedKeys());
    return calculateNetSavings([
      ...confirmed.map((transaction) => toForecastEntry(transaction, this.salaryRuleIds())),
      ...plannedInMonth,
      ...virtual,
    ]);
  });

  /**
   * How the current balance changes until the end of the month: only what has still to happen is subtracted,
   * because the expenses already registered are part of the balance already.
   */
  protected readonly monthEnd = computed(() => {
    const today = this.today();
    const monthEnd = endOfMonthDate(today);
    const future = [
      ...this.plannedEntries().filter((entry) => entry.date > today && entry.date <= monthEnd),
      ...buildVirtualOccurrences(this.store.rules(), addDaysToLocalDate(today, 1), monthEnd, this.storedKeys()),
    ];
    let incomeCents = 0;
    let recurringExpenseCents = 0;
    let otherExpenseCents = 0;
    for (const entry of future) {
      if (entry.type === 'income') {
        incomeCents += entry.amountCents;
      } else if (entry.type === 'expense') {
        if (entry.recurringRuleId) {
          recurringExpenseCents += entry.amountCents;
        } else {
          otherExpenseCents += entry.amountCents;
        }
      } else {
        otherExpenseCents += entry.feeCents ?? 0;
      }
    }
    const spentSoFarCents = this.monthTransactions()
      .filter(
        (transaction) => transaction.status === 'confirmed' && !transaction.deletedAt && transaction.type === 'expense',
      )
      .reduce((total, transaction) => total + transaction.amountCents, 0);
    return {
      date: monthEnd,
      startingCents: this.netWorthCents(),
      incomeCents,
      recurringExpenseCents,
      otherExpenseCents,
      spentSoFarCents,
      balanceCents: this.netWorthCents() + incomeCents - recurringExpenseCents - otherExpenseCents,
    };
  });

  protected readonly upcoming = computed(() => {
    const today = this.today();
    const stored = this.plannedEntries().filter((entry) => entry.date >= today);
    const virtual = buildVirtualOccurrences(
      this.store.rules(),
      today,
      addDaysToLocalDate(today, UPCOMING_DAYS),
      this.storedKeys(),
    );
    return [...stored, ...virtual]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
      .map(forecastToListEntry);
  });

  protected readonly dueCount = computed(
    () => this.planned().filter((transaction) => transaction.effectiveDate <= this.today()).length,
  );

  constructor() {
    effect(() => {
      this.transactionActions.version();
      const loaded = this.store.loaded();
      if (loaded) {
        untracked(() => void this.load());
      }
    });
  }

  protected changePeriod(preset: ViewPeriodPreset): void {
    void this.viewPeriod.update({ preset });
  }

  protected openTransaction(transaction: Transaction): void {
    void this.transactionForm.openEdit(transaction);
  }

  protected async load(): Promise<void> {
    const uid = this.store.uid;
    const today = todayInTimeZone();
    this.today.set(today);
    if (this.errorMessage()) {
      this.loading.set(true);
    }
    this.errorMessage.set(null);
    try {
      const [recent, planned, month] = await withTimeout(
        Promise.all([
          this.repository.listRecent(uid, 15),
          this.repository.listPlanned(uid),
          this.repository.listRange(uid, { startDate: startOfMonthDate(today), endDate: endOfMonthDate(today) }),
        ]),
      );
      this.recent.set(recent.filter((transaction) => !transaction.deletedAt));
      this.planned.set(planned.filter((transaction) => !transaction.deletedAt));
      this.monthTransactions.set(month);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
