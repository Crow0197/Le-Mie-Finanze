import { Injectable, inject } from '@angular/core';
import { TransactionActions } from '../../../core/state/transaction-actions.service';
import { QuickTemplate } from '../../../domain/models/quick-template';
import { Transaction, TransactionType } from '../../../domain/models/transaction';
import { AppDialogService } from '../../../shared/ui/dialog/app-dialog.service';
import { TransactionForm, TransactionFormData, TransactionFormResult } from './transaction-form';

@Injectable({ providedIn: 'root' })
export class TransactionFormService {
  private readonly appDialog = inject(AppDialogService);
  private readonly transactionActions = inject(TransactionActions);

  openNew(type: TransactionType, template?: QuickTemplate): Promise<TransactionFormResult | undefined> {
    return this.open({ type, template });
  }

  openEdit(transaction: Transaction): Promise<TransactionFormResult | undefined> {
    return this.open({ type: transaction.type, transaction });
  }

  private async open(data: TransactionFormData): Promise<TransactionFormResult | undefined> {
    const dialogRef = this.appDialog.open<TransactionFormResult, TransactionFormData, TransactionForm>(
      TransactionForm,
      data,
      'transaction-form-title',
    );
    const result = await new Promise<TransactionFormResult | undefined>((resolve) =>
      dialogRef.closed.subscribe((value) => resolve(value)),
    );
    if (result === 'deleted' && data.transaction) {
      await this.transactionActions.remove(data.transaction);
    }
    if (result === 'duplicate' && data.transaction) {
      return this.open({ type: data.transaction.type, duplicateOf: data.transaction });
    }
    return result;
  }
}
