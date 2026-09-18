import { Component, input } from '@angular/core';
import { Icon, IconName } from '../icon/icon';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  template: `
    <div class="empty-state__icon">
      <app-icon [name]="icon()" [size]="28" />
    </div>
    <h2 class="empty-state__title">{{ heading() }}</h2>
    <p class="empty-state__description">{{ description() }}</p>
    <ng-content />
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: var(--space-3);
      padding: var(--space-7) var(--space-5);
      text-align: center;
    }

    .empty-state__icon {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: var(--radius-full);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .empty-state__description {
      max-width: 36ch;
      color: var(--color-text-muted);
    }
  `,
})
export class EmptyState {
  readonly icon = input.required<IconName>();
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
}
