import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { BudgetRepository } from '../../data-access/repositories/budget.repository';
import { formatLocalDate } from '../../domain/dates/local-date';
import { formatCentsForInput, parseAmountToCents } from '../../domain/money/money';
import { Budget } from '../../domain/models/budget';
import { Icon } from '../../shared/ui/icon/icon';
import { positiveAmountValidator, showControlError } from '../../shared/utils/form-validators';

export interface BudgetFormData {
  month: string;
  budget?: Budget;
  usedCategoryIds: string[];
  hasGeneral: boolean;
}

@Component({
  selector: 'app-budget-form',
  imports: [ReactiveFormsModule, Icon],
  template: `
    <form class="dialog" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <header class="dialog__header">
        <h2 id="budget-form-title">{{ data.budget ? 'Modifica budget' : 'Nuovo budget' }} · {{ monthLabel }}</h2>
        <button type="button" class="icon-button" aria-label="Chiudi" (click)="dialogRef.close()">
          <app-icon name="x" />
        </button>
      </header>
      @if (errorMessage(); as message) {
        <p class="alert alert--danger" role="alert">{{ message }}</p>
      }
      <div class="field">
        <label class="field__label" for="budget-category">Ambito</label>
        <select id="budget-category" class="field__control" formControlName="categoryId">
          @if (!data.hasGeneral || (data.budget && !data.budget.categoryId)) {
            <option value="">Budget mensile generale</option>
          }
          @for (category of macroCategories(); track category.id) {
            <option [value]="category.id">{{ category.name }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label class="field__label" for="budget-limit">Limite mensile (€)</label>
        <input
          id="budget-limit"
          class="field__control"
          type="text"
          inputmode="decimal"
          formControlName="limit"
          [attr.aria-invalid]="showError(form.controls.limit)"
          [attr.aria-describedby]="showError(form.controls.limit) ? 'budget-limit-error' : null"
        />
        @if (showError(form.controls.limit)) {
          <p id="budget-limit-error" class="field__error">Inserisci un importo maggiore di zero.</p>
        }
      </div>
      <footer class="dialog__footer">
        @if (data.budget) {
          <div class="dialog__footer-start">
            <button type="button" class="icon-button" aria-label="Elimina budget" [disabled]="saving()" (click)="archive()">
              <app-icon name="trash" />
            </button>
          </div>
        }
        <button type="button" class="button button--secondary" (click)="dialogRef.close()">Annulla</button>
        <button type="submit" class="button button--primary" [disabled]="saving()">Salva</button>
      </footer>
    </form>
  `,
})
export class BudgetForm {
  protected readonly data = inject<BudgetFormData>(DIALOG_DATA);
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly store = inject(UserDataStore);
  private readonly repository = inject(BudgetRepository);
  protected readonly showError = showControlError;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly monthLabel = formatLocalDate(this.data.month, 'month');

  protected readonly macroCategories = computed(() =>
    this.store
      .categories()
      .filter(
        (category) =>
          category.parentId === null &&
          category.appliesTo !== 'income' &&
          !category.archived &&
          (category.id === this.data.budget?.categoryId || !this.data.usedCategoryIds.includes(category.id)),
      ),
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    categoryId: [{ value: this.data.budget?.categoryId ?? '', disabled: !!this.data.budget }],
    limit: [this.data.budget ? formatCentsForInput(this.data.budget.limitCents) : '', [Validators.required, positiveAmountValidator]],
  });

  constructor() {
    if (!this.data.budget && this.data.hasGeneral) {
      this.form.controls.categoryId.setValue(this.macroCategories()[0]?.id ?? '');
    }
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid || this.saving()) {
      return;
    }
    if (!value.categoryId && this.data.hasGeneral && !this.data.budget) {
      this.errorMessage.set('Il budget generale di questo mese esiste già.');
      return;
    }
    await this.run(async () => {
      const changes = {
        month: this.data.month,
        categoryId: value.categoryId || undefined,
        limitCents: parseAmountToCents(value.limit) ?? 0,
        archived: false,
      };
      if (this.data.budget) {
        await this.repository.update(this.store.uid, this.data.budget.id, changes);
      } else {
        await this.repository.create(this.store.uid, changes);
      }
    });
  }

  protected async archive(): Promise<void> {
    const budget = this.data.budget;
    if (budget) {
      await this.run(() => this.repository.update(this.store.uid, budget.id, { archived: true }));
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await action();
      this.dialogRef.close(true);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
