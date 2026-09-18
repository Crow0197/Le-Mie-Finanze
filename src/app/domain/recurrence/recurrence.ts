import { addDays, addMonths, getDay, getDaysInMonth, parseISO } from 'date-fns';
import { toLocalDate } from '../dates/local-date';
import { RecurringRule } from '../models/recurring-rule';

export type RecurrenceSchedule = Pick<
  RecurringRule,
  'frequency' | 'interval' | 'dayOfMonth' | 'dayOfWeek' | 'startDate' | 'endDate'
>;

const MAX_OCCURRENCES = 2000;

/**
 * Returns the occurrences between from and to (both inclusive).
 * When the configured day does not exist in a month, the last valid day of that month is used.
 */
export function listOccurrences(schedule: RecurrenceSchedule, from: string, to: string): string[] {
  const lowerBound = from > schedule.startDate ? from : schedule.startDate;
  const upperBound = schedule.endDate && schedule.endDate < to ? schedule.endDate : to;
  if (lowerBound > upperBound) {
    return [];
  }

  const occurrences: string[] = [];
  for (let index = 0; index < MAX_OCCURRENCES; index++) {
    const occurrence = occurrenceAt(schedule, index);
    if (occurrence > upperBound) {
      break;
    }
    if (occurrence >= lowerBound) {
      occurrences.push(occurrence);
    }
  }
  return occurrences;
}

/** First occurrence on or after the given date, or null when the rule has ended. */
export function nextOccurrenceOnOrAfter(schedule: RecurrenceSchedule, date: string): string | null {
  const from = date > schedule.startDate ? date : schedule.startDate;
  for (let index = 0; index < MAX_OCCURRENCES; index++) {
    const occurrence = occurrenceAt(schedule, index);
    if (schedule.endDate && occurrence > schedule.endDate) {
      return null;
    }
    if (occurrence >= from) {
      return occurrence;
    }
  }
  return null;
}

export function buildOccurrenceKey(ruleId: string, date: string): string {
  return `${ruleId}_${date.replace(/-/g, '')}`;
}

function occurrenceAt(schedule: RecurrenceSchedule, index: number): string {
  const start = parseISO(schedule.startDate);
  const interval = Math.max(1, schedule.interval);

  if (schedule.frequency === 'weekly') {
    const dayOfWeek = schedule.dayOfWeek ?? getDay(start);
    const offset = (dayOfWeek - getDay(start) + 7) % 7;
    return toLocalDate(addDays(start, offset + index * 7 * interval));
  }

  const monthsPerStep = schedule.frequency === 'yearly' ? 12 * interval : interval;
  const day = schedule.dayOfMonth ?? start.getDate();
  const firstInStartMonth = clampedDay(start.getFullYear(), start.getMonth(), day);
  // Skip the start month when the configured day falls before the start date.
  const skip = firstInStartMonth < start ? 1 : 0;
  const month = addMonths(new Date(start.getFullYear(), start.getMonth(), 1), (index + skip) * monthsPerStep);
  return toLocalDate(clampedDay(month.getFullYear(), month.getMonth(), day));
}

function clampedDay(year: number, monthIndex: number, day: number): Date {
  const daysInMonth = getDaysInMonth(new Date(year, monthIndex, 1));
  return new Date(year, monthIndex, Math.min(day, daysInMonth));
}
