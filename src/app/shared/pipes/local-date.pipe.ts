import { Pipe, PipeTransform } from '@angular/core';
import { formatLocalDate } from '../../domain/dates/local-date';

@Pipe({ name: 'localDate' })
export class LocalDatePipe implements PipeTransform {
  transform(value: string | undefined | null, style: 'short' | 'long' | 'month' | 'year' = 'short'): string {
    return value ? formatLocalDate(value, style) : '';
  }
}
