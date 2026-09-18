import { DOCUMENT, Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** How often the app asks the server if a new version has been published. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Keeps the installed app aligned with the published version: when the service worker has a new
 * version ready it is activated and the page reloads, so nobody resta su una build vecchia.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  private lastCheck = 0;
  private reloading = false;

  start(): void {
    if (!this.updates.isEnabled) {
      return;
    }
    this.updates.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        void this.activate();
      }
    });
    // A broken cache cannot be repaired from the running page: only a reload fetches everything again.
    this.updates.unrecoverable.subscribe(() => this.reload());
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') {
        this.check();
      }
    });
    this.check();
  }

  private check(): void {
    const now = Date.now();
    if (now - this.lastCheck < CHECK_INTERVAL_MS) {
      return;
    }
    this.lastCheck = now;
    void this.updates.checkForUpdate().catch(() => undefined);
  }

  private async activate(): Promise<void> {
    try {
      await this.updates.activateUpdate();
    } catch {
      // Even if the activation fails, reloading picks up the new files.
    }
    this.reload();
  }

  private reload(): void {
    if (this.reloading) {
      return;
    }
    this.reloading = true;
    this.document.defaultView?.location.reload();
  }
}
