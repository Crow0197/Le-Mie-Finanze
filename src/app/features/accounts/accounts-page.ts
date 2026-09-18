import { Component, computed, inject, signal } from '@angular/core';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { calculateAvailableCents, calculateNetWorthCents } from '../../domain/forecast/balances';
import { ACCOUNT_TYPE_LABELS, Account } from '../../domain/models/account';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { AppDialogService } from '../../shared/ui/dialog/app-dialog.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon, toIconName } from '../../shared/ui/icon/icon';
import { InfoHint } from '../../shared/ui/info-hint/info-hint';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';
import { AccountFormDialog } from './account-form-dialog';
import { DefaultAccountDialog } from './default-account-dialog';

@Component({
  selector: 'app-accounts-page',
  imports: [MoneyPipe, EmptyState, Icon, InfoHint, Skeleton],
  templateUrl: './accounts-page.html',
})
export class AccountsPage {
  protected readonly store = inject(UserDataStore);
  private readonly appDialog = inject(AppDialogService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly toIconName = toIconName;
  protected readonly busy = signal(false);
  protected readonly showArchived = signal(false);
  protected readonly archivedAccounts = computed(() => this.store.accounts().filter((account) => account.archived));
  protected readonly netWorthCents = computed(() => calculateNetWorthCents(this.store.activeAccounts()));
  protected readonly availableCents = computed(() => calculateAvailableCents(this.store.activeAccounts()));

  protected openForm(account: Account | null = null): void {
    this.appDialog.open<boolean>(AccountFormDialog, account, 'account-form-title');
  }

  protected async setDefault(account: Account): Promise<void> {
    await this.run(async () => {
      await this.store.updateSettings({ defaultAccountId: account.id });
      this.snackbar.show(`${account.name} è ora il conto predefinito.`);
    });
  }

  protected async move(account: Account, direction: -1 | 1): Promise<void> {
    const ids = this.store.activeAccounts().map((item) => item.id);
    const index = ids.indexOf(account.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) {
      return;
    }
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const archivedIds = this.archivedAccounts().map((item) => item.id);
    await this.run(() => this.store.reorderAccounts([...ids, ...archivedIds]));
  }

  protected archive(account: Account): void {
    const wasDefault = this.store.defaultAccount()?.id === account.id;
    const rules = this.store.rules().filter((rule) => rule.accountId === account.id && rule.status === 'active');
    const data: ConfirmDialogData = {
      title: `Archiviare ${account.name}?`,
      message:
        'Il conto resta consultabile nei movimenti ma non sarà selezionabile per nuove operazioni.' +
        (rules.length > 0
          ? ` ${rules.length === 1 ? 'Una ricorrenza collegata verrà sospesa' : `${rules.length} ricorrenze collegate verranno sospese`} finché non scegli un nuovo conto.`
          : ''),
      confirmLabel: 'Archivia',
      danger: true,
    };
    this.appDialog.open<boolean>(ConfirmDialog, data, 'confirm-dialog-title').closed.subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }
      void this.run(async () => {
        const paused = await this.store.archiveAccount(account);
        this.snackbar.show(
          paused > 0 ? `Conto archiviato. Ricorrenze sospese: ${paused}.` : 'Conto archiviato.',
        );
        if (wasDefault && this.store.activeAccounts().length === 0) {
          this.appDialog.open<boolean>(DefaultAccountDialog, undefined, 'default-account-title');
        }
      });
    });
  }

  protected async restore(account: Account): Promise<void> {
    await this.run(async () => {
      await this.store.restoreAccount(account);
      this.snackbar.show('Conto ripristinato.');
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      this.snackbar.show(getFirebaseErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
