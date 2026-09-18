import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { RecurrenceSyncService } from '../../core/state/recurrence-sync.service';
import { UserDataStore } from '../../core/state/user-data.store';
import { addDaysToLocalDate, isLocalDate, parseLocalDate, todayInTimeZone } from '../../domain/dates/local-date';
import { formatCentsForInput, parseAmountToCents } from '../../domain/money/money';
import {
  RECURRENCE_FREQUENCY_LABELS,
  RecurrenceFrequency,
  RecurringRule,
  RecurringRuleDraft,
} from '../../domain/models/recurring-rule';
import { listOccurrences, nextOccurrenceOnOrAfter } from '../../domain/recurrence/recurrence';
import { SALARY_CATEGORY_ID } from '../../domain/seed/default-data';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { buildCategoryOptionGroups } from '../../shared/ui/category-select/category-options';
import { Icon } from '../../shared/ui/icon/icon';
import { localDateValidator, positiveAmountValidator, showControlError } from '../../shared/utils/form-validators';

export interface RecurringRuleFormData {
  kind: 'salary' | 'standard';
  rule?: RecurringRule;
}

export const WEEKDAY_LABELS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

@Component({
  selector: 'app-recurring-rule-form',
  imports: [ReactiveFormsModule, Icon, MoneyPipe],
  templateUrl: './recurring-rule-form.html',
})
export class RecurringRuleForm {
  private readonly data = inject<RecurringRuleFormData>(DIALOG_DATA);
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly store = inject(UserDataStore);
  private readonly recurrenceSync = inject(RecurrenceSyncService);

  protected readonly rule = this.data.rule ?? null;
  protected readonly isSalary = this.data.kind === 'salary';
  protected readonly frequencyLabels = RECURRENCE_FREQUENCY_LABELS;
  protected readonly frequencies: RecurrenceFrequency[] = ['monthly', 'weekly', 'customMonths', 'yearly'];
  protected readonly weekdays = WEEKDAY_LABELS;
  protected readonly showError = showControlError;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly today = todayInTimeZone();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.rule?.name ?? (this.isSalary ? 'Stipendio' : ''), [Validators.required, Validators.maxLength(80)]],
    transactionType: [this.rule?.transactionType ?? (this.isSalary ? 'income' : 'expense') as 'expense' | 'income'],
    amount: [this.rule ? formatCentsForInput(this.rule.amountCents) : '', [Validators.required, positiveAmountValidator]],
    accountId: [this.rule?.accountId ?? this.store.defaultAccount()?.id ?? '', Validators.required],
    categoryId: [this.rule?.categoryId ?? (this.isSalary ? SALARY_CATEGORY_ID : ''), Validators.required],
    frequency: [this.rule?.frequency ?? ('monthly' as RecurrenceFrequency)],
    interval: [this.rule?.frequency === 'customMonths' ? this.rule.interval : 2, [Validators.min(2), Validators.max(24)]],
    dayOfMonth: [this.rule?.dayOfMonth ?? (this.isSalary ? 27 : parseLocalDate(this.today).getDate()), [Validators.min(1), Validators.max(31)]],
    dayOfWeek: [this.rule?.dayOfWeek ?? 1],
    startDate: [this.rule?.startDate ?? this.today, [Validators.required, localDateValidator]],
    endDate: [this.rule?.endDate ?? '', localDateValidator],
    autoPost: [this.rule?.autoPost ?? true],
  });

  protected readonly categoryGroups = computed(() =>
    buildCategoryOptionGroups(this.store.categories(), this.transactionType(), this.rule?.categoryId),
  );
  private readonly transactionType = signal<'expense' | 'income'>(this.form.controls.transactionType.value);

  protected readonly accountOptions = computed(() =>
    this.store.accounts().filter((account) => !account.archived || account.id === this.rule?.accountId),
  );

  private readonly formChanges = toSignal(this.form.valueChanges, { initialValue: null });
  private readonly formValue = computed(() => {
    this.formChanges();
    return this.form.getRawValue();
  });

  /**
   * Occurrences before today that saving would post (and subtract from the balance). They are usually already
   * included in the bank balance, so the form warns and offers to start from today.
   */
  protected readonly pastOccurrences = computed(() => {
    const value = this.formValue();
    if (!isLocalDate(value.startDate) || value.startDate >= this.today) {
      return null;
    }
    const schedule = {
      frequency: value.frequency,
      interval: value.frequency === 'customMonths' ? value.interval : 1,
      dayOfMonth: value.frequency === 'weekly' ? undefined : Number(value.dayOfMonth),
      dayOfWeek: value.frequency === 'weekly' ? Number(value.dayOfWeek) : undefined,
      startDate: value.startDate,
      endDate: value.endDate || undefined,
    };
    const from = this.rule && this.rule.nextOccurrenceDate > value.startDate ? this.rule.nextOccurrenceDate : value.startDate;
    const count = listOccurrences(schedule, from, addDaysToLocalDate(this.today, -1)).length;
    return count > 0 ? { count, totalCents: count * (parseAmountToCents(value.amount) ?? 0) } : null;
  });

  protected startFromToday(): void {
    this.form.controls.startDate.setValue(this.today);
  }

  protected setType(type: 'expense' | 'income'): void {
    this.form.controls.transactionType.setValue(type);
    this.transactionType.set(type);
    this.form.controls.categoryId.setValue('');
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid || this.saving()) {
      return;
    }
    if (value.endDate && value.endDate < value.startDate) {
      this.errorMessage.set('La data finale deve essere successiva alla data iniziale.');
      return;
    }
    const archivedAccount = this.store.accountsById().get(value.accountId)?.archived;
    if (archivedAccount) {
      this.errorMessage.set('Il conto selezionato è archiviato: scegli un conto attivo.');
      return;
    }

    const schedule = {
      frequency: value.frequency,
      interval: value.frequency === 'customMonths' ? value.interval : 1,
      dayOfMonth: value.frequency === 'weekly' ? undefined : value.dayOfMonth,
      dayOfWeek: value.frequency === 'weekly' ? Number(value.dayOfWeek) : undefined,
      startDate: value.startDate,
      endDate: value.endDate || undefined,
    };
    const from = this.rule && this.rule.nextOccurrenceDate > value.startDate ? this.rule.nextOccurrenceDate : value.startDate;
    const nextOccurrenceDate = nextOccurrenceOnOrAfter(schedule, from);
    const wasPausedForAccount = this.rule?.pausedReason === 'accountArchived';

    const draft: RecurringRuleDraft = {
      name: value.name.trim(),
      kind: this.isSalary ? 'salary' : 'standard',
      transactionType: this.isSalary ? 'income' : value.transactionType,
      amountCents: parseAmountToCents(value.amount) ?? 0,
      accountId: value.accountId,
      categoryId: value.categoryId,
      description: value.name.trim(),
      ...schedule,
      nextOccurrenceDate: nextOccurrenceDate ?? value.startDate,
      autoPost: value.autoPost,
      status: nextOccurrenceDate === null ? 'completed' : wasPausedForAccount ? 'paused' : (this.rule?.status ?? 'active'),
      pausedReason: this.rule?.pausedReason ?? null,
    };

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      if (this.rule) {
        await this.store.updateRule(this.rule.id, draft);
      } else {
        await this.store.createRule(draft);
      }
      await this.recurrenceSync.sync();
      this.dialogRef.close(true);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
