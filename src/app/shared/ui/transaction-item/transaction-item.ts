import { Component, computed, inject, input } from '@angular/core';
import { UserDataStore } from '../../../core/state/user-data.store';
import { TransactionType } from '../../../domain/models/transaction';
import { LocalDatePipe } from '../../pipes/local-date.pipe';
import { TransactionAmountPipe } from '../../pipes/transaction-amount.pipe';
import { Icon, IconName, toIconName } from '../icon/icon';

export interface TransactionListEntry {
  type: TransactionType;
  amountCents: number;
  feeCents?: number;
  date: string;
  description: string;
  categoryId?: string;
  accountId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  planned: boolean;
  recurring: boolean;
  virtual?: boolean;
}

@Component({
  selector: 'app-transaction-item',
  imports: [Icon, LocalDatePipe, TransactionAmountPipe],
  template: `
    <span class="item-icon" [style.color]="color()">
      <app-icon [name]="icon()" />
    </span>
    <span class="list-item__main">
      <strong>{{ title() }}</strong>
      <span>
        @if (showDate()) {
          {{ entry().date | localDate }} ·
        }
        {{ subtitle() }}
      </span>
      @if (entry().planned || entry().recurring) {
        <span class="transaction-item__badges">
          @if (entry().planned) {
            <span class="badge badge--warning">{{ entry().virtual ? 'Prevista' : 'Pianificata' }}</span>
          }
          @if (entry().recurring) {
            <span class="badge"><app-icon name="repeat" [size]="12" /> Ricorrente</span>
          }
        </span>
      }
    </span>
    <span
      class="amount transaction-item__amount"
      [class.amount--positive]="entry().type === 'income'"
      [class.amount--negative]="entry().type === 'expense'"
    >
      {{ entry().amountCents | transactionAmount: entry().type }}
    </span>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
    }

    .transaction-item__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      margin-top: 2px;
    }

    .transaction-item__amount {
      font-weight: 700;
    }
  `,
})
export class TransactionItem {
  private readonly store = inject(UserDataStore);

  readonly entry = input.required<TransactionListEntry>();
  readonly showDate = input(true);

  private readonly category = computed(() => this.store.categoriesById().get(this.entry().categoryId ?? ''));

  protected readonly icon = computed<IconName>(() =>
    this.entry().type === 'transfer' ? 'arrow-left-right' : toIconName(this.category()?.icon, 'tag'),
  );
  protected readonly color = computed(() => this.category()?.color ?? 'var(--color-text-muted)');
  protected readonly title = computed(() => {
    const entry = this.entry();
    if (entry.description) {
      return entry.description;
    }
    return entry.type === 'transfer' ? 'Trasferimento' : (this.category()?.name ?? 'Operazione');
  });
  protected readonly subtitle = computed(() => {
    const entry = this.entry();
    const accounts = this.store.accountsById();
    if (entry.type === 'transfer') {
      const from = accounts.get(entry.sourceAccountId ?? '')?.name ?? '?';
      const to = accounts.get(entry.destinationAccountId ?? '')?.name ?? '?';
      return `${from} → ${to}` + (entry.feeCents ? ' · con commissione' : '');
    }
    const account = accounts.get(entry.accountId ?? '')?.name;
    return [this.category()?.name, account].filter(Boolean).join(' · ');
  });
}
