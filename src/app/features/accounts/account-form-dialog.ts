import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { AccountDraft } from '../../data-access/repositories/account.repository';
import { ACCOUNT_TYPE_LABELS, Account, AccountType } from '../../domain/models/account';
import { formatCentsForInput, parseSignedAmountToCents } from '../../domain/money/money';
import { Icon } from '../../shared/ui/icon/icon';
import { showControlError, signedAmountValidator } from '../../shared/utils/form-validators';

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  bank: 'landmark',
  card: 'credit-card',
  cash: 'banknote',
  savings: 'piggy-bank',
  other: 'wallet',
};

export const ACCOUNT_COLORS = ['#176b51', '#2f6f9f', '#8a5cb8', '#9b6819', '#c0632e', '#b8487a', '#687873'];

@Component({
  selector: 'app-account-form-dialog',
  imports: [ReactiveFormsModule, Icon],
  template: `
    <form class="dialog" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <header class="dialog__header">
        <h2 id="account-form-title">{{ account ? 'Modifica conto' : 'Nuovo conto' }}</h2>
        <button type="button" class="icon-button" aria-label="Chiudi" (click)="dialogRef.close()">
          <app-icon name="x" />
        </button>
      </header>

      @if (errorMessage(); as message) {
        <p class="alert alert--danger" role="alert">{{ message }}</p>
      }

      <div class="field">
        <label class="field__label" for="account-name">Nome</label>
        <input
          id="account-name"
          class="field__control"
          type="text"
          maxlength="60"
          formControlName="name"
          [attr.aria-invalid]="showError(form.controls.name)"
          [attr.aria-describedby]="showError(form.controls.name) ? 'account-name-error' : null"
        />
        @if (showError(form.controls.name)) {
          <p id="account-name-error" class="field__error">Inserisci un nome di massimo 60 caratteri.</p>
        }
      </div>

      <div class="field-row">
        <div class="field">
          <label class="field__label" for="account-type">Tipo</label>
          <select id="account-type" class="field__control" formControlName="type">
            @for (type of types; track type) {
              <option [value]="type">{{ typeLabels[type] }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="account-opening">Saldo iniziale (€)</label>
          <input
            id="account-opening"
            class="field__control"
            type="text"
            inputmode="decimal"
            formControlName="openingBalance"
            [attr.aria-invalid]="showError(form.controls.openingBalance)"
            aria-describedby="account-opening-hint"
          />
          <p id="account-opening-hint" [class]="showError(form.controls.openingBalance) ? 'field__error' : 'field__hint'">
            {{
              showError(form.controls.openingBalance)
                ? 'Inserisci un importo valido, anche negativo.'
                : 'Per esempio 1250,00 oppure -30,00. Modificalo solo per correggere il saldo di partenza: per registrare un incasso o una spesa usa "Nuova operazione", altrimenti non comparirà nei movimenti né nelle previsioni.'
            }}
          </p>
        </div>
      </div>

      <fieldset class="colors">
        <legend class="field__label">Colore</legend>
        <div class="colors__list">
          @for (color of colors; track color) {
            <label class="colors__option" [style.--swatch]="color">
              <input type="radio" formControlName="color" [value]="color" />
              <span class="visually-hidden">Colore {{ $index + 1 }}</span>
            </label>
          }
        </div>
      </fieldset>

      <label class="checkbox">
        <input type="checkbox" formControlName="includeInNetWorth" />
        Includi nel saldo totale
      </label>
      <label class="checkbox">
        <input type="checkbox" formControlName="includeInAvailable" />
        Includi nel denaro disponibile da spendere
      </label>

      <footer class="dialog__footer">
        <button type="button" class="button button--secondary" (click)="dialogRef.close()">Annulla</button>
        <button type="submit" class="button button--primary" [disabled]="saving()">
          {{ saving() ? 'Salvataggio…' : 'Salva' }}
        </button>
      </footer>
    </form>
  `,
  styles: `
    .colors {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      border: 0;
    }

    .colors__list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .colors__option {
      display: grid;
      place-items: center;
      width: var(--touch-target);
      height: var(--touch-target);
      border-radius: var(--radius-full);
      cursor: pointer;

      input {
        appearance: none;
        width: 28px;
        height: 28px;
        margin: 0;
        border-radius: var(--radius-full);
        background: var(--swatch);
        cursor: pointer;
      }

      input:checked {
        box-shadow:
          0 0 0 3px var(--color-surface),
          0 0 0 5px var(--swatch);
      }
    }
  `,
})
export class AccountFormDialog {
  protected readonly account = inject<Account | null>(DIALOG_DATA);
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly store = inject(UserDataStore);

  protected readonly types = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];
  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly colors = ACCOUNT_COLORS;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showError = showControlError;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.account?.name ?? '', [Validators.required, Validators.maxLength(60)]],
    type: [this.account?.type ?? ('bank' as AccountType)],
    openingBalance: [
      this.account ? formatCentsForInput(this.account.openingBalanceCents) : '0',
      [Validators.required, signedAmountValidator],
    ],
    color: [this.account?.color ?? ACCOUNT_COLORS[0]],
    includeInNetWorth: [this.account?.includeInNetWorth ?? true],
    includeInAvailable: [this.account?.includeInAvailable ?? true],
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const value = this.form.getRawValue();
    const draft: AccountDraft = {
      name: value.name.trim(),
      type: value.type,
      openingBalanceCents: parseSignedAmountToCents(value.openingBalance) ?? 0,
      includeInNetWorth: value.includeInNetWorth,
      includeInAvailable: value.includeInAvailable,
      icon: ACCOUNT_TYPE_ICONS[value.type],
      color: value.color,
      sortOrder: this.account?.sortOrder ?? this.store.accounts().length,
      archived: this.account?.archived ?? false,
    };
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      if (this.account) {
        await this.store.updateAccount(this.account, draft);
      } else {
        await this.store.createAccount(draft);
      }
      this.dialogRef.close(true);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
