import { Component, inject, signal } from '@angular/core';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { TransactionActions } from '../../core/state/transaction-actions.service';
import { UserDataStore } from '../../core/state/user-data.store';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { BackupRepository } from '../../data-access/repositories/backup.repository';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { recalculateBalances } from '../../domain/balance-effects/balance-effects';
import { BACKUP_COLLECTIONS, BackupFile, validateBackup } from '../../domain/data-transfer/backup';
import { buildTransactionsCsv } from '../../domain/data-transfer/transactions-csv';
import { todayInTimeZone } from '../../domain/dates/local-date';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { AppDialogService } from '../../shared/ui/dialog/app-dialog.service';
import { Icon } from '../../shared/ui/icon/icon';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';

const COLLECTION_LABELS: Record<(typeof BACKUP_COLLECTIONS)[number], string> = {
  accounts: 'Conti',
  categories: 'Categorie',
  transactions: 'Movimenti',
  recurringRules: 'Ricorrenze',
  quickTemplates: 'Modelli rapidi',
  savingsGoals: 'Obiettivi',
  budgets: 'Budget',
};

interface BalanceDifference {
  accountId: string;
  name: string;
  currentCents: number;
  expectedCents: number;
}

@Component({
  selector: 'app-data-section',
  imports: [Icon, MoneyPipe],
  template: `
    <section class="card section" aria-labelledby="data-title">
      <h2 id="data-title">Backup e manutenzione</h2>
      <p class="muted">
        I backup restano sul tuo dispositivo: nessun servizio esterno. Esegui un export JSON ogni tanto come copia di sicurezza.
      </p>

      <div class="toolbar">
        <button type="button" class="button button--secondary" [disabled]="busy()" (click)="exportJson()">
          <app-icon name="download" [size]="18" />
          Export completo JSON
        </button>
        <button type="button" class="button button--secondary" [disabled]="busy()" (click)="exportCsv()">
          <app-icon name="download" [size]="18" />
          Export movimenti CSV
        </button>
        <label class="button button--secondary import-button">
          <app-icon name="upload" [size]="18" />
          Importa JSON
          <input type="file" accept="application/json,.json" class="visually-hidden" (change)="selectBackup($event)" />
        </label>
      </div>

      @if (importErrors().length > 0) {
        <div class="alert alert--danger" role="alert">
          <app-icon name="circle-alert" />
          <ul class="import-errors">
            @for (error of importErrors(); track $index) {
              <li>{{ error }}</li>
            }
          </ul>
        </div>
      }

      @if (pendingBackup(); as backup) {
        <div class="alert alert--warning import-preview" role="status">
          <app-icon name="triangle-alert" />
          <div>
            <p><strong>Anteprima importazione</strong> (esportato il {{ backup.exportedAt.slice(0, 10) }})</p>
            <ul class="import-errors">
              @for (row of preview(); track row.label) {
                <li>{{ row.label }}: {{ row.count }}</li>
              }
            </ul>
            <p>I documenti con lo stesso identificativo verranno sovrascritti. Dopo l'importazione conviene ricalcolare i saldi.</p>
            <div class="toolbar">
              <button type="button" class="button button--primary button--small" [disabled]="busy()" (click)="confirmImport()">Importa</button>
              <button type="button" class="button button--ghost button--small" (click)="pendingBackup.set(null)">Annulla</button>
            </div>
          </div>
        </div>
      }

      <div class="section">
        <h3 class="muted">Ricalcola saldi</h3>
        <p class="muted">Ricostruisce ogni saldo dal saldo iniziale e dai movimenti confermati, per verificare e riparare eventuali differenze.</p>
        <div class="toolbar">
          <button type="button" class="button button--secondary" [disabled]="busy()" (click)="checkBalances()">
            <app-icon name="refresh-cw" [size]="18" />
            Verifica saldi
          </button>
        </div>
        @if (differences(); as items) {
          @if (items.length === 0) {
            <p class="alert alert--success" role="status"><app-icon name="circle-check" /> Tutti i saldi sono corretti.</p>
          } @else {
            <div class="alert alert--warning" role="status">
              <app-icon name="triangle-alert" />
              <div>
                <ul class="import-errors">
                  @for (item of items; track item.accountId) {
                    <li>{{ item.name }}: {{ item.currentCents | money }} → {{ item.expectedCents | money }}</li>
                  }
                </ul>
                <button type="button" class="button button--primary button--small" [disabled]="busy()" (click)="applyBalances(items)">
                  Correggi saldi
                </button>
              </div>
            </div>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .import-button {
      position: relative;
      cursor: pointer;

      &:focus-within {
        outline: 3px solid var(--color-focus);
        outline-offset: 2px;
      }
    }

    .import-errors {
      margin: var(--space-1) 0;
      padding-left: var(--space-4);
    }

    .import-preview > div {
      display: grid;
      gap: var(--space-2);
    }

    h3 {
      margin: 0;
      font-size: var(--font-size-md);
    }
  `,
})
export class DataSection {
  private readonly store = inject(UserDataStore);
  private readonly backupRepository = inject(BackupRepository);
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly accountRepository = inject(AccountRepository);
  private readonly transactionActions = inject(TransactionActions);
  private readonly appDialog = inject(AppDialogService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly busy = signal(false);
  protected readonly importErrors = signal<string[]>([]);
  protected readonly pendingBackup = signal<BackupFile | null>(null);
  protected readonly differences = signal<BalanceDifference[] | null>(null);

  protected preview(): { label: string; count: number }[] {
    const backup = this.pendingBackup();
    return backup
      ? BACKUP_COLLECTIONS.map((name) => ({ label: COLLECTION_LABELS[name], count: backup.collections[name].length }))
      : [];
  }

  protected async exportJson(): Promise<void> {
    await this.run(async () => {
      const backup = await this.backupRepository.export(this.store.uid);
      download(`le-mie-finanze-backup-${todayInTimeZone()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    });
  }

  protected async exportCsv(): Promise<void> {
    await this.run(async () => {
      const transactions = (await this.transactionRepository.listAll(this.store.uid)).sort((a, b) =>
        b.effectiveDate.localeCompare(a.effectiveDate),
      );
      const csv = buildTransactionsCsv(transactions, this.store.accounts(), this.store.categories());
      download(`le-mie-finanze-movimenti-${todayInTimeZone()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
    });
  }

  protected async selectBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.importErrors.set([]);
    this.pendingBackup.set(null);
    if (!file) {
      return;
    }
    try {
      const result = validateBackup(JSON.parse(await file.text()));
      this.importErrors.set(result.errors.slice(0, 10));
      this.pendingBackup.set(result.backup);
    } catch {
      this.importErrors.set(['Il file non è un JSON valido.']);
    }
  }

  protected confirmImport(): void {
    const backup = this.pendingBackup();
    if (!backup) {
      return;
    }
    const data: ConfirmDialogData = {
      title: 'Confermi l\'importazione?',
      message: 'I dati del backup verranno scritti nel tuo account. L\'operazione non si può annullare.',
      confirmLabel: 'Importa',
      danger: true,
    };
    this.appDialog.open<boolean>(ConfirmDialog, data, 'confirm-dialog-title').closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.run(async () => {
          await this.backupRepository.import(this.store.uid, backup);
          this.pendingBackup.set(null);
          await this.store.refresh();
          this.transactionActions.notifyChange(null);
          this.snackbar.show('Importazione completata.');
        });
      }
    });
  }

  protected async checkBalances(): Promise<void> {
    await this.run(async () => {
      const transactions = await this.transactionRepository.listAll(this.store.uid);
      const expected = recalculateBalances(this.store.accounts(), transactions);
      this.differences.set(
        this.store
          .accounts()
          .filter((account) => expected[account.id] !== account.currentBalanceCents)
          .map((account) => ({
            accountId: account.id,
            name: account.name,
            currentCents: account.currentBalanceCents,
            expectedCents: expected[account.id],
          })),
      );
    });
  }

  protected async applyBalances(items: BalanceDifference[]): Promise<void> {
    await this.run(async () => {
      const balances = Object.fromEntries(items.map((item) => [item.accountId, item.expectedCents]));
      await this.accountRepository.setBalances(this.store.uid, balances);
      this.store.setBalances(balances);
      this.differences.set([]);
      this.snackbar.show('Saldi corretti.');
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

function download(fileName: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
