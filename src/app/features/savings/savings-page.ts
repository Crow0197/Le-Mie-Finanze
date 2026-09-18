import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { TransactionActions } from '../../core/state/transaction-actions.service';
import { UserDataStore } from '../../core/state/user-data.store';
import { BudgetRepository } from '../../data-access/repositories/budget.repository';
import { SavingsGoalRepository } from '../../data-access/repositories/savings-goal.repository';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { BudgetUsage, calculateBudgetUsage } from '../../domain/budgets/budgets';
import {
  addDaysToLocalDate,
  addMonthsToLocalDate,
  endOfMonthDate,
  formatLocalDate,
  isLocalDate,
  monthOf,
  previousMonth,
  todayInTimeZone,
} from '../../domain/dates/local-date';
import { calculateNetWorthCents } from '../../domain/forecast/balances';
import {
  buildVirtualOccurrences,
  calculateNetSavings,
  forecastBalanceAt,
  toForecastEntry,
} from '../../domain/forecast/forecast';
import { Budget } from '../../domain/models/budget';
import { SavingsGoal } from '../../domain/models/savings-goal';
import { Transaction } from '../../domain/models/transaction';
import { FEES_CATEGORY_ID } from '../../domain/seed/default-data';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { AppDialogService } from '../../shared/ui/dialog/app-dialog.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon } from '../../shared/ui/icon/icon';
import { InfoHint } from '../../shared/ui/info-hint/info-hint';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';
import { BudgetForm, BudgetFormData } from './budget-form';
import { SavingsGoalForm } from './savings-goal-form';

interface GoalView {
  goal: SavingsGoal;
  currentCents: number;
  percent: number;
  completed: boolean;
  estimate: string;
}

interface BudgetView {
  budget: Budget;
  name: string;
  usage: BudgetUsage;
}

@Component({
  selector: 'app-savings-page',
  imports: [FormsModule, LocalDatePipe, MoneyPipe, EmptyState, Icon, InfoHint, Skeleton],
  templateUrl: './savings-page.html',
  styleUrl: './savings-page.scss',
})
export class SavingsPage {
  protected readonly store = inject(UserDataStore);
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly goalRepository = inject(SavingsGoalRepository);
  private readonly budgetRepository = inject(BudgetRepository);
  private readonly transactionActions = inject(TransactionActions);
  private readonly appDialog = inject(AppDialogService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly today = todayInTimeZone();
  protected readonly targetDate = signal(endOfMonthDate(this.today));
  protected readonly month = signal(monthOf(this.today));
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly planned = signal<Transaction[]>([]);
  private readonly currentMonthTransactions = signal<Transaction[]>([]);
  private readonly budgetMonthTransactions = signal<Transaction[]>([]);
  private readonly goals = signal<SavingsGoal[]>([]);
  private readonly budgets = signal<Budget[]>([]);

  private readonly salaryRuleIds = computed(
    () => new Set(this.store.rules().filter((rule) => rule.kind === 'salary').map((rule) => rule.id)),
  );

  protected readonly forecast = computed(() => {
    const target = this.targetDate();
    if (!isLocalDate(target) || target < this.today) {
      return null;
    }
    const plannedEntries = this.planned()
      .filter((transaction) => transaction.effectiveDate <= target)
      .map((transaction) => toForecastEntry(transaction, this.salaryRuleIds()));
    const keys = new Set(plannedEntries.map((entry) => entry.occurrenceKey).filter((key): key is string => !!key));
    const virtual = buildVirtualOccurrences(this.store.rules(), addDaysToLocalDate(this.today, 1), target, keys);
    const entries = [...plannedEntries, ...virtual];
    return {
      balanceCents: forecastBalanceAt(calculateNetWorthCents(this.store.activeAccounts()), entries),
      savings: calculateNetSavings(entries),
    };
  });

  /** Projected net savings of the current month, used to estimate goal completion. */
  private readonly monthlySavingsCents = computed(() => {
    const monthEnd = endOfMonthDate(this.today);
    const confirmed = this.currentMonthTransactions().filter(
      (transaction) => transaction.status === 'confirmed' && !transaction.deletedAt,
    );
    const plannedInMonth = this.planned().filter(
      (transaction) => transaction.effectiveDate.startsWith(monthOf(this.today)),
    );
    const keys = new Set(plannedInMonth.map((transaction) => transaction.occurrenceKey).filter((key): key is string => !!key));
    const virtual = buildVirtualOccurrences(this.store.rules(), addDaysToLocalDate(this.today, 1), monthEnd, keys);
    return calculateNetSavings([
      ...[...confirmed, ...plannedInMonth].map((transaction) => toForecastEntry(transaction, this.salaryRuleIds())),
      ...virtual,
    ]).netCents;
  });

  protected readonly goalViews = computed<GoalView[]>(() => {
    const netWorth = calculateNetWorthCents(this.store.activeAccounts());
    const monthly = this.monthlySavingsCents();
    return this.goals()
      .filter((goal) => !goal.archived)
      .map((goal) => {
        const account = goal.accountId ? this.store.accountsById().get(goal.accountId) : undefined;
        const currentCents = Math.max(0, account ? account.currentBalanceCents : netWorth);
        const percent = Math.min(100, Math.round((currentCents / goal.targetAmountCents) * 100));
        const completed = currentCents >= goal.targetAmountCents;
        let estimate = 'Stima non disponibile: il risparmio previsto del mese non è positivo.';
        if (completed) {
          estimate = 'Obiettivo raggiunto!';
        } else if (monthly > 0) {
          const months = Math.ceil((goal.targetAmountCents - currentCents) / monthly);
          const date = addMonthsToLocalDate(this.today, months);
          estimate = `Al ritmo di questo mese: circa ${months} ${months === 1 ? 'mese' : 'mesi'} (${formatLocalDate(date, 'month')}).`;
        }
        return { goal, currentCents, percent, completed, estimate };
      });
  });

  protected readonly budgetViews = computed<BudgetView[]>(() =>
    this.budgets()
      .map((budget) => ({
        budget,
        name: budget.categoryId
          ? (this.store.categoriesById().get(budget.categoryId)?.name ?? 'Categoria')
          : 'Budget mensile generale',
        usage: calculateBudgetUsage(budget, this.budgetMonthTransactions(), this.store.categories(), FEES_CATEGORY_ID),
      }))
      .sort((a, b) => Number(!!a.budget.categoryId) - Number(!!b.budget.categoryId)),
  );

  constructor() {
    effect(() => {
      this.transactionActions.version();
      this.month();
      if (this.store.loaded()) {
        untracked(() => void this.load());
      }
    });
  }

  protected changeMonth(offset: number): void {
    this.month.update((month) => monthOf(addMonthsToLocalDate(`${month}-01`, offset)));
  }

  protected openGoalForm(goal: SavingsGoal | null = null): void {
    this.appDialog.open<SavingsGoal>(SavingsGoalForm, goal, 'goal-form-title').closed.subscribe((saved) => {
      if (saved) {
        this.goals.update((goals) => [...goals.filter((item) => item.id !== saved.id), saved]);
      }
    });
  }

  protected async archiveGoal(goal: SavingsGoal): Promise<void> {
    await this.run(async () => {
      await this.goalRepository.update(this.store.uid, goal.id, { archived: true });
      this.goals.update((goals) => goals.filter((item) => item.id !== goal.id));
      this.snackbar.show('Obiettivo archiviato.');
    });
  }

  protected openBudgetForm(budget?: Budget): void {
    const data: BudgetFormData = {
      month: this.month(),
      budget,
      usedCategoryIds: this.budgets().map((item) => item.categoryId).filter((id): id is string => !!id),
      hasGeneral: this.budgets().some((item) => !item.categoryId),
    };
    this.appDialog.open<boolean, BudgetFormData>(BudgetForm, data, 'budget-form-title').closed.subscribe((saved) => {
      if (saved) {
        void this.load();
      }
    });
  }

  protected async copyPreviousBudgets(): Promise<void> {
    await this.run(async () => {
      const previous = await this.budgetRepository.listByMonth(this.store.uid, previousMonth(this.month()));
      if (previous.length === 0) {
        this.snackbar.show('Il mese precedente non ha budget da copiare.');
        return;
      }
      const existing = new Set(this.budgets().map((budget) => budget.categoryId ?? ''));
      const drafts = previous
        .filter((budget) => !existing.has(budget.categoryId ?? ''))
        .map((budget) => ({ month: this.month(), categoryId: budget.categoryId, limitCents: budget.limitCents, archived: false }));
      const created = await this.budgetRepository.createMany(this.store.uid, drafts);
      this.budgets.update((budgets) => [...budgets, ...created]);
      this.snackbar.show(`Budget copiati: ${created.length}.`);
    });
  }

  private async load(): Promise<void> {
    const uid = this.store.uid;
    const month = this.month();
    const currentMonth = monthOf(this.today);
    this.errorMessage.set(null);
    try {
      const [planned, currentMonthTransactions, goals, budgets, budgetMonthTransactions] = await Promise.all([
        this.transactionRepository.listPlanned(uid),
        this.transactionRepository.listRange(uid, { startDate: `${currentMonth}-01`, endDate: endOfMonthDate(this.today) }),
        this.goalRepository.listAll(uid),
        this.budgetRepository.listByMonth(uid, month),
        month === currentMonth
          ? Promise.resolve(null)
          : this.transactionRepository.listRange(uid, { startDate: `${month}-01`, endDate: endOfMonthDate(`${month}-01`) }),
      ]);
      this.planned.set(planned.filter((transaction) => !transaction.deletedAt));
      this.currentMonthTransactions.set(currentMonthTransactions);
      this.goals.set(goals);
      this.budgets.set(budgets);
      this.budgetMonthTransactions.set(budgetMonthTransactions ?? currentMonthTransactions);
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
