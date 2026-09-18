import { Injectable, signal } from '@angular/core';

export interface SnackbarMessage {
  id: number;
  text: string;
  actionLabel?: string;
  action?: () => void;
}

const DEFAULT_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly currentMessage = signal<SnackbarMessage | null>(null);
  private nextId = 0;
  private dismissTimer: ReturnType<typeof setTimeout> | undefined;

  readonly message = this.currentMessage.asReadonly();

  show(text: string, options: { actionLabel?: string; action?: () => void } = {}): void {
    clearTimeout(this.dismissTimer);
    this.currentMessage.set({ id: this.nextId++, text, ...options });
    this.dismissTimer = setTimeout(() => this.dismiss(), DEFAULT_DURATION_MS);
  }

  runAction(): void {
    const action = this.currentMessage()?.action;
    this.dismiss();
    action?.();
  }

  dismiss(): void {
    clearTimeout(this.dismissTimer);
    this.currentMessage.set(null);
  }
}
