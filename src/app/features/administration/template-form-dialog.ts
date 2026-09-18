import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { formatCentsForInput, parseAmountToCents } from '../../domain/money/money';
import { QuickTemplate } from '../../domain/models/quick-template';
import { TRANSACTION_TYPE_LABELS, TransactionType } from '../../domain/models/transaction';
import { buildCategoryOptionGroups } from '../../shared/ui/category-select/category-options';
import { Icon } from '../../shared/ui/icon/icon';
import { positiveAmountValidator, showControlError } from '../../shared/utils/form-validators';

@Component({
  selector: 'app-template-form-dialog',
  imports: [ReactiveFormsModule, Icon],
  template: `
    <form class="dialog" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <header class="dialog__header">
        <h2 id="template-form-title">{{ template ? 'Modifica modello' : 'Nuovo modello rapido' }}</h2>
        <button type="button" class="icon-button" aria-label="Chiudi" (click)="dialogRef.close()">
          <app-icon name="x" />
        </button>
      </header>
      @if (errorMessage(); as message) {
        <p class="alert alert--danger" role="alert">{{ message }}</p>
      }
      <div class="segmented" role="group" aria-label="Tipo">
        @for (option of types; track option) {
          <button type="button" class="segmented__option" [attr.aria-pressed]="type() === option" (click)="setType(option)">
            {{ typeLabels[option] }}
          </button>
        }
      </div>
      <div class="field">
        <label class="field__label" for="template-name">Nome</label>
        <input
          id="template-name"
          class="field__control"
          type="text"
          maxlength="40"
          formControlName="name"
          [attr.aria-invalid]="showError(form.controls.name)"
          [attr.aria-describedby]="showError(form.controls.name) ? 'template-name-error' : null"
        />
        @if (showError(form.controls.name)) {
          <p id="template-name-error" class="field__error">Inserisci un nome.</p>
        }
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field__label" for="template-amount">Importo (facoltativo)</label>
          <input
            id="template-amount"
            class="field__control"
            type="text"
            inputmode="decimal"
            formControlName="amount"
            [attr.aria-invalid]="showError(form.controls.amount)"
          />
        </div>
        <div class="field">
          <label class="field__label" for="template-account">{{ type() === 'transfer' ? 'Da conto' : 'Conto (facoltativo)' }}</label>
          <select id="template-account" class="field__control" formControlName="accountId">
            <option value="">Conto predefinito</option>
            @for (account of store.activeAccounts(); track account.id) {
              <option [value]="account.id">{{ account.name }}</option>
            }
          </select>
        </div>
      </div>
      @if (type() === 'transfer') {
        <div class="field">
          <label class="field__label" for="template-destination">A conto (facoltativo)</label>
          <select id="template-destination" class="field__control" formControlName="destinationAccountId">
            <option value="">Da scegliere</option>
            @for (account of store.activeAccounts(); track account.id) {
              <option [value]="account.id">{{ account.name }}</option>
            }
          </select>
        </div>
      } @else {
        <div class="field">
          <label class="field__label" for="template-category">Categoria</label>
          <select id="template-category" class="field__control" formControlName="categoryId">
            <option value="">Da scegliere</option>
            @for (group of categoryGroups(); track group.macro.id) {
              <option [value]="group.macro.id">{{ group.macro.name }}</option>
              @for (child of group.children; track child.id) {
                <option [value]="child.id">— {{ child.name }}</option>
              }
            }
          </select>
        </div>
      }
      <div class="field">
        <label class="field__label" for="template-description">Descrizione</label>
        <input id="template-description" class="field__control" type="text" maxlength="200" formControlName="description" />
      </div>
      <label class="checkbox">
        <input type="checkbox" formControlName="favorite" />
        Mostra tra i preferiti del pannello rapido (massimo 4)
      </label>
      <footer class="dialog__footer">
        <button type="button" class="button button--secondary" (click)="dialogRef.close()">Annulla</button>
        <button type="submit" class="button button--primary" [disabled]="saving()">Salva</button>
      </footer>
    </form>
  `,
})
export class TemplateFormDialog {
  protected readonly template = inject<QuickTemplate | null>(DIALOG_DATA);
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected readonly store = inject(UserDataStore);
  protected readonly typeLabels = TRANSACTION_TYPE_LABELS;
  protected readonly types: TransactionType[] = ['expense', 'income', 'transfer'];
  protected readonly showError = showControlError;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly type = signal<TransactionType>(this.template?.type ?? 'expense');

  protected readonly categoryGroups = computed(() => {
    const type = this.type();
    return type === 'transfer' ? [] : buildCategoryOptionGroups(this.store.categories(), type, this.template?.categoryId);
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.template?.name ?? '', [Validators.required, Validators.maxLength(40)]],
    amount: [this.template?.amountCents ? formatCentsForInput(this.template.amountCents) : '', positiveAmountValidator],
    accountId: [this.template?.accountId ?? this.template?.sourceAccountId ?? ''],
    destinationAccountId: [this.template?.destinationAccountId ?? ''],
    categoryId: [this.template?.categoryId ?? ''],
    description: [this.template?.description ?? ''],
    favorite: [this.template?.favorite ?? false],
  });

  protected setType(type: TransactionType): void {
    this.type.set(type);
    this.form.controls.categoryId.setValue('');
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const value = this.form.getRawValue();
    const favorites = this.store.favoriteTemplates().filter((item) => item.id !== this.template?.id);
    if (value.favorite && favorites.length >= 4) {
      this.errorMessage.set('Hai già 4 preferiti: togline uno prima di aggiungerne un altro.');
      return;
    }
    const isTransfer = this.type() === 'transfer';
    const changes = {
      name: value.name.trim(),
      type: this.type(),
      amountCents: value.amount ? (parseAmountToCents(value.amount) ?? undefined) : undefined,
      description: value.description.trim() || value.name.trim(),
      categoryId: isTransfer ? undefined : value.categoryId || undefined,
      accountId: isTransfer ? undefined : value.accountId || undefined,
      sourceAccountId: isTransfer ? value.accountId || undefined : undefined,
      destinationAccountId: isTransfer ? value.destinationAccountId || undefined : undefined,
      favorite: value.favorite,
    };
    this.saving.set(true);
    try {
      if (this.template) {
        await this.store.updateTemplate(this.template.id, changes);
      } else {
        await this.store.createTemplate({ ...changes, sortOrder: this.store.templates().length, archived: false });
      }
      this.dialogRef.close(true);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
