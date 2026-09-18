import { addDays, addMonths, differenceInCalendarDays, getDaysInMonth, parseISO } from 'date-fns';
import { ViewPeriod } from '../models/user-settings';

export const APP_TIME_ZONE = 'Europe/Rome';

/** Today's date as YYYY-MM-DD in the given time zone, independent from the device time zone. */
export function todayInTimeZone(timeZone: string = APP_TIME_ZONE, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function toLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date {
  return parseISO(value);
}

export function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return toLocalDate(parseISO(value)) === value;
}

export function addDaysToLocalDate(value: string, days: number): string {
  return toLocalDate(addDays(parseISO(value), days));
}

export function addMonthsToLocalDate(value: string, months: number): string {
  return toLocalDate(addMonths(parseISO(value), months));
}

export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

export function monthOf(value: string): string {
  return value.slice(0, 7);
}

export function startOfMonthDate(value: string): string {
  return `${monthOf(value)}-01`;
}

export function endOfMonthDate(value: string): string {
  const days = getDaysInMonth(parseISO(startOfMonthDate(value)));
  return `${monthOf(value)}-${String(days).padStart(2, '0')}`;
}

export function previousMonth(month: string): string {
  return monthOf(addMonthsToLocalDate(`${month}-01`, -1));
}

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

/** The salary cycle needs the recurring rules, so it is resolved by ViewPeriodService, not here. */
export function resolveViewPeriod(period: ViewPeriod, today: string): DateRange {
  switch (period.preset) {
    case 'all':
    case 'salaryCycle':
      return {};
    case 'currentMonth':
      return { startDate: startOfMonthDate(today), endDate: endOfMonthDate(today) };
    case 'previousMonth': {
      const start = addMonthsToLocalDate(startOfMonthDate(today), -1);
      return { startDate: start, endDate: endOfMonthDate(start) };
    }
    case 'last3Months':
      return {
        startDate: addMonthsToLocalDate(startOfMonthDate(today), -2),
        endDate: endOfMonthDate(today),
      };
    case 'currentYear':
      return { startDate: `${today.slice(0, 4)}-01-01`, endDate: `${today.slice(0, 4)}-12-31` };
    case 'custom':
      return { startDate: period.startDate, endDate: period.endDate };
  }
}

export function isInRange(date: string, range: DateRange): boolean {
  return (!range.startDate || date >= range.startDate) && (!range.endDate || date <= range.endDate);
}

export function formatLocalDate(value: string, style: 'short' | 'long' | 'month' | 'year' = 'short'): string {
  const date = parseISO(value.length === 7 ? `${value}-01` : value.length === 4 ? `${value}-01-01` : value);
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'month'
        ? { month: 'long', year: 'numeric' }
        : style === 'year'
          ? { year: 'numeric' }
          : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('it-IT', options).format(date);
}
