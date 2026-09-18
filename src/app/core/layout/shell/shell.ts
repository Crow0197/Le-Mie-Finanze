import { Dialog } from '@angular/cdk/dialog';
import { Component, DOCUMENT, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DefaultAccountDialog } from '../../../features/accounts/default-account-dialog';
import { QuickEntryService } from '../../../features/quick-entry/quick-entry.service';
import { AppDialogService } from '../../../shared/ui/dialog/app-dialog.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Snackbar } from '../../../shared/ui/snackbar/snackbar';
import { APP_INFO } from '../../app-info';
import { AuthService } from '../../auth/auth.service';
import { getFirebaseErrorMessage } from '../../error-handling/firebase-error-message';
import { NavigationService } from '../../state/navigation.service';
import { RecurrenceSyncService } from '../../state/recurrence-sync.service';
import { UserDataStore } from '../../state/user-data.store';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Snackbar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly store = inject(UserDataStore);
  private readonly recurrenceSync = inject(RecurrenceSyncService);
  private readonly appDialog = inject(AppDialogService);
  private readonly dialog = inject(Dialog);
  protected readonly quickEntry = inject(QuickEntryService);
  protected readonly navigation = inject(NavigationService);

  protected readonly appName = APP_INFO.name;
  protected readonly user = this.authService.user;
  protected readonly displayName = computed(
    () => this.store.settings()?.displayName || this.user()?.displayName || 'Profilo',
  );
  protected readonly loadError = signal<string | null>(null);
  private defaultAccountDialogOpen = false;

  constructor() {
    effect(() => {
      if (this.authService.isReady() && !this.user()) {
        this.dialog.closeAll();
        this.store.reset();
        void this.router.navigateByUrl('/accesso');
      }
    });

    effect(() => {
      const settings = this.store.settings();
      if (settings && !settings.onboardingCompleted) {
        void this.router.navigateByUrl('/benvenuto');
      }
    });

    effect(() => {
      if (this.store.needsDefaultAccount() && this.store.settings()?.onboardingCompleted) {
        this.openDefaultAccountDialog();
      }
    });

    void this.initialize();

    const document = inject(DOCUMENT);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && this.store.loaded()) {
        void this.recurrenceSync.sync().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVisibilityChange));
  }

  protected async initialize(): Promise<void> {
    this.loadError.set(null);
    try {
      await this.store.load();
      await this.recurrenceSync.sync();
    } catch (error) {
      this.loadError.set(getFirebaseErrorMessage(error));
    }
  }

  protected signOut(): void {
    void this.authService.signOut();
  }

  private openDefaultAccountDialog(): void {
    if (this.defaultAccountDialogOpen) {
      return;
    }
    this.defaultAccountDialogOpen = true;
    this.appDialog
      .open<boolean>(DefaultAccountDialog, undefined, 'default-account-title')
      .closed.subscribe(() => (this.defaultAccountDialogOpen = false));
  }
}
