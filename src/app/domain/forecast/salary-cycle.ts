import { DateRange, addDaysToLocalDate, addMonthsToLocalDate } from '../dates/local-date';
import { RecurringRule } from '../models/recurring-rule';
import { listOccurrences } from '../recurrence/recurrence';

/** How far the salary is looked for: enough for monthly, four weekly and similar schedules. */
const LOOKBACK_DAYS = 70;

/**
 * The period between the salary already received and the next one: from the last salary day
 * to the day before the next. Returns null when there is no active salary rule.
 */
export function resolveSalaryCycleRange(rules: readonly RecurringRule[], today: string): DateRange | null {
  const salaryRules = rules.filter((rule) => rule.kind === 'salary' && rule.status === 'active');
  if (salaryRules.length === 0) {
    return null;
  }
  const previous: string[] = [];
  const next: string[] = [];
  for (const rule of salaryRules) {
    previous.push(...listOccurrences(rule, addDaysToLocalDate(today, -LOOKBACK_DAYS), today));
    const [upcoming] = listOccurrences(rule, addDaysToLocalDate(today, 1), addDaysToLocalDate(today, LOOKBACK_DAYS));
    if (upcoming) {
      next.push(upcoming);
    }
  }
  if (next.length === 0) {
    return null;
  }
  const nextDate = next.sort()[0];
  // With a rule created after the last payday that occurrence does not exist: step back one period instead.
  const fallbackStart = salaryRules
    .map((rule) => previousCycleStart(rule, nextDate))
    .sort()
    .at(-1)!;
  const lastOccurrence = previous.sort().at(-1);
  const startDate = lastOccurrence && lastOccurrence > fallbackStart ? lastOccurrence : fallbackStart;
  return { startDate: startDate > today ? today : startDate, endDate: addDaysToLocalDate(nextDate, -1) };
}

/** One period before the given date, following the rule frequency. */
function previousCycleStart(rule: RecurringRule, nextDate: string): string {
  switch (rule.frequency) {
    case 'weekly':
      return addDaysToLocalDate(nextDate, -7);
    case 'yearly':
      return addMonthsToLocalDate(nextDate, -12);
    case 'customMonths':
      return addMonthsToLocalDate(nextDate, -Math.max(1, rule.interval));
    default:
      return addMonthsToLocalDate(nextDate, -1);
  }
}
