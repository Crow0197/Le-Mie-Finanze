import { Injectable, computed, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Router } from '@angular/router';
import { BackupRepository } from '../../data-access/repositories/backup.repository';
import { AuthService } from '../auth/auth.service';
import { UserDataStore } from '../state/user-data.store';

/**
 * Hidden test mode: a temporary anonymous account starts from zero (first setup included) and is deleted,
 * together with all its data, when the test ends. The real account is never touched.
 */
@Injectable({ providedIn: 'root' })
export class TestModeService {
  private readonly authService = inject(AuthService);
  private readonly backupRepository = inject(BackupRepository);
  private readonly store = inject(UserDataStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly busyState = signal(false);

  readonly active = computed(() => this.authService.user()?.isAnonymous === true);
  readonly busy = this.busyState.asReadonly();

  async start(): Promise<void> {
    await this.run(async () => {
      if (!this.active()) {
        // Signing in replaces the current session only on success: if it fails, the real account stays signed in.
        await this.authService.signInAsGuest();
        this.store.reset();
      }
      await this.router.navigateByUrl('/benvenuto');
    });
  }

  async end(): Promise<void> {
    const user = this.authService.user();
    if (!user?.isAnonymous) {
      return;
    }
    await this.run(async () => {
      this.dialog.closeAll();
      await this.backupRepository.deleteAll(user.uid);
      await this.authService.deleteCurrentUser();
      this.store.reset();
      await this.router.navigateByUrl('/accesso');
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busyState()) {
      return;
    }
    this.busyState.set(true);
    try {
      await action();
    } finally {
      this.busyState.set(false);
    }
  }
}
