import { Pipe, PipeTransform } from '@angular/core';
import { formatSignedCents } from '../../domain/money/money';
import { TransactionType } from '../../domain/models/transaction';

/** Incomes get a plus sign, expenses a minus sign, transfers no sign. */
@Pipe({ name: 'transactionAmount' })
export class TransactionAmountPipe implements PipeTransform {
  transform(cents: number, type: TransactionType): string {
    return formatSignedCents(cents, type === 'income' ? 'positive' : type === 'expense' ? 'negative' : 'none');
  }
}
