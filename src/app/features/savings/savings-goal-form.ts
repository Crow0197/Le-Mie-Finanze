import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { SavingsGoalDraft, SavingsGoalRepository } from '../../data-access/repositories/savings-goal.repository';
import { formatCentsForInput, parseAmountToCents } from '../../domain/money/money';
import { SavingsGoal } from '../../domain/models/savings-goal';
import { Icon } from '../../shared/ui/icon/icon';
import { localDateValidator, positiveAmountValidator, showControlError } from '../../shared/utils/form-validators';

@Component({
  selector: 'app-savings-goal-form',
  imports: [ReactiveFormsModule, Icon],
  template: `
    <form class="dialog" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <header class="dialog__header">
        <h2 id="goal-form-title">{{ goal ? 'Modifica obiettivo' : 'Nuovo obiettivo' }}</h2>
        <button type="button" class="icon-button" aria-label="Chiudi" (click)="dialogRef.close()">
          <app-icon name="x" />
        </button>
      </header>
      @if (errorMessage(); as message) {
        <p class="alert alert--danger" role="alert">{{ message }}</p>
      }
      <div class="field">
        <label class="field__label" for="goal-name">Nome</label>
        <input
          id="goal-name"
          class="field__control"
          type="text"
          maxlength="60"
          placeholder="Per esempio Fondo emergenze"
          formControlName="name"
          [attr.aria-invalid]="showError(form.controls.name)"
          [attr.aria-describedby]="showError(form.controls.name) ? 'goal-name-error' : null"
        />
        @if (showError(form.controls.name)) {
          <p id="goal-name-error" class="field__error">Inserisci un nome.</p>
        }
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field__label" for="goal-amount">Importo obiettivo (€)</label>
          <input
            id="goal-amount"
            class="field__control"
            type="text"
            inputmode="decimal"
            formControlName="amount"
            [attr.aria-invalid]="showError(form.controls.amount)"
            [attr.aria-describedby]="showError(form.controls.amount) ? 'goal-amount-error' : null"
          />
          @if (showError(form.controls.amount)) {
            <p id="goal-amount-error" class="field__error">Inserisci un importo maggiore di zero.</p>
          }
        </div>
        <div class="field">
          <label class="field__label" for="goal-date">Data obiettivo (facoltativa)</label>
          <input id="goal-date" class="field__control" type="date" formControlName="targetDate" />
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="goal-account">Conto collegato (facoltativo)</label>
        <select id="goal-account" class="field__control" formControlName="accountId" aria-describedby="goal-account-hint">
          <option value="">Nessuno: usa il saldo totale</option>
          @for (account of store.activeAccounts(); track account.id) {
            <option [value]="account.id">{{ account.name }}</option>
          }
        </select>
        <p id="goal-account-hint" class="field__hint">L'avanzamento è il saldo del conto collegato o, senza conto, il saldo totale.</p>
      </div>
      <footer class="dialog__footer">
        <button type="button" class="button button--secondary" (click)="dialogRef.close()">Annulla</button>
        <button type="submit" class="button button--primary" [disabled]="saving()">Salva</button>
      </footer>
    </form>
  `,
})
export class SavingsGoalForm {
  protected readonly goal = inject<SavingsGoal | null>(DIALOG_DATA);
  protected readonly dialogRef = inject<DialogRef<SavingsGoal>>(DialogRef);
  protected readonly store = inject(UserDataStore);
  private readonly repository = inject(SavingsGoalRepository);
  protected readonly showError = showControlError;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.goal?.name ?? '', [Validators.required, Validators.maxLength(60)]],
    amount: [this.goal ? formatCentsForInput(this.goal.targetAmountCents) : '', [Validators.required, positiveAmountValidator]],
    targetDate: [this.goal?.targetDate ?? '', localDateValidator],
    accountId: [this.goal?.accountId ?? ''],
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const value = this.form.getRawValue();
    const draft: SavingsGoalDraft = {
      name: value.name.trim(),
      targetAmountCents: parseAmountToCents(value.amount) ?? 0,
      targetDate: value.targetDate || undefined,
      accountId: value.accountId || undefined,
      archived: false,
    };
    this.saving.set(true);
    try {
      if (this.goal) {
        await this.repository.update(this.store.uid, this.goal.id, draft);
        this.dialogRef.close({ ...this.goal, ...draft });
      } else {
        this.dialogRef.close(await this.repository.create(this.store.uid, draft));
      }
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
