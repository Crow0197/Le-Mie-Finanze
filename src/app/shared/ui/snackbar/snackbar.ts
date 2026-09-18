import { Component, inject } from '@angular/core';
import { SnackbarService } from './snackbar.service';

@Component({
  selector: 'app-snackbar',
  template: `
    <div aria-live="polite" aria-atomic="true">
      @if (snackbar.message(); as message) {
        <div class="snackbar" animate.enter="snackbar--enter" animate.leave="snackbar--leave">
          <span>{{ message.text }}</span>
          @if (message.actionLabel) {
            <button type="button" class="snackbar__action" (click)="snackbar.runAction()">
              {{ message.actionLabel }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset-inline: var(--space-4);
      bottom: calc(var(--bottom-nav-height) + var(--space-4) + env(safe-area-inset-bottom));
      z-index: 1100;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }

    @media (min-width: 1024px) {
      :host {
        bottom: var(--space-5);
      }
    }

    .snackbar {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      max-width: 520px;
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      background: var(--color-text);
      color: var(--color-surface);
      box-shadow: var(--shadow-lg);
      pointer-events: auto;
    }

    .snackbar__action {
      min-height: var(--touch-target);
      padding: 0 var(--space-3);
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: #9fdcc4;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .snackbar--enter {
      animation: snackbar-in var(--duration-normal) var(--easing-standard);
    }

    .snackbar--leave {
      animation: snackbar-out var(--duration-fast) var(--easing-standard) forwards;
    }

    @keyframes snackbar-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }

    @keyframes snackbar-out {
      to {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
})
export class Snackbar {
  protected readonly snackbar = inject(SnackbarService);
}
