import { Component, inject } from '@angular/core';
import { Icon } from '../../shared/ui/icon/icon';
import { APP_INFO } from '../app-info';
import { InstallPromptService } from './install-prompt.service';

@Component({
  selector: 'app-install-banner',
  imports: [Icon],
  template: `
    @if (installPrompt.visible()) {
      <section class="install-banner" role="dialog" aria-labelledby="install-banner-title" animate.enter="install-banner--enter">
        <div class="install-banner__header">
          <span class="install-banner__icon"><app-icon name="smartphone" /></span>
          <h2 id="install-banner-title">Usa {{ appName }} come app</h2>
          <button type="button" class="icon-button" aria-label="Chiudi e non mostrare più" (click)="installPrompt.dismiss()">
            <app-icon name="x" />
          </button>
        </div>

        @switch (installPrompt.mode()) {
          @case ('native') {
            <p class="muted">Aggiungila alla schermata Home: si apre a schermo intero, come un'app vera.</p>
            <div class="install-banner__actions">
              <button type="button" class="button button--ghost button--small" (click)="installPrompt.dismiss()">Non ora</button>
              <button type="button" class="button button--primary button--small" (click)="installPrompt.install()">
                <app-icon name="download" [size]="16" />
                Installa
              </button>
            </div>
          }
          @case ('ios') {
            <ol class="install-banner__steps">
              <li>Apri questa pagina con <strong>Safari</strong>.</li>
              <li>Tocca <app-icon name="share" [size]="16" /> <strong>Condividi</strong> nella barra in basso.</li>
              <li>Scegli <app-icon name="square-plus" [size]="16" /> <strong>Aggiungi alla schermata Home</strong> e poi <strong>Aggiungi</strong>.</li>
            </ol>
            <div class="install-banner__actions">
              <button type="button" class="button button--primary button--small" (click)="installPrompt.dismiss()">Ho capito</button>
            </div>
          }
          @case ('androidManual') {
            <ol class="install-banner__steps">
              <li>Apri il menu <strong>⋮</strong> del browser.</li>
              <li>Scegli <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong>.</li>
            </ol>
            <div class="install-banner__actions">
              <button type="button" class="button button--primary button--small" (click)="installPrompt.dismiss()">Ho capito</button>
            </div>
          }
        }
        <p class="install-banner__note">Questo messaggio non comparirà più.</p>
      </section>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset-inline: var(--space-3);
      bottom: calc(var(--bottom-nav-height) + var(--space-3) + env(safe-area-inset-bottom));
      z-index: 1050;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }

    @media (min-width: 1024px) {
      :host {
        inset-inline: auto var(--space-5);
        bottom: var(--space-5);
      }
    }

    .install-banner {
      display: grid;
      gap: var(--space-3);
      width: 100%;
      max-width: 420px;
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
      pointer-events: auto;
    }

    .install-banner--enter {
      animation: install-banner-in 200ms ease-out;
    }

    @keyframes install-banner-in {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
    }

    .install-banner__header {
      display: flex;
      align-items: center;
      gap: var(--space-3);

      h2 {
        flex: 1;
        margin: 0;
        font-size: var(--font-size-md, 1rem);
      }
    }

    .install-banner__icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .install-banner__steps {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding-left: var(--space-5);
      font-size: var(--font-size-sm);

      app-icon {
        vertical-align: -3px;
      }
    }

    .install-banner__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }

    .install-banner__note {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 12px;
    }
  `,
})
export class InstallBanner {
  protected readonly installPrompt = inject(InstallPromptService);
  protected readonly appName = APP_INFO.name;
}
