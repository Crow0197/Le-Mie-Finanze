import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_INFO } from '../../core/app-info';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { TestModeService } from '../../core/test-mode/test-mode.service';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  selector: 'app-test-mode-page',
  imports: [Icon, RouterLink],
  template: `
    <main class="card test-page" aria-labelledby="test-mode-title">
      <p class="test-page__brand"><app-icon name="wallet" />{{ appName }}</p>
      <h1 id="test-mode-title">Modalità prova</h1>

      @if (errorMessage(); as message) {
        <p class="alert alert--danger" role="alert">{{ message }}</p>
      }

      @if (testMode.active()) {
        <p>Sei già in modalità prova.</p>
        <div class="dialog__footer">
          <button type="button" class="button button--ghost" [disabled]="testMode.busy()" (click)="end()">Termina ed elimina</button>
          <a class="button button--primary" routerLink="/benvenuto">Riapri la configurazione</a>
        </div>
      } @else {
        <p class="muted">Entri come un utente nuovo, per provare la configurazione iniziale e l'app da zero.</p>
        <ul class="test-page__facts">
          <li><app-icon name="check" [size]="18" /> I tuoi dati veri non vengono toccati.</li>
          <li><app-icon name="check" [size]="18" /> In alto vedrai sempre "Modalità prova · Termina ed elimina".</li>
          <li><app-icon name="check" [size]="18" /> Terminando, cancello tutti i dati di prova e l'account temporaneo.</li>
          <li>
            <app-icon name="info" [size]="18" /> Per iniziare esci dal tuo account: alla fine rientri con "Accedi con Google".
          </li>
        </ul>
        <div class="dialog__footer">
          <a class="button button--ghost" routerLink="/">Annulla</a>
          <button type="button" class="button button--primary" [disabled]="testMode.busy()" (click)="start()">
            {{ testMode.busy() ? 'Preparo…' : 'Inizia la prova' }}
          </button>
        </div>
      }
    </main>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: var(--space-5) var(--space-4);
    }

    .test-page {
      display: grid;
      gap: var(--space-4);
      width: min(480px, 100%);
    }

    .test-page__brand {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-primary);
      font-weight: 700;
    }

    .test-page__facts {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: var(--font-size-sm);

      li {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
      }

      app-icon {
        flex: none;
        margin-top: 2px;
        color: var(--color-primary);
      }
    }
  `,
})
export class TestModePage {
  protected readonly testMode = inject(TestModeService);
  protected readonly appName = APP_INFO.name;
  protected readonly errorMessage = signal<string | null>(null);

  protected async start(): Promise<void> {
    await this.guard(() => this.testMode.start());
  }

  protected async end(): Promise<void> {
    await this.guard(() => this.testMode.end());
  }

  private async guard(action: () => Promise<void>): Promise<void> {
    this.errorMessage.set(null);
    try {
      await action();
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    }
  }
}
