import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { UserDataStore } from '../../../core/state/user-data.store';
import { QuickTemplate } from '../../../domain/models/quick-template';
import { TransactionType } from '../../../domain/models/transaction';
import { Icon, IconName, toIconName } from '../../../shared/ui/icon/icon';

export type QuickEntryChoice = { type: TransactionType } | { template: QuickTemplate };

interface TypeChoice {
  type: TransactionType;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-quick-entry-sheet',
  imports: [Icon],
  templateUrl: './quick-entry-sheet.html',
  styleUrl: './quick-entry-sheet.scss',
})
export class QuickEntrySheet {
  protected readonly dialogRef = inject<DialogRef<QuickEntryChoice>>(DialogRef);
  private readonly store = inject(UserDataStore);

  protected readonly favorites = this.store.favoriteTemplates;
  protected readonly choices: readonly TypeChoice[] = [
    { type: 'expense', label: 'Spesa', icon: 'trending-down' },
    { type: 'income', label: 'Entrata', icon: 'trending-up' },
    { type: 'transfer', label: 'Trasferimento', icon: 'arrow-left-right' },
  ];

  protected templateIcon(template: QuickTemplate): IconName {
    return toIconName(this.store.categoriesById().get(template.categoryId ?? '')?.icon, 'tag');
  }
}
