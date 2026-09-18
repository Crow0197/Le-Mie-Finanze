import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_INFO } from '../../core/app-info';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { RecurrenceSyncService } from '../../core/state/recurrence-sync.service';
import { UserDataStore } from '../../core/state/user-data.store';
import { addDaysToLocalDate, todayInTimeZone } from '../../domain/dates/local-date';
import { calculateNetWorthCents } from '../../domain/forecast/balances';
import { ACCOUNT_TYPE_LABELS, AccountType } from '../../domain/models/account';
import { parseAmountToCents, parseSignedAmountToCents } from '../../domain/money/money';
import { nextOccurrenceOnOrAfter } from '../../domain/recurrence/recurrence';
import { SALARY_CATEGORY_ID } from '../../domain/seed/default-data';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { buildCategoryOptionGroups } from '../../shared/ui/category-select/category-options';
import { Icon } from '../../shared/ui/icon/icon';
import { positiveAmountValidator, showControlError, signedAmountValidator } from '../../shared/utils/form-validators';
import { ACCOUNT_COLORS, ACCOUNT_TYPE_ICONS } from '../accounts/account-form-dialog';

const TOTAL_STEPS = 6;

interface FirstOccurrence {
  /** True when the chosen day is today: the user must say whether today's one is already in the balance. */
  occursToday: boolean;
  startDate: string;
  nextDate: string | null;
}

@Component({
  selector: 'app-onboarding',
  imports: [ReactiveFormsModule, Icon, LocalDatePipe, MoneyPipe],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  protected readonly store = inject(UserDataStore);
  private readonly router = inject(Router);
  private readonly recurrenceSync = inject(RecurrenceSyncService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly appName = APP_INFO.name;
  protected readonly totalSteps = TOTAL_STEPS;
  protected readonly stepNumbers = Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1);
  protected readonly today = todayInTimeZone();
  protected readonly step = signal(1);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showError = showControlError;
  protected readonly accountTypes = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];
  protected readonly accountTypeLabels = ACCOUNT_TYPE_LABELS;

  protected readonly profileForm = this.formBuilder.group({
    displayName: ['', [Validators.required, Validators.maxLength(60)]],
  });

  protected readonly accountForm = this.formBuilder.group({
    name: ['Conto corrente', [Validators.required, Validators.maxLength(60)]],
    type: ['bank' as AccountType],
    openingBalance: ['', [Validators.required, signedAmountValidator]],
    includeInNetWorth: [true],
    includeInAvailable: [true],
  });

  protected readonly salaryForm = this.formBuilder.group({
    amount: ['', [Validators.required, positiveAmountValidator]],
    dayOfMonth: [27, [Validators.required, Validators.min(1), Validators.max(31)]],
    accountId: ['', Validators.required],
    variableAmount: [false],
    alreadyInBalance: [true],
  });

  protected readonly ruleForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    transactionType: ['expense' as 'expense' | 'income'],
    amount: ['', [Validators.required, positiveAmountValidator]],
    dayOfMonth: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
    accountId: ['', Validators.required],
    categoryId: ['', Validators.required],
    alreadyInBalance: [true],
  });

  private readonly salaryChanges = toSignal(this.salaryForm.valueChanges, { initialValue: null });
  private readonly ruleChanges = toSignal(this.ruleForm.valueChanges, { initialValue: null });
  private readonly salaryValue = computed(() => {
    this.salaryChanges();
    return this.salaryForm.getRawValue();
  });
  private readonly ruleValue = computed(() => {
    this.ruleChanges();
    return this.ruleForm.getRawValue();
  });

  protected readonly existingSalary = computed(
    () => this.store.rules().find((rule) => rule.kind === 'salary' && rule.status !== 'completed') ?? null,
  );
  protected readonly standardRules = computed(() =>
    this.store.rules().filter((rule) => rule.kind !== 'salary' && rule.status !== 'completed'),
  );
  protected readonly netWorthCents = computed(() => calculateNetWorthCents(this.store.activeAccounts()));
  protected readonly monthlyRulesCents = computed(() =>
    this.standardRules()
      .filter((rule) => rule.status === 'active' && rule.frequency === 'monthly' && rule.transactionType === 'expense')
      .reduce((total, rule) => total + rule.amountCents, 0),
  );

  protected readonly expenseCategoryGroups = computed(() => buildCategoryOptionGroups(this.store.categories(), 'expense'));
  protected readonly incomeCategoryGroups = computed(() => buildCategoryOptionGroups(this.store.categories(), 'income'));
  protected readonly ruleCategoryGroups = computed(() =>
    this.ruleValue().transactionType === 'income' ? this.incomeCategoryGroups() : this.expenseCategoryGroups(),
  );

  protected readonly salaryFirst = computed(() => {
    const value = this.salaryValue();
    return this.firstOccurrence(Number(value.dayOfMonth), value.alreadyInBalance);
  });
  protected readonly ruleFirst = computed(() => {
    const value = this.ruleValue();
    return this.firstOccurrence(Number(value.dayOfMonth), value.alreadyInBalance);
  });

  constructor() {
    void this.initialize();
  }

  protected goTo(step: number): void {
    this.errorMessage.set(null);
    if (step === 4) {
      this.salaryForm.controls.accountId.setValue(this.defaultAccountId());
    }
    if (step === 5 && !this.ruleForm.controls.accountId.value) {
      this.ruleForm.controls.accountId.setValue(this.defaultAccountId());
    }
    this.step.set(Math.min(TOTAL_STEPS, Math.max(1, step)));
  }

  protected async saveProfile(): Promise<void> {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid) {
      return;
    }
    await this.run(async () => {
      await this.store.updateSettings({ displayName: this.profileForm.getRawValue().displayName.trim() });
      this.goTo(2);
    });
  }

  protected onAccountTypeChange(): void {
    const type = this.accountForm.controls.type.value;
    this.accountForm.controls.includeInAvailable.setValue(type !== 'savings');
  }

  protected async addAccount(): Promise<boolean> {
    this.accountForm.markAllAsTouched();
    if (this.accountForm.invalid) {
      return false;
    }
    const value = this.accountForm.getRawValue();
    const index = this.store.accounts().length;
    let created = false;
    await this.run(async () => {
      await this.store.createAccount({
        name: value.name.trim(),
        type: value.type,
        openingBalanceCents: parseSignedAmountToCents(value.openingBalance) ?? 0,
        includeInNetWorth: value.includeInNetWorth,
        includeInAvailable: value.includeInAvailable,
        icon: ACCOUNT_TYPE_ICONS[value.type],
        color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
        sortOrder: index,
        archived: false,
      });
      this.accountForm.reset({ name: '', type: 'bank', openingBalance: '', includeInNetWorth: true, includeInAvailable: true });
      created = true;
    });
    return created;
  }

  protected async setDefaultAccount(accountId: string): Promise<void> {
    await this.run(() => this.store.updateSettings({ defaultAccountId: accountId }));
  }

  /** With no account yet, the filled form is saved before moving on. */
  protected async continueFromAccounts(): Promise<void> {
    if (this.store.activeAccounts().length === 0 && !(await this.addAccount())) {
      return;
    }
    this.goTo(3);
  }

  protected async saveSalary(): Promise<void> {
    this.salaryForm.markAllAsTouched();
    const first = this.salaryFirst();
    if (this.salaryForm.invalid || !first.nextDate) {
      return;
    }
    const value = this.salaryForm.getRawValue();
    await this.run(async () => {
      await this.store.createRule({
        name: 'Stipendio',
        kind: 'salary',
        transactionType: 'income',
        amountCents: parseAmountToCents(value.amount) ?? 0,
        accountId: value.accountId,
        categoryId: SALARY_CATEGORY_ID,
        description: 'Stipendio',
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: Number(value.dayOfMonth),
        startDate: first.startDate,
        nextOccurrenceDate: first.nextDate ?? first.startDate,
        autoPost: !value.variableAmount,
        status: 'active',
        pausedReason: null,
      });
      this.goTo(5);
    });
  }

  protected setRuleType(type: 'expense' | 'income'): void {
    this.ruleForm.controls.transactionType.setValue(type);
    this.ruleForm.controls.categoryId.setValue('');
  }

  protected async addRule(): Promise<void> {
    this.ruleForm.markAllAsTouched();
    const first = this.ruleFirst();
    if (this.ruleForm.invalid || !first.nextDate) {
      return;
    }
    const value = this.ruleForm.getRawValue();
    await this.run(async () => {
      await this.store.createRule({
        name: value.name.trim(),
        kind: 'standard',
        transactionType: value.transactionType,
        amountCents: parseAmountToCents(value.amount) ?? 0,
        accountId: value.accountId,
        categoryId: value.categoryId,
        description: value.name.trim(),
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: Number(value.dayOfMonth),
        startDate: first.startDate,
        nextOccurrenceDate: first.nextDate ?? first.startDate,
        autoPost: true,
        status: 'active',
        pausedReason: null,
      });
      this.ruleForm.reset({
        name: '',
        transactionType: value.transactionType,
        amount: '',
        dayOfMonth: 1,
        accountId: value.accountId,
        categoryId: '',
        alreadyInBalance: true,
      });
    });
  }

  protected accountName(accountId: string): string {
    return this.store.accountsById().get(accountId)?.name ?? 'Conto non trovato';
  }

  protected async finish(): Promise<void> {
    await this.run(async () => {
      await this.store.updateSettings({ onboardingCompleted: true });
      await this.recurrenceSync.sync();
      await this.router.navigateByUrl('/');
    });
  }

  /**
   * The setup starts today: past occurrences are already in the bank balance and must not be posted again.
   * When the day is today, the user decides whether today's occurrence is already included.
   */
  private firstOccurrence(dayOfMonth: number, alreadyInBalance: boolean): FirstOccurrence {
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      return { occursToday: false, startDate: this.today, nextDate: null };
    }
    const schedule = { frequency: 'monthly' as const, interval: 1, dayOfMonth, startDate: this.today };
    const occursToday = nextOccurrenceOnOrAfter(schedule, this.today) === this.today;
    const startDate = occursToday && alreadyInBalance ? addDaysToLocalDate(this.today, 1) : this.today;
    return { occursToday, startDate, nextDate: nextOccurrenceOnOrAfter({ ...schedule, startDate }, startDate) };
  }

  private defaultAccountId(): string {
    return this.store.defaultAccount()?.id ?? this.store.activeAccounts()[0]?.id ?? '';
  }

  private async initialize(): Promise<void> {
    try {
      await this.store.load();
      this.profileForm.patchValue({ displayName: this.store.settings()?.displayName ?? '' });
      if (this.store.accounts().length > 0) {
        this.accountForm.patchValue({ name: '' });
      }
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await action();
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
