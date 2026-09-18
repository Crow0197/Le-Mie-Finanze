import { Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { formatCentsForInput, parseAmountToCents } from '../../domain/money/money';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';
import { showControlError } from '../../shared/utils/form-validators';

@Component({
  selector: 'app-settings-section',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <form class="card form" [formGroup]="form" (ngSubmit)="save()" novalidate aria-labelledby="settings-title">
      <h2 id="settings-title">Impostazioni</h2>
      <div class="field-row">
        <div class="field">
          <label class="field__label" for="settings-name">Nome</label>
          <input id="settings-name" class="field__control" type="text" maxlength="60" formControlName="displayName" />
        </div>
        <div class="field">
          <label class="field__label" for="settings-default-account">Conto predefinito</label>
          <select id="settings-default-account" class="field__control" formControlName="defaultAccountId" aria-describedby="settings-default-hint">
            <option value="" disabled>Seleziona un conto</option>
            @for (account of store.activeAccounts(); track account.id) {
              <option [value]="account.id">{{ account.name }}</option>
            }
          </select>
          <p id="settings-default-hint" class="field__hint">Proposto automaticamente quando registri un'operazione.</p>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field__label" for="settings-buffer">Margine di sicurezza da non spendere (€)</label>
          <input
            id="settings-buffer"
            class="field__control"
            type="text"
            inputmode="decimal"
            formControlName="safetyBuffer"
            [attr.aria-invalid]="showError(form.controls.safetyBuffer)"
            aria-describedby="settings-buffer-hint"
          />
          <p id="settings-buffer-hint" [class]="showError(form.controls.safetyBuffer) ? 'field__error' : 'field__hint'">
            {{ showError(form.controls.safetyBuffer) ? 'Inserisci un importo valido.' : 'Sottratto dal disponibile fino allo stipendio.' }}
          </p>
        </div>
        <div class="field">
          <span class="field__label">Valuta, lingua e settimana</span>
          <p class="muted">Euro (EUR) · Italiano · Europe/Rome · la settimana inizia di lunedì</p>
          <a routerLink="/benvenuto" class="muted" (click)="resumeOnboarding()">Rivedi la configurazione iniziale</a>
        </div>
      </div>
      <div class="dialog__footer">
        <button type="submit" class="button button--primary" [disabled]="saving() || form.pristine">Salva impostazioni</button>
      </div>
    </form>
  `,
})
export class SettingsSection {
  protected readonly store = inject(UserDataStore);
  private readonly snackbar = inject(SnackbarService);
  protected readonly showError = showControlError;
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', Validators.maxLength(60)],
    defaultAccountId: [''],
    safetyBuffer: ['0', Validators.pattern(/^\s*\d+([.,]\d{1,2})?\s*$/)],
  });

  constructor() {
    effect(() => {
      const settings = this.store.settings();
      if (settings && this.form.pristine) {
        this.form.reset({
          displayName: settings.displayName,
          defaultAccountId: this.store.defaultAccount()?.id ?? '',
          safetyBuffer: formatCentsForInput(settings.safetyBufferCents),
        });
      }
    });
  }

  protected resumeOnboarding(): void {
    void this.store.updateSettings({ onboardingCompleted: false });
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    try {
      await this.store.updateSettings({
        displayName: value.displayName.trim(),
        defaultAccountId: value.defaultAccountId || null,
        safetyBufferCents: value.safetyBuffer.trim() === '0' ? 0 : (parseAmountToCents(value.safetyBuffer) ?? 0),
      });
      this.form.markAsPristine();
      this.snackbar.show('Impostazioni salvate.');
    } catch (error) {
      this.snackbar.show(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
