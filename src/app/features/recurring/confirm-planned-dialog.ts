import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { formatCentsForInput, parseAmountToCents } from '../../domain/money/money';
import { Transaction } from '../../domain/models/transaction';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { positiveAmountValidator, showControlError } from '../../shared/utils/form-validators';

@Component({
  selector: 'app-confirm-planned-dialog',
  imports: [ReactiveFormsModule, LocalDatePipe],
  template: `
    <form class="dialog" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 id="confirm-planned-title">Conferma operazione</h2>
      <p class="dialog__text">
        {{ transaction.description || 'Operazione' }} del {{ transaction.effectiveDate | localDate }}. Puoi cambiare l'importo
        solo per questa volta: la regola ricorrente non cambia.
      </p>
      <div class="field">
        <label class="field__label" for="confirm-planned-amount">Importo effettivo (€)</label>
        <input
          id="confirm-planned-amount"
          class="field__control amount-input"
          type="text"
          inputmode="decimal"
          formControlName="amount"
          [attr.aria-invalid]="showError(form.controls.amount)"
          [attr.aria-describedby]="showError(form.controls.amount) ? 'confirm-planned-error' : null"
        />
        @if (showError(form.controls.amount)) {
          <p id="confirm-planned-error" class="field__error">Inserisci un importo maggiore di zero.</p>
        }
      </div>
      <div class="dialog__footer">
        <button type="button" class="button button--secondary" (click)="dialogRef.close()">Annulla</button>
        <button type="submit" class="button button--primary">Conferma</button>
      </div>
    </form>
  `,
})
export class ConfirmPlannedDialog {
  protected readonly transaction = inject<Transaction>(DIALOG_DATA);
  protected readonly dialogRef = inject<DialogRef<number>>(DialogRef);
  protected readonly showError = showControlError;
  protected readonly form = inject(NonNullableFormBuilder).group({
    amount: [formatCentsForInput(this.transaction.amountCents), [Validators.required, positiveAmountValidator]],
  });

  protected submit(): void {
    this.form.markAllAsTouched();
    const cents = parseAmountToCents(this.form.getRawValue().amount);
    if (this.form.invalid || !cents) {
      return;
    }
    this.dialogRef.close(cents);
  }
}
