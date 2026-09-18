import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { Category } from '../../domain/models/category';
import { Icon, IconName, SELECTABLE_ICONS, toIconName } from '../../shared/ui/icon/icon';
import { showControlError } from '../../shared/utils/form-validators';
import { ACCOUNT_COLORS } from '../accounts/account-form-dialog';

export interface CategoryFormData {
  appliesTo: 'expense' | 'income';
  category?: Category;
  parentId?: string | null;
}

@Component({
  selector: 'app-category-form-dialog',
  imports: [ReactiveFormsModule, Icon],
  template: `
    <form class="dialog" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <header class="dialog__header">
        <h2 id="category-form-title">{{ data.category ? 'Modifica categoria' : 'Nuova categoria' }}</h2>
        <button type="button" class="icon-button" aria-label="Chiudi" (click)="dialogRef.close()">
          <app-icon name="x" />
        </button>
      </header>
      @if (errorMessage(); as message) {
        <p class="alert alert--danger" role="alert">{{ message }}</p>
      }
      <div class="field">
        <label class="field__label" for="category-name">Nome</label>
        <input
          id="category-name"
          class="field__control"
          type="text"
          maxlength="40"
          formControlName="name"
          [attr.aria-invalid]="showError(form.controls.name)"
          [attr.aria-describedby]="showError(form.controls.name) ? 'category-name-error' : null"
        />
        @if (showError(form.controls.name)) {
          <p id="category-name-error" class="field__error">Inserisci un nome.</p>
        }
      </div>
      <div class="field">
        <label class="field__label" for="category-parent">Macrocategoria</label>
        <select id="category-parent" class="field__control" formControlName="parentId" aria-describedby="category-parent-hint">
          <option value="">Nessuna: è una macrocategoria</option>
          @for (macro of macros(); track macro.id) {
            <option [value]="macro.id">{{ macro.name }}</option>
          }
        </select>
        <p id="category-parent-hint" class="field__hint">Le sottocategorie vengono sommate alla loro macro nel resoconto.</p>
      </div>
      <fieldset class="icon-picker">
        <legend class="field__label">Icona</legend>
        <div class="icon-picker__list">
          @for (icon of icons; track icon) {
            <label class="icon-picker__option">
              <input type="radio" formControlName="icon" [value]="icon" />
              <app-icon [name]="icon" [size]="18" />
              <span class="visually-hidden">{{ icon }}</span>
            </label>
          }
        </div>
      </fieldset>
      <fieldset class="icon-picker">
        <legend class="field__label">Colore</legend>
        <div class="icon-picker__list">
          @for (color of colors; track color) {
            <label class="icon-picker__option" [style.color]="color">
              <input type="radio" formControlName="color" [value]="color" />
              <span class="icon-picker__swatch" aria-hidden="true"></span>
              <span class="visually-hidden">Colore {{ $index + 1 }}</span>
            </label>
          }
        </div>
      </fieldset>
      <footer class="dialog__footer">
        <button type="button" class="button button--secondary" (click)="dialogRef.close()">Annulla</button>
        <button type="submit" class="button button--primary" [disabled]="saving()">Salva</button>
      </footer>
    </form>
  `,
  styles: `
    .icon-picker {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      border: 0;
    }

    .icon-picker__list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }

    .icon-picker__option {
      position: relative;
      display: grid;
      place-items: center;
      width: var(--touch-target);
      height: var(--touch-target);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      cursor: pointer;

      input {
        position: absolute;
        inset: 0;
        margin: 0;
        opacity: 0;
        cursor: pointer;
      }

      &:has(input:checked) {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-soft);
      }

      &:has(input:focus-visible) {
        outline: 3px solid var(--color-focus);
        outline-offset: 2px;
      }
    }

    .icon-picker__swatch {
      width: 22px;
      height: 22px;
      border-radius: var(--radius-full);
      background: currentColor;
    }
  `,
})
export class CategoryFormDialog {
  protected readonly data = inject<CategoryFormData>(DIALOG_DATA);
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly store = inject(UserDataStore);
  protected readonly icons = SELECTABLE_ICONS;
  protected readonly colors = ACCOUNT_COLORS;
  protected readonly showError = showControlError;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly hasChildren = this.store.categories().some((item) => item.parentId === this.data.category?.id);

  protected readonly macros = computed(() =>
    this.store
      .categories()
      .filter(
        (category) =>
          category.parentId === null &&
          !category.archived &&
          category.appliesTo === this.data.appliesTo &&
          category.id !== this.data.category?.id &&
          !this.hasChildren,
      ),
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.category?.name ?? '', [Validators.required, Validators.maxLength(40)]],
    parentId: [this.data.category?.parentId ?? this.data.parentId ?? ''],
    icon: [toIconName(this.data.category?.icon, 'tag') as IconName],
    color: [this.data.category?.color ?? ACCOUNT_COLORS[0]],
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const value = this.form.getRawValue();
    const changes = {
      name: value.name.trim(),
      parentId: value.parentId || null,
      icon: value.icon,
      color: value.color,
    };
    this.saving.set(true);
    try {
      if (this.data.category) {
        await this.store.updateCategory(this.data.category.id, changes);
      } else {
        await this.store.createCategory({
          ...changes,
          appliesTo: this.data.appliesTo,
          sortOrder: Math.max(0, ...this.store.categories().map((category) => category.sortOrder)) + 1,
          archived: false,
          system: false,
        });
      }
      this.dialogRef.close(true);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
