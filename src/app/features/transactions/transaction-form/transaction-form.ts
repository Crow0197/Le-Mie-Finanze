import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../../core/error-handling/firebase-error-message';
import { RecurrenceSyncService } from '../../../core/state/recurrence-sync.service';
import { TransactionActions } from '../../../core/state/transaction-actions.service';
import { UserDataStore } from '../../../core/state/user-data.store';
import { parseLocalDate, todayInTimeZone } from '../../../domain/dates/local-date';
import { formatCentsForInput, parseAmountToCents } from '../../../domain/money/money';
import { QuickTemplate } from '../../../domain/models/quick-template';
import {
  RECURRENCE_FREQUENCY_LABELS,
  RecurrenceFrequency,
} from '../../../domain/models/recurring-rule';
import {
  TRANSACTION_TYPE_LABELS,
  Transaction,
  TransactionDraft,
  TransactionType,
} from '../../../domain/models/transaction';
import { buildCategoryOptionGroups } from '../../../shared/ui/category-select/category-options';
import { Icon } from '../../../shared/ui/icon/icon';
import { localDateValidator, positiveAmountValidator } from '../../../shared/utils/form-validators';

export interface TransactionFormData {
  type: TransactionType;
  transaction?: Transaction;
  duplicateOf?: Transaction;
  template?: QuickTemplate;
}

export type TransactionFormResult = 'saved' | 'deleted' | 'duplicate';

type FieldErrors = Partial<Record<'amount' | 'accountId' | 'destinationAccountId' | 'categoryId' | 'effectiveDate' | 'fee' | 'templateName' | 'endDate', string>>;

@Component({
  selector: 'app-transaction-form',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.scss',
})
export class TransactionForm {
  private readonly data = inject<TransactionFormData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<TransactionFormResult>>(DialogRef);
  private readonly store = inject(UserDataStore);
  private readonly transactionActions = inject(TransactionActions);
  private readonly recurrenceSync = inject(RecurrenceSyncService);

  protected readonly today = todayInTimeZone();
  protected readonly editing = this.data.transaction ?? null;
  private readonly source = this.data.transaction ?? this.data.duplicateOf ?? null;

  protected readonly typeLabels = TRANSACTION_TYPE_LABELS;
  protected readonly frequencyLabels = RECURRENCE_FREQUENCY_LABELS;
  protected readonly types: TransactionType[] = ['expense', 'income', 'transfer'];
  protected readonly frequencies: RecurrenceFrequency[] = ['monthly', 'weekly', 'customMonths', 'yearly'];

  protected readonly type = signal<TransactionType>(this.source?.type ?? this.data.template?.type ?? this.data.type);
  protected readonly showDetails = signal(!!this.source);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly fieldErrors = signal<FieldErrors>({});

  protected readonly form = inject(NonNullableFormBuilder).group({
    amount: ['', [Validators.required, positiveAmountValidator]],
    accountId: [''],
    destinationAccountId: [''],
    categoryId: [''],
    description: ['', Validators.maxLength(200)],
    effectiveDate: [this.today, [Validators.required, localDateValidator]],
    notes: ['', Validators.maxLength(500)],
    fee: ['', positiveAmountValidator],
    repeat: [false],
    frequency: ['monthly' as RecurrenceFrequency],
    interval: [2, [Validators.min(2), Validators.max(24)]],
    endDate: ['', localDateValidator],
    autoPost: [true],
    saveAsTemplate: [false],
    templateName: ['', Validators.maxLength(40)],
  });

  protected readonly accountOptions = computed(() => {
    const currentIds = [this.source?.accountId, this.source?.sourceAccountId, this.source?.destinationAccountId];
    return this.store.accounts().filter((account) => !account.archived || currentIds.includes(account.id));
  });

  protected readonly categoryGroups = computed(() => {
    const type = this.type();
    return type === 'transfer'
      ? []
      : buildCategoryOptionGroups(this.store.categories(), type, this.source?.categoryId);
  });

  protected readonly title = computed(() =>
    this.editing ? `Modifica ${this.typeLabels[this.type()].toLowerCase()}` : `Nuova ${this.typeLabels[this.type()].toLowerCase()}`,
  );

  constructor() {
    const defaultAccountId = this.store.defaultAccount()?.id ?? '';
    const template = this.data.template;
    if (this.source) {
      this.form.patchValue({
        amount: formatCentsForInput(this.source.amountCents),
        accountId: this.source.accountId ?? this.source.sourceAccountId ?? '',
        destinationAccountId: this.source.destinationAccountId ?? '',
        categoryId: this.source.categoryId ?? '',
        description: this.source.description,
        effectiveDate: this.editing ? this.source.effectiveDate : this.today,
        notes: this.source.notes ?? '',
        fee: this.source.feeCents ? formatCentsForInput(this.source.feeCents) : '',
      });
    } else if (template) {
      this.form.patchValue({
        amount: template.amountCents ? formatCentsForInput(template.amountCents) : '',
        accountId: template.accountId ?? template.sourceAccountId ?? defaultAccountId,
        destinationAccountId: template.destinationAccountId ?? '',
        categoryId: template.categoryId ?? '',
        description: template.description ?? template.name,
        notes: template.notes ?? '',
      });
    } else {
      this.form.patchValue({ accountId: defaultAccountId });
    }
  }

  protected setType(type: TransactionType): void {
    this.type.set(type);
    this.fieldErrors.set({});
    const categoryId = this.form.controls.categoryId.value;
    const stillValid = this.categoryGroups().some(
      (group) => group.macro.id === categoryId || group.children.some((child) => child.id === categoryId),
    );
    if (!stillValid) {
      this.form.controls.categoryId.setValue('');
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected duplicate(): void {
    this.dialogRef.close('duplicate');
  }

  protected remove(): void {
    this.dialogRef.close('deleted');
  }

  protected async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    const errors = this.validate();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length > 0 || this.form.invalid) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const draft = this.buildDraft();
      const value = this.form.getRawValue();
      if (value.repeat && !this.editing && draft.type !== 'transfer') {
        await this.createRecurringRule(draft);
      } else if (this.editing) {
        await this.transactionActions.update(this.editing, draft);
      } else {
        await this.transactionActions.create(draft);
      }
      if (value.saveAsTemplate) {
        await this.createTemplate(draft);
      }
      this.dialogRef.close('saved');
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private validate(): FieldErrors {
    const value = this.form.getRawValue();
    const errors: FieldErrors = {};
    const amount = parseAmountToCents(value.amount);
    if (!amount || amount <= 0) {
      errors.amount = "Inserisci un importo maggiore di zero, per esempio 12,50.";
    }
    if (!value.accountId) {
      errors.accountId =
        this.type() === 'transfer' ? 'Scegli il conto da cui prelevare.' : 'Scegli il conto di addebito o accredito.';
    }
    if (this.type() === 'transfer') {
      if (!value.destinationAccountId) {
        errors.destinationAccountId = 'Scegli il conto di destinazione.';
      } else if (value.destinationAccountId === value.accountId) {
        errors.destinationAccountId = 'Il conto di destinazione deve essere diverso da quello di origine.';
      }
      if (value.fee && !parseAmountToCents(value.fee)) {
        errors.fee = 'Inserisci una commissione valida.';
      }
    } else if (!value.categoryId) {
      errors.categoryId = 'Scegli una categoria.';
    }
    if (this.form.controls.effectiveDate.invalid) {
      errors.effectiveDate = 'Inserisci una data valida.';
    }
    if (value.repeat && value.endDate && value.endDate < value.effectiveDate) {
      errors.endDate = 'La data finale deve essere successiva alla data iniziale.';
    }
    if (value.saveAsTemplate && !value.templateName.trim()) {
      errors.templateName = 'Dai un nome al modello.';
    }
    if (Object.keys(errors).some((key) => key !== 'amount' && key !== 'accountId' && key !== 'categoryId' && key !== 'destinationAccountId')) {
      this.showDetails.set(true);
    }
    return errors;
  }

  private buildDraft(): TransactionDraft {
    const value = this.form.getRawValue();
    const type = this.type();
    const amountCents = parseAmountToCents(value.amount) ?? 0;
    const isTransfer = type === 'transfer';
    return {
      type,
      status: this.editing?.status ?? 'confirmed',
      amountCents,
      effectiveDate: value.effectiveDate,
      description: value.description.trim(),
      notes: value.notes.trim() || undefined,
      categoryId: isTransfer ? undefined : value.categoryId,
      accountId: isTransfer ? undefined : value.accountId,
      sourceAccountId: isTransfer ? value.accountId : undefined,
      destinationAccountId: isTransfer ? value.destinationAccountId : undefined,
      feeCents: isTransfer && value.fee ? (parseAmountToCents(value.fee) ?? undefined) : undefined,
      recurringRuleId: this.editing?.recurringRuleId,
      occurrenceKey: this.editing?.occurrenceKey,
    };
  }

  private async createRecurringRule(draft: TransactionDraft): Promise<void> {
    const value = this.form.getRawValue();
    const startDate = parseLocalDate(draft.effectiveDate);
    const categoryName = this.store.categoriesById().get(draft.categoryId ?? '')?.name ?? '';
    await this.store.createRule({
      name: draft.description || categoryName,
      kind: 'standard',
      transactionType: draft.type === 'income' ? 'income' : 'expense',
      amountCents: draft.amountCents,
      accountId: draft.accountId ?? '',
      categoryId: draft.categoryId ?? '',
      description: draft.description,
      notes: draft.notes,
      frequency: value.frequency,
      interval: value.frequency === 'customMonths' ? value.interval : 1,
      dayOfMonth: value.frequency === 'weekly' ? undefined : startDate.getDate(),
      dayOfWeek: value.frequency === 'weekly' ? startDate.getDay() : undefined,
      startDate: draft.effectiveDate,
      endDate: value.endDate || undefined,
      nextOccurrenceDate: draft.effectiveDate,
      autoPost: value.autoPost,
      status: 'active',
      pausedReason: null,
    });
    await this.recurrenceSync.sync();
  }

  private async createTemplate(draft: TransactionDraft): Promise<void> {
    const value = this.form.getRawValue();
    await this.store.createTemplate({
      name: value.templateName.trim(),
      type: draft.type,
      amountCents: draft.amountCents,
      description: draft.description,
      categoryId: draft.categoryId,
      accountId: draft.accountId,
      sourceAccountId: draft.sourceAccountId,
      destinationAccountId: draft.destinationAccountId,
      notes: draft.notes,
      favorite: false,
      sortOrder: this.store.templates().length,
      archived: false,
    });
  }
}
