import { Pipe, PipeTransform } from '@angular/core';
import { formatCents } from '../../domain/money/money';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(cents: number): string {
    return formatCents(cents);
  }
}
