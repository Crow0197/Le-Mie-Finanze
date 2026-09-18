import { Component, inject, signal } from '@angular/core';
import { Icon } from '../../shared/ui/icon/icon';
import { getFirebaseErrorMessage } from '../error-handling/firebase-error-message';
import { TestModeService } from './test-mode.service';

@Component({
  selector: 'app-test-mode-banner',
  imports: [Icon],
  template: `
    @if (testMode.active()) {
      <div class="test-banner" role="status">
        <app-icon name="sparkles" [size]="16" />
        <span>Modalità prova</span>
        <button type="button" class="test-banner__end" [disabled]="testMode.busy()" (click)="end()">
          {{ testMode.busy() ? 'Elimino…' : 'Termina ed elimina' }}
        </button>
      </div>
      @if (errorMessage(); as message) {
        <p class="test-banner__error" role="alert">{{ message }}</p>
      }
    }
  `,
  styles: `
    :host {
      position: fixed;
      top: calc(env(safe-area-inset-top) + var(--space-2));
      left: 50%;
      z-index: 1300;
      display: grid;
      justify-items: center;
      gap: var(--space-1);
      transform: translateX(-50%);
      pointer-events: none;
    }

    .test-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      background: var(--color-warning);
      box-shadow: var(--shadow-md);
      color: #fff;
      font-size: var(--font-size-sm);
      font-weight: 600;
      white-space: nowrap;
      pointer-events: auto;
    }

    .test-banner__end {
      min-height: 32px;
      padding: 0 var(--space-3);
      border: 0;
      border-radius: var(--radius-full);
      background: #fff;
      color: var(--color-warning);
      font: inherit;
      cursor: pointer;
    }

    .test-banner__error {
      max-width: 320px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      background: var(--color-danger-soft);
      color: var(--color-danger);
      font-size: var(--font-size-sm);
      pointer-events: auto;
    }
  `,
})
export class TestModeBanner {
  protected readonly testMode = inject(TestModeService);
  protected readonly errorMessage = signal<string | null>(null);

  protected async end(): Promise<void> {
    this.errorMessage.set(null);
    try {
      await this.testMode.end();
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    }
  }
}
