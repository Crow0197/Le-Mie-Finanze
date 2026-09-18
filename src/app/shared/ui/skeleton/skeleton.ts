import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  template: '',
  host: {
    'aria-hidden': 'true',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
  styles: `
    :host {
      display: block;
      border-radius: var(--radius-sm);
      background: linear-gradient(
        90deg,
        var(--color-surface-soft) 0%,
        var(--color-border) 50%,
        var(--color-surface-soft) 100%
      );
      background-size: 200% 100%;
      animation: skeleton-pulse 1.4s ease-in-out infinite;
    }

    @keyframes skeleton-pulse {
      from {
        background-position: 100% 0;
      }
      to {
        background-position: -100% 0;
      }
    }
  `,
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('16px');
}
