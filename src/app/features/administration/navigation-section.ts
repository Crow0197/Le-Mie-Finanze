import { Component, computed, inject, signal } from '@angular/core';
import { NAVIGATION_ITEMS } from '../../core/layout/navigation';
import { NavigationService } from '../../core/state/navigation.service';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { NavigationPreference, resolveNavigation } from '../../domain/navigation/navigation';
import { Icon } from '../../shared/ui/icon/icon';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';

/** Sections shown in the bar at the bottom of the phone, besides Altro. */
const BOTTOM_NAV_COUNT = 3;

@Component({
  selector: 'app-navigation-section',
  imports: [Icon],
  template: `
    <section class="card section" aria-labelledby="navigation-title">
      <h2 id="navigation-title">Sezioni e ordine</h2>
      <p class="muted">
        Sposta le sezioni nell'ordine che preferisci e nascondi quelle che non usi. Le prime
        {{ bottomNavCount }} finiscono nella barra in basso del telefono, le altre sotto «Altro»; sul computer
        l'ordine è quello del menu laterale.
      </p>

      <ul class="list">
        @for (entry of entries(); track entry.item.id; let index = $index) {
          <li class="list-item">
            <span class="item-icon"><app-icon [name]="entry.item.icon" /></span>
            <div class="list-item__main">
              <strong>{{ entry.item.label }}</strong>
              <span>
                @if (!entry.visible) {
                  Nascosta
                } @else if (index < bottomNavCount) {
                  Barra in basso · menu laterale
                } @else {
                  Sotto «Altro» · menu laterale
                }
                @if (entry.item.locked) {
                  · sempre visibile
                }
              </span>
            </div>
            <div class="list-item__actions">
              <label class="checkbox">
                <input
                  type="checkbox"
                  [checked]="entry.visible"
                  [disabled]="entry.item.locked"
                  [attr.aria-label]="'Mostra ' + entry.item.label"
                  (change)="toggle(index)"
                />
                Mostra
              </label>
              <button
                type="button"
                class="icon-button"
                [disabled]="index === 0"
                [attr.aria-label]="'Sposta ' + entry.item.label + ' più in alto'"
                (click)="move(index, -1)"
              >
                <app-icon name="arrow-up" [size]="18" />
              </button>
              <button
                type="button"
                class="icon-button"
                [disabled]="index === entries().length - 1"
                [attr.aria-label]="'Sposta ' + entry.item.label + ' più in basso'"
                (click)="move(index, 1)"
              >
                <app-icon name="arrow-down" [size]="18" />
              </button>
            </div>
          </li>
        }
      </ul>

      <div class="dialog__footer">
        @if (dirty()) {
          <button type="button" class="button button--ghost" [disabled]="saving()" (click)="cancel()">Annulla</button>
        }
        <button type="button" class="button button--primary" [disabled]="!dirty() || saving()" (click)="save()">
          Salva ordine
        </button>
      </div>
    </section>
  `,
})
export class NavigationSection {
  private readonly navigation = inject(NavigationService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly bottomNavCount = BOTTOM_NAV_COUNT;
  protected readonly saving = signal(false);
  protected readonly dirty = signal(false);
  /** Changes not saved yet; until then the list follows the saved settings. */
  private readonly draft = signal<NavigationPreference[] | null>(null);

  protected readonly entries = computed(() => {
    const draft = this.draft();
    return draft ? resolveNavigation(NAVIGATION_ITEMS, draft) : this.navigation.entries();
  });

  protected move(index: number, delta: number): void {
    const preferences = this.currentPreferences();
    const target = index + delta;
    if (target < 0 || target >= preferences.length) {
      return;
    }
    [preferences[index], preferences[target]] = [preferences[target], preferences[index]];
    this.draft.set(preferences);
    this.dirty.set(true);
  }

  protected toggle(index: number): void {
    const preferences = this.currentPreferences();
    preferences[index] = { ...preferences[index], visible: !preferences[index].visible };
    this.draft.set(preferences);
    this.dirty.set(true);
  }

  protected cancel(): void {
    this.draft.set(null);
    this.dirty.set(false);
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      await this.navigation.save(this.currentPreferences());
      this.cancel();
      this.snackbar.show('Ordine delle sezioni salvato.');
    } catch (error) {
      this.snackbar.show(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private currentPreferences(): NavigationPreference[] {
    return this.entries().map((entry) => ({ id: entry.item.id, visible: entry.visible }));
  }
}
