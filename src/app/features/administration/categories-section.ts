import { Component, computed, inject, signal } from '@angular/core';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { Category } from '../../domain/models/category';
import { AppDialogService } from '../../shared/ui/dialog/app-dialog.service';
import { Icon, toIconName } from '../../shared/ui/icon/icon';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';
import { CategoryFormData, CategoryFormDialog } from './category-form-dialog';

@Component({
  selector: 'app-categories-section',
  imports: [Icon],
  template: `
    <section class="card section" aria-labelledby="categories-title">
      <div class="section__header">
        <h2 id="categories-title">Categorie</h2>
        <div class="segmented" role="group" aria-label="Tipo di categorie">
          <button type="button" class="segmented__option" [attr.aria-pressed]="appliesTo() === 'expense'" (click)="appliesTo.set('expense')">Spese</button>
          <button type="button" class="segmented__option" [attr.aria-pressed]="appliesTo() === 'income'" (click)="appliesTo.set('income')">Entrate</button>
        </div>
      </div>
      <p class="muted">Le macrocategorie raggruppano le sottocategorie nel resoconto. Le categorie già usate vengono archiviate invece di essere eliminate.</p>

      <ul class="list">
        @for (group of groups(); track group.macro.id) {
          <li class="category-group">
            <div class="list-item">
              <span class="item-icon" [style.color]="group.macro.color"><app-icon [name]="toIconName(group.macro.icon)" /></span>
              <div class="list-item__main">
                <strong>{{ group.macro.name }}</strong>
                <span>Macrocategoria · {{ group.children.length }} sottocategorie</span>
              </div>
              <div class="list-item__actions">
                <button type="button" class="icon-button" [attr.aria-label]="'Aggiungi sottocategoria a ' + group.macro.name" (click)="open(undefined, group.macro.id)">
                  <app-icon name="plus" [size]="18" />
                </button>
                <button type="button" class="icon-button" [attr.aria-label]="'Modifica ' + group.macro.name" (click)="open(group.macro)">
                  <app-icon name="pencil" [size]="18" />
                </button>
                <button type="button" class="icon-button" [attr.aria-label]="'Archivia o elimina ' + group.macro.name" [disabled]="busy()" (click)="remove(group.macro)">
                  <app-icon name="archive" [size]="18" />
                </button>
              </div>
            </div>
            @if (group.children.length > 0) {
              <ul class="list category-group__children">
                @for (child of group.children; track child.id) {
                  <li class="list-item">
                    <div class="list-item__main"><strong>{{ child.name }}</strong></div>
                    <div class="list-item__actions">
                      <button type="button" class="icon-button" [attr.aria-label]="'Modifica ' + child.name" (click)="open(child)">
                        <app-icon name="pencil" [size]="18" />
                      </button>
                      <button type="button" class="icon-button" [attr.aria-label]="'Archivia o elimina ' + child.name" [disabled]="busy()" (click)="remove(child)">
                        <app-icon name="archive" [size]="18" />
                      </button>
                    </div>
                  </li>
                }
              </ul>
            }
          </li>
        }
      </ul>

      <div class="toolbar">
        <button type="button" class="button button--secondary button--small" (click)="open()">
          <app-icon name="plus" [size]="16" />
          Nuova macrocategoria
        </button>
      </div>

      @if (archived().length > 0) {
        <details>
          <summary class="muted">Categorie archiviate ({{ archived().length }})</summary>
          <ul class="list">
            @for (category of archived(); track category.id) {
              <li class="list-item">
                <div class="list-item__main"><strong>{{ category.name }}</strong></div>
                <button type="button" class="button button--ghost button--small" [disabled]="busy()" (click)="restore(category)">
                  <app-icon name="archive-restore" [size]="16" />
                  Ripristina
                </button>
              </li>
            }
          </ul>
        </details>
      }
    </section>
  `,
  styles: `
    .category-group {
      border-top: 1px solid var(--color-border);

      &:first-child {
        border-top: 0;
      }

      > .list-item {
        border-top: 0;
      }
    }

    .category-group__children {
      margin-left: 52px;
    }
  `,
})
export class CategoriesSection {
  private readonly store = inject(UserDataStore);
  private readonly appDialog = inject(AppDialogService);
  private readonly snackbar = inject(SnackbarService);
  protected readonly toIconName = toIconName;
  protected readonly appliesTo = signal<'expense' | 'income'>('expense');
  protected readonly busy = signal(false);

  protected readonly groups = computed(() => {
    const categories = this.store
      .categories()
      .filter((category) => !category.archived && (category.appliesTo === this.appliesTo() || category.appliesTo === 'both'));
    return categories
      .filter((category) => category.parentId === null)
      .map((macro) => ({ macro, children: categories.filter((category) => category.parentId === macro.id) }));
  });

  protected readonly archived = computed(() =>
    this.store.categories().filter((category) => category.archived && category.appliesTo === this.appliesTo()),
  );

  protected open(category?: Category, parentId?: string): void {
    this.appDialog.open<boolean, CategoryFormData>(
      CategoryFormDialog,
      { appliesTo: this.appliesTo(), category, parentId },
      'category-form-title',
    );
  }

  protected async remove(category: Category): Promise<void> {
    await this.run(async () => {
      const archived = await this.store.removeCategory(category);
      this.snackbar.show(archived ? `${category.name} archiviata.` : `${category.name} eliminata.`);
    });
  }

  protected async restore(category: Category): Promise<void> {
    await this.run(() => this.store.updateCategory(category.id, { archived: false }));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      this.snackbar.show(getFirebaseErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
