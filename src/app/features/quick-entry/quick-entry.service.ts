import { Injectable, inject, signal } from '@angular/core';
import { AppDialogService } from '../../shared/ui/dialog/app-dialog.service';
import { TransactionFormService } from '../transactions/transaction-form/transaction-form.service';
import { QuickEntryChoice, QuickEntrySheet } from './quick-entry-sheet/quick-entry-sheet';

@Injectable({ providedIn: 'root' })
export class QuickEntryService {
  private readonly appDialog = inject(AppDialogService);
  private readonly transactionForm = inject(TransactionFormService);
  private readonly opened = signal(false);

  readonly isOpen = this.opened.asReadonly();

  async open(): Promise<void> {
    if (this.opened()) {
      return;
    }
    this.opened.set(true);
    try {
      const dialogRef = this.appDialog.open<QuickEntryChoice, unknown, QuickEntrySheet>(
        QuickEntrySheet,
        undefined,
        'quick-entry-title',
      );
      const choice = await new Promise<QuickEntryChoice | undefined>((resolve) =>
        dialogRef.closed.subscribe((value) => resolve(value)),
      );
      if (!choice) {
        return;
      }
      if ('template' in choice) {
        await this.transactionForm.openNew(choice.template.type, choice.template);
      } else {
        await this.transactionForm.openNew(choice.type);
      }
    } finally {
      this.opened.set(false);
    }
  }
}
