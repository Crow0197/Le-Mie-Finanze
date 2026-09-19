import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { TransactionActions } from '../../core/state/transaction-actions.service';
import { UserDataStore } from '../../core/state/user-data.store';
import { SavingsGoalRepository } from '../../data-access/repositories/savings-goal.repository';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import {
  AdviceInput,
  AdviceLevel,
  AdviceTopic,
  CategorySpending,
  MonthlySaving,
  RecurringChange,
  buildAdvice,
  monthlyAmountCents,
} from '../../domain/advice/advice';
import {
  addDaysToLocalDate,
  addMonthsToLocalDate,
  endOfMonthDate,
  monthOf,
  startOfMonthDate,
  todayInTimeZone,
} from '../../domain/dates/local-date';
import { calculateNetWorthCents } from '../../domain/forecast/balances';
import { buildVirtualOccurrences, toForecastEntry } from '../../domain/forecast/forecast';
import { resolveSalaryCycleRange } from '../../domain/forecast/salary-cycle';
import { SavingsGoal } from '../../domain/models/savings-goal';
import { Transaction } from '../../domain/models/transaction';
import { buildReport } from '../../domain/reports/reports';
import { FEES_CATEGORY_ID } from '../../domain/seed/default-data';
import { simulate, toSimulationEntries } from '../../domain/simulation/simulation';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Icon, IconName } from '../../shared/ui/icon/icon';
import { InfoHint } from '../../shared/ui/info-hint/info-hint';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { withTimeout } from '../../shared/utils/with-timeout';

/** Mesi chiusi usati per capire cosa è normale e cosa no. */
const HISTORY_MONTHS = 3;
/** Mesi di storico letti per accorgersi dei rincari delle ricorrenze. */
const RECURRING_MONTHS = 6;

const LEVEL_ICONS: Record<AdviceLevel, IconName> = {
  danger: 'triangle-alert',
  warning: 'circle-alert',
  info: 'info',
  good: 'circle-check',
};

const TOPIC_LABELS: Record<AdviceTopic, string> = {
  liquidita: 'Soldi disponibili',
  spese: 'Spese',
  impegni: 'Rate e spese fisse',
  risparmio: 'Risparmio',
  dati: 'Da sistemare',
};

@Component({
  selector: 'app-advice-page',
  imports: [RouterLink, LocalDatePipe, MoneyPipe, Icon, InfoHint, Skeleton],
  templateUrl: './advice-page.html',
  styleUrl: './advice-page.scss',
})
export class AdvicePage {
  protected readonly store = inject(UserDataStore);
  private readonly repository = inject(TransactionRepository);
  private readonly goalRepository = inject(SavingsGoalRepository);
  private readonly transactionActions = inject(TransactionActions);

  protected readonly levelIcons = LEVEL_ICONS;
  protected readonly topicLabels = TOPIC_LABELS;
  protected readonly today = signal(todayInTimeZone());
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly history = signal<Transaction[]>([]);
  private readonly planned = signal<Transaction[]>([]);
  private readonly goals = signal<SavingsGoal[]>([]);

  private readonly activeRules = computed(() => this.store.rules().filter((rule) => rule.status === 'active'));

  private readonly cycle = computed(() => {
    const today = this.today();
    const range = resolveSalaryCycleRange(this.store.rules(), today);
    return {
      startDate: range?.startDate ?? startOfMonthDate(today),
      endDate: range?.endDate ?? endOfMonthDate(today),
      hasSalary: !!range,
    };
  });

  /** Saldo giorno per giorno fino alla fine del ciclo, per sapere se e quando si va in rosso. */
  private readonly cycleForecast = computed(() => {
    const today = this.today();
    const { endDate } = this.cycle();
    const salaryRuleIds = new Set(
      this.store.rules().filter((rule) => rule.kind === 'salary').map((rule) => rule.id),
    );
    const storedKeys = new Set(
      this.planned().map((transaction) => transaction.occurrenceKey).filter((key): key is string => !!key),
    );
    const entries = toSimulationEntries([
      ...this.planned()
        .filter((transaction) => transaction.effectiveDate > today && transaction.effectiveDate <= endDate)
        .map((transaction) => toForecastEntry(transaction, salaryRuleIds)),
      ...buildVirtualOccurrences(this.store.rules(), addDaysToLocalDate(today, 1), endDate, storedKeys),
    ]);
    return simulate(calculateNetWorthCents(this.store.activeAccounts()), entries, [], today, endDate);
  });

  /** Un resoconto per ogni mese: quello in corso più i mesi chiusi che servono al confronto. */
  private readonly monthlyReports = computed(() => {
    const today = this.today();
    const categories = this.store.categories();
    const confirmed = this.history();
    return Array.from({ length: HISTORY_MONTHS + 1 }, (_, index) => {
      const reference = addMonthsToLocalDate(today, -index);
      const start = startOfMonthDate(reference);
      const end = endOfMonthDate(reference);
      const slice = confirmed.filter(
        (transaction) => transaction.effectiveDate >= start && transaction.effectiveDate <= end,
      );
      return { month: monthOf(reference), report: buildReport(slice, categories, 'month', 'macro', FEES_CATEGORY_ID) };
    });
  });

  private readonly categorySpending = computed<CategorySpending[]>(() => {
    const [current, ...previous] = this.monthlyReports();
    return current.report.expenseByCategory.map((total) => ({
      categoryId: total.categoryId,
      name: total.name,
      currentCents: total.amountCents,
      previousMonthlyCents: previous.map(
        (month) => month.report.expenseByCategory.find((item) => item.categoryId === total.categoryId)?.amountCents ?? 0,
      ),
    }));
  });

  private readonly monthlySavings = computed<MonthlySaving[]>(() =>
    this.monthlyReports()
      .slice(1)
      .map((month) => ({
        month: month.month,
        incomeCents: month.report.incomeCents,
        expenseCents: month.report.expenseCents,
      }))
      .reverse(),
  );

  /** Ricorrenze il cui importo è cambiato tra la prima e l'ultima occorrenza registrata. */
  private readonly recurringChanges = computed<RecurringChange[]>(() => {
    const byRule = new Map<string, Transaction[]>();
    for (const transaction of this.history()) {
      if (!transaction.recurringRuleId || transaction.type !== 'expense') {
        continue;
      }
      byRule.set(transaction.recurringRuleId, [...(byRule.get(transaction.recurringRuleId) ?? []), transaction]);
    }
    const changes: RecurringChange[] = [];
    for (const [ruleId, transactions] of byRule) {
      const rule = this.store.rules().find((item) => item.id === ruleId);
      if (!rule || transactions.length < 2) {
        continue;
      }
      const sorted = [...transactions].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
      changes.push({
        name: rule.name,
        oldCents: sorted[0].amountCents,
        newCents: sorted[sorted.length - 1].amountCents,
      });
    }
    return changes;
  });

  private readonly goalProgress = computed(() =>
    this.goals()
      .filter((goal) => !goal.archived)
      .map((goal) => {
        const account = goal.accountId
          ? this.store.activeAccounts().find((item) => item.id === goal.accountId)
          : undefined;
        const currentCents = Math.max(
          0,
          account ? account.currentBalanceCents : calculateNetWorthCents(this.store.activeAccounts()),
        );
        return {
          name: goal.name,
          targetCents: goal.targetAmountCents,
          currentCents,
          targetDate: goal.targetDate,
        };
      }),
  );

  protected readonly input = computed<AdviceInput>(() => {
    const forecast = this.cycleForecast();
    const expenses = this.activeRules().filter((rule) => rule.transactionType === 'expense');
    const salaries = this.activeRules().filter((rule) => rule.kind === 'salary');
    return {
      today: this.today(),
      hasSalary: this.cycle().hasSalary,
      safetyBufferCents: this.store.settings()?.safetyBufferCents ?? 0,
      cycleEndCents: forecast.baseEndCents,
      cycleMinCents: forecast.minCents,
      cycleMinDate: forecast.minDate,
      cycleEndDate: this.cycle().endDate,
      salaryMonthlyCents: salaries.reduce((total, rule) => total + monthlyAmountCents(rule), 0),
      commitmentsMonthlyCents: expenses.reduce((total, rule) => total + monthlyAmountCents(rule), 0),
      commitmentsCount: expenses.length,
      duePlannedCount: this.planned().filter((transaction) => transaction.effectiveDate <= this.today()).length,
      pausedRulesCount: this.store.rules().filter((rule) => rule.status === 'paused').length,
      categories: this.categorySpending(),
      recurringChanges: this.recurringChanges(),
      monthlySavings: this.monthlySavings(),
      goals: this.goalProgress(),
    };
  });

  protected readonly advice = computed(() => buildAdvice(this.input()));
  protected readonly attention = computed(() =>
    this.advice().filter((item) => item.level === 'danger' || item.level === 'warning'),
  );
  protected readonly headline = computed(() => {
    const serious = this.attention().length;
    if (this.advice().length === 0) {
      return 'Non ho ancora abbastanza dati per dire qualcosa di utile.';
    }
    if (serious === 0) {
      return 'Tutto sotto controllo: non vedo niente che richieda attenzione.';
    }
    return serious === 1 ? "C'è una cosa che merita attenzione." : `Ci sono ${serious} cose che meritano attenzione.`;
  });

  protected readonly commitmentsDetail = computed(() =>
    this.activeRules()
      .filter((rule) => rule.transactionType === 'expense')
      .map((rule) => ({ name: rule.name, monthlyCents: monthlyAmountCents(rule) }))
      .sort((a, b) => b.monthlyCents - a.monthlyCents),
  );

  constructor() {
    effect(() => {
      this.transactionActions.version();
      if (this.store.loaded()) {
        untracked(() => void this.load());
      }
    });
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
      const [history, planned, goals] = await withTimeout(
        Promise.all([
          this.repository.listRange(uid, {
            startDate: startOfMonthDate(addMonthsToLocalDate(today, -RECURRING_MONTHS)),
            endDate: today,
          }),
          this.repository.listPlanned(uid),
          this.goalRepository.listAll(uid),
        ]),
      );
      this.history.set(history.filter((transaction) => !transaction.deletedAt));
      this.planned.set(planned.filter((transaction) => !transaction.deletedAt));
      this.goals.set(goals);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
