import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { TransactionActions } from '../../core/state/transaction-actions.service';
import { UserDataStore } from '../../core/state/user-data.store';
import { SavingsGoalRepository } from '../../data-access/repositories/savings-goal.repository';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { monthlyAmountCents } from '../../domain/advice/advice';
import { ChallengeInput, buildChallenges } from '../../domain/challenges/challenges';
import { addMonthsToLocalDate, startOfMonthDate, todayInTimeZone } from '../../domain/dates/local-date';
import { calculateNetWorthCents } from '../../domain/forecast/balances';
import { SavingsGoal } from '../../domain/models/savings-goal';
import { Transaction } from '../../domain/models/transaction';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon } from '../../shared/ui/icon/icon';
import { InfoHint } from '../../shared/ui/info-hint/info-hint';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { withTimeout } from '../../shared/utils/with-timeout';

/** Storico letto per le serie, i record e i mesi di autonomia. */
const HISTORY_MONTHS = 12;

@Component({
  selector: 'app-challenges-page',
  imports: [LocalDatePipe, MoneyPipe, EmptyState, Icon, InfoHint, Skeleton],
  templateUrl: './challenges-page.html',
  styleUrl: './challenges-page.scss',
})
export class ChallengesPage {
  protected readonly store = inject(UserDataStore);
  private readonly repository = inject(TransactionRepository);
  private readonly goalRepository = inject(SavingsGoalRepository);
  private readonly transactionActions = inject(TransactionActions);

  protected readonly today = signal(todayInTimeZone());
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly history = signal<Transaction[]>([]);
  private readonly goals = signal<SavingsGoal[]>([]);

  private readonly input = computed<ChallengeInput>(() => {
    const categoryNames: Record<string, string> = {};
    for (const category of this.store.categories()) {
      categoryNames[category.id] = category.name;
    }
    const netWorthCents = calculateNetWorthCents(this.store.activeAccounts());
    const completedGoals = this.goals().filter((goal) => {
      const account = goal.accountId
        ? this.store.activeAccounts().find((item) => item.id === goal.accountId)
        : undefined;
      const currentCents = account ? account.currentBalanceCents : netWorthCents;
      return !goal.archived && currentCents >= goal.targetAmountCents;
    }).length;

    return {
      today: this.today(),
      transactions: this.history().map((transaction) => ({
        effectiveDate: transaction.effectiveDate,
        amountCents: transaction.amountCents,
        type: transaction.type,
        categoryId: transaction.categoryId,
        description: transaction.description,
        recurringRuleId: transaction.recurringRuleId,
      })),
      netWorthCents,
      subscriptions: this.store
        .rules()
        .filter((rule) => rule.status === 'active' && rule.transactionType === 'expense')
        .map((rule) => ({ name: rule.name, yearlyCents: monthlyAmountCents(rule) * 12 })),
      categoryNames,
      completedGoals,
    };
  });

  protected readonly result = computed(() => buildChallenges(this.input()));
  protected readonly hasData = computed(() => this.history().length > 0);

  protected readonly levelProgress = computed(() => {
    const { points, level } = this.result();
    if (level.nextPoints === null) {
      return { percent: 100, missing: 0 };
    }
    return {
      percent: Math.min(100, Math.round((points / level.nextPoints) * 100)),
      missing: level.nextPoints - points,
    };
  });

  protected readonly weeklyPercent = computed(() => {
    const { spentCents, targetCents } = this.result().weekly;
    return targetCents > 0 ? Math.min(100, Math.round((spentCents / targetCents) * 100)) : 0;
  });

  protected readonly unlocked = computed(() => this.result().achievements.filter((item) => item.unlocked));
  protected readonly locked = computed(() => this.result().achievements.filter((item) => !item.unlocked));

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
      const [history, goals] = await withTimeout(
        Promise.all([
          this.repository.listRange(uid, {
            startDate: startOfMonthDate(addMonthsToLocalDate(today, -HISTORY_MONTHS)),
            endDate: today,
          }),
          this.goalRepository.listAll(uid),
        ]),
      );
      this.history.set(
        history.filter((transaction) => transaction.status === 'confirmed' && !transaction.deletedAt),
      );
      this.goals.set(goals);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
