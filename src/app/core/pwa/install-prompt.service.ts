import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';

/** How the app can be installed on the current device. */
export type InstallMode = 'native' | 'ios' | 'androidManual';

/** Chromium-only event, not yet part of the TypeScript DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_STORAGE_KEY = 'le-mie-finanze.install-prompt-dismissed';

/**
 * Suggests installing the PWA once. Android/Chromium use the native prompt; iOS has no install API,
 * so Safari users get the "Aggiungi alla schermata Home" steps. Once closed or installed it never shows again.
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly window = inject(DOCUMENT).defaultView;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly nativePromptAvailable = signal(false);
  private readonly dismissed = signal(readDismissed());
  private readonly standalone = this.isStandalone();
  private readonly userAgent = this.window?.navigator.userAgent ?? '';

  readonly mode = computed<InstallMode | null>(() => {
    if (this.nativePromptAvailable()) {
      return 'native';
    }
    if (this.isIos()) {
      return 'ios';
    }
    if (/android/i.test(this.userAgent)) {
      return 'androidManual';
    }
    return null;
  });

  readonly visible = computed(() => !this.standalone && !this.dismissed() && this.mode() !== null);

  constructor() {
    this.window?.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.nativePromptAvailable.set(true);
    });
    this.window?.addEventListener('appinstalled', () => this.dismiss());
  }

  async install(): Promise<void> {
    const prompt = this.deferredPrompt;
    if (!prompt) {
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    this.deferredPrompt = null;
    this.nativePromptAvailable.set(false);
    if (choice.outcome === 'accepted') {
      this.dismiss();
    }
  }

  dismiss(): void {
    this.dismissed.set(true);
    try {
      this.window?.localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
    } catch {
      // Storage can be unavailable (private mode): the banner simply comes back next time.
    }
  }

  private isStandalone(): boolean {
    const navigatorWithStandalone = this.window?.navigator as (Navigator & { standalone?: boolean }) | undefined;
    return !!this.window?.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone?.standalone === true;
  }

  private isIos(): boolean {
    // iPadOS reports itself as a Mac: touch support tells them apart.
    return /iphone|ipad|ipod/i.test(this.userAgent) || (/macintosh/i.test(this.userAgent) && (this.window?.navigator.maxTouchPoints ?? 0) > 1);
  }
}

function readDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(DISMISSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
