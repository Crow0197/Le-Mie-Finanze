import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';

@Component({
  selector: 'app-default-account-dialog',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="dialog">
      <h2 id="default-account-title">Scegli il conto predefinito</h2>
      @if (store.activeAccounts().length === 0) {
        <p class="dialog__text">Non ci sono conti attivi. Crea un conto per continuare a registrare operazioni.</p>
        <div class="dialog__footer">
          <a class="button button--primary" routerLink="/conti" (click)="dialogRef.close()">Vai ai conti</a>
        </div>
      } @else {
        <p class="dialog__text">
          Il conto predefinito non è più disponibile. Scegline un altro: verrà proposto automaticamente
          quando registri una spesa, ma potrai sempre cambiarlo.
        </p>
        @if (errorMessage(); as message) {
          <p class="alert alert--danger" role="alert">{{ message }}</p>
        }
        <div class="field">
          <label class="field__label" for="default-account-select">Conto predefinito</label>
          <select id="default-account-select" class="field__control" [(ngModel)]="selectedId">
            @for (account of store.activeAccounts(); track account.id) {
              <option [value]="account.id">{{ account.name }}</option>
            }
          </select>
        </div>
        <div class="dialog__footer">
          <button type="button" class="button button--primary" [disabled]="saving()" (click)="save()">
            Imposta come predefinito
          </button>
        </div>
      }
    </div>
  `,
})
export class DefaultAccountDialog {
  protected readonly store = inject(UserDataStore);
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected selectedId = this.store.activeAccounts()[0]?.id ?? '';
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      await this.store.updateSettings({ defaultAccountId: this.selectedId });
      this.dialogRef.close(true);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
