import { Component, computed, inject, signal } from '@angular/core';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { MAX_FAVORITE_TEMPLATES, QuickTemplate } from '../../domain/models/quick-template';
import { TRANSACTION_TYPE_LABELS } from '../../domain/models/transaction';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { AppDialogService } from '../../shared/ui/dialog/app-dialog.service';
import { Icon } from '../../shared/ui/icon/icon';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';
import { TemplateFormDialog } from './template-form-dialog';

@Component({
  selector: 'app-templates-section',
  imports: [Icon, MoneyPipe],
  template: `
    <section class="card section" aria-labelledby="templates-title">
      <div class="section__header">
        <h2 id="templates-title">Modelli rapidi</h2>
        <button type="button" class="button button--secondary button--small" (click)="open()">
          <app-icon name="plus" [size]="16" />
          Nuovo modello
        </button>
      </div>
      <p class="muted">Compilano il form in un tocco. I preferiti (massimo {{ maxFavorites }}) compaiono nel pannello del pulsante +.</p>
      @if (templates().length === 0) {
        <p class="muted">Nessun modello attivo.</p>
      } @else {
        <ul class="list">
          @for (template of templates(); track template.id; let first = $first, last = $last) {
            <li class="list-item">
              <button
                type="button"
                class="icon-button"
                [attr.aria-pressed]="template.favorite"
                [attr.aria-label]="(template.favorite ? 'Togli dai preferiti ' : 'Aggiungi ai preferiti ') + template.name"
                [class.favorite--active]="template.favorite"
                [disabled]="busy()"
                (click)="toggleFavorite(template)"
              >
                <app-icon name="star" [size]="18" />
              </button>
              <div class="list-item__main">
                <strong>{{ template.name }}</strong>
                <span>
                  {{ typeLabels[template.type] }}
                  @if (template.amountCents) {
                    · {{ template.amountCents | money }}
                  }
                  @if (template.favorite) {
                    · preferito
                  }
                </span>
              </div>
              <div class="list-item__actions">
                <button type="button" class="icon-button" [attr.aria-label]="'Sposta su ' + template.name" [disabled]="first || busy()" (click)="move(template, -1)">
                  <app-icon name="arrow-up" [size]="18" />
                </button>
                <button type="button" class="icon-button" [attr.aria-label]="'Sposta giù ' + template.name" [disabled]="last || busy()" (click)="move(template, 1)">
                  <app-icon name="arrow-down" [size]="18" />
                </button>
                <button type="button" class="icon-button" [attr.aria-label]="'Modifica ' + template.name" (click)="open(template)">
                  <app-icon name="pencil" [size]="18" />
                </button>
                <button type="button" class="icon-button" [attr.aria-label]="'Archivia ' + template.name" [disabled]="busy()" (click)="archive(template)">
                  <app-icon name="archive" [size]="18" />
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .favorite--active {
      color: var(--color-warning);
    }
  `,
})
export class TemplatesSection {
  private readonly store = inject(UserDataStore);
  private readonly appDialog = inject(AppDialogService);
  private readonly snackbar = inject(SnackbarService);
  protected readonly typeLabels = TRANSACTION_TYPE_LABELS;
  protected readonly maxFavorites = MAX_FAVORITE_TEMPLATES;
  protected readonly busy = signal(false);
  protected readonly templates = computed(() => this.store.activeTemplates());

  protected open(template: QuickTemplate | null = null): void {
    this.appDialog.open<boolean>(TemplateFormDialog, template, 'template-form-title');
  }

  protected async toggleFavorite(template: QuickTemplate): Promise<void> {
    if (!template.favorite && this.store.favoriteTemplates().length >= MAX_FAVORITE_TEMPLATES) {
      this.snackbar.show(`Puoi avere al massimo ${MAX_FAVORITE_TEMPLATES} preferiti.`);
      return;
    }
    await this.run(() => this.store.updateTemplate(template.id, { favorite: !template.favorite }));
  }

  protected async move(template: QuickTemplate, direction: -1 | 1): Promise<void> {
    const ids = this.templates().map((item) => item.id);
    const index = ids.indexOf(template.id);
    const target = index + direction;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const archivedIds = this.store.templates().filter((item) => item.archived).map((item) => item.id);
    await this.run(() => this.store.reorderTemplates([...ids, ...archivedIds]));
  }

  protected async archive(template: QuickTemplate): Promise<void> {
    await this.run(async () => {
      await this.store.updateTemplate(template.id, { archived: true, favorite: false });
      this.snackbar.show(`${template.name} archiviato.`, {
        actionLabel: 'Annulla',
        action: () => void this.store.updateTemplate(template.id, { archived: false }),
      });
    });
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
