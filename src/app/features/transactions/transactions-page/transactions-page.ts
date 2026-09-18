import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { getFirebaseErrorMessage } from '../../../core/error-handling/firebase-error-message';
import { TransactionActions } from '../../../core/state/transaction-actions.service';
import { UserDataStore } from '../../../core/state/user-data.store';
import { ViewPeriodService } from '../../../core/state/view-period.service';
import { TransactionRepository } from '../../../data-access/repositories/transaction.repository';
import { calculateNetSavings } from '../../../domain/forecast/forecast';
import { TRANSACTION_TYPE_LABELS, Transaction, TransactionType } from '../../../domain/models/transaction';
import { LocalDatePipe } from '../../../shared/pipes/local-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { buildCategoryOptionGroups } from '../../../shared/ui/category-select/category-options';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../shared/ui/icon/icon';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { TransactionItem, TransactionListEntry } from '../../../shared/ui/transaction-item/transaction-item';
import { transactionToListEntry } from '../../../shared/ui/transaction-item/transaction-list-entry';
import { TransactionFormService } from '../transaction-form/transaction-form.service';

const PAGE_SIZE = 50;

interface DayGroup {
  date: string;
  items: { transaction: Transaction; entry: TransactionListEntry }[];
}

@Component({
  selector: 'app-transactions-page',
  imports: [FormsModule, LocalDatePipe, MoneyPipe, EmptyState, Icon, Skeleton, TransactionItem],
  templateUrl: './transactions-page.html',
  styleUrl: './transactions-page.scss',
})
export class TransactionsPage {
  protected readonly store = inject(UserDataStore);
  protected readonly viewPeriod = inject(ViewPeriodService);
  protected readonly transactionActions = inject(TransactionActions);
  private readonly repository = inject(TransactionRepository);
  private readonly transactionForm = inject(TransactionFormService);

  protected readonly typeLabels = TRANSACTION_TYPE_LABELS;
  protected readonly types: TransactionType[] = ['expense', 'income', 'transfer'];

  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly items = signal<Transaction[]>([]);
  private cursor: QueryDocumentSnapshot<Transaction> | null = null;
  protected readonly hasMore = signal(false);

  protected readonly search = signal('');
  protected readonly type = signal<TransactionType | ''>('');
  protected readonly accountId = signal('');
  protected readonly categoryId = signal('');
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');

  protected readonly hasFilters = computed(
    () => !!(this.search() || this.type() || this.accountId() || this.categoryId()),
  );

  protected readonly categoryGroups = computed(() => [
    ...buildCategoryOptionGroups(this.store.categories(), 'expense'),
    ...buildCategoryOptionGroups(this.store.categories(), 'income'),
  ]);

  protected readonly filtered = computed(() => {
    const search = this.search().trim().toLowerCase();
    const type = this.type();
    const accountId = this.accountId();
    const categoryId = this.categoryId();
    const categories = this.store.categories();
    const categoryIds = categoryId
      ? new Set([categoryId, ...categories.filter((c) => c.parentId === categoryId).map((c) => c.id)])
      : null;

    return this.items().filter((transaction) => {
      if (transaction.deletedAt) {
        return false;
      }
      if (type && transaction.type !== type) {
        return false;
      }
      if (
        accountId &&
        ![transaction.accountId, transaction.sourceAccountId, transaction.destinationAccountId].includes(accountId)
      ) {
        return false;
      }
      if (categoryIds && !categoryIds.has(transaction.categoryId ?? '')) {
        return false;
      }
      if (search) {
        const text = `${transaction.description} ${transaction.notes ?? ''}`.toLowerCase();
        if (!text.includes(search)) {
          return false;
        }
      }
      return true;
    });
  });

  protected readonly totals = computed(() =>
    calculateNetSavings(this.filtered().filter((transaction) => transaction.status === 'confirmed')),
  );

  protected readonly groups = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const transaction of this.filtered()) {
      let group = groups.at(-1);
      if (!group || group.date !== transaction.effectiveDate) {
        group = { date: transaction.effectiveDate, items: [] };
        groups.push(group);
      }
      group.items.push({ transaction, entry: transactionToListEntry(transaction) });
    }
    return groups;
  });

  constructor() {
    effect(() => {
      const range = this.viewPeriod.range();
      untracked(() => {
        this.startDate.set(range.startDate ?? '');
        this.endDate.set(range.endDate ?? '');
      });
    });
    effect(() => {
      this.transactionActions.version();
      this.startDate();
      this.endDate();
      if (this.store.loaded()) {
        untracked(() => void this.load());
      }
    });
  }

  protected async load(): Promise<void> {
    this.errorMessage.set(null);
    this.cursor = null;
    try {
      const page = await this.repository.listPage(this.store.uid, this.range(), null, PAGE_SIZE);
      this.items.set(page.items);
      this.cursor = page.cursor;
      this.hasMore.set(page.hasMore);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.cursor) {
      return;
    }
    this.loadingMore.set(true);
    try {
      const page = await this.repository.listPage(this.store.uid, this.range(), this.cursor, PAGE_SIZE);
      this.items.update((items) => [...items, ...page.items]);
      this.cursor = page.cursor;
      this.hasMore.set(page.hasMore);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected resetFilters(): void {
    this.search.set('');
    this.type.set('');
    this.accountId.set('');
    this.categoryId.set('');
    const range = this.viewPeriod.range();
    this.startDate.set(range.startDate ?? '');
    this.endDate.set(range.endDate ?? '');
  }

  protected open(transaction: Transaction): void {
    void this.transactionForm.openEdit(transaction);
  }

  private range() {
    return { startDate: this.startDate() || undefined, endDate: this.endDate() || undefined };
  }
}
