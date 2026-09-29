import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { Account } from '../../domain/models/account';
import { formatCentsForInput, parseSignedAmountToCents } from '../../domain/money/money';
import { Icon } from '../../shared/ui/icon/icon';
import { showControlError, signedAmountValidator } from '../../shared/utils/form-validators';

@Component({
  selector: 'app-correct-balance-dialog',
  imports: [ReactiveFormsModule, Icon],
  template: `
    <form class="dialog" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <header class="dialog__header">
        <h2 id="correct-balance-title">Correggi saldo di {{ account.name }}</h2>
        <button type="button" class="icon-button" aria-label="Chiudi" (click)="dialogRef.close()">
          <app-icon name="x" />
        </button>
      </header>

      @if (errorMessage(); as message) {
        <p class="alert alert--danger" role="alert">{{ message }}</p>
      }

      <div class="field">
        <label class="field__label" for="correct-balance-amount">Saldo attuale (€)</label>
        <input
          id="correct-balance-amount"
          class="field__control"
          type="text"
          inputmode="decimal"
          formControlName="balance"
          [attr.aria-invalid]="showError(form.controls.balance)"
          aria-describedby="correct-balance-hint"
        />
        <p id="correct-balance-hint" [class]="showError(form.controls.balance) ? 'field__error' : 'field__hint'">
          {{
            showError(form.controls.balance)
              ? 'Inserisci un importo valido, anche negativo.'
              : 'Imposta il saldo esatto, per esempio per allinearlo a quello mostrato dalla tua banca. Non crea un movimento e non modifica lo storico: usalo solo per correggere errori accumulati.'
          }}
        </p>
      </div>

      <footer class="dialog__footer">
        <button type="button" class="button button--secondary" (click)="dialogRef.close()">Annulla</button>
        <button type="submit" class="button button--primary" [disabled]="saving()">
          {{ saving() ? 'Salvataggio…' : 'Correggi' }}
        </button>
      </footer>
    </form>
  `,
})
export class CorrectBalanceDialog {
  protected readonly account = inject<Account>(DIALOG_DATA);
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly store = inject(UserDataStore);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showError = showControlError;

  protected readonly form = inject(NonNullableFormBuilder).group({
    balance: [formatCentsForInput(this.account.currentBalanceCents), [Validators.required, signedAmountValidator]],
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const cents = parseSignedAmountToCents(this.form.getRawValue().balance) ?? 0;
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await this.store.correctBalance(this.account, cents);
      this.dialogRef.close(true);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
