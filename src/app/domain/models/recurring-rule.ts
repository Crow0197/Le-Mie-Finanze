import type { Timestamp } from 'firebase/firestore';

export type RecurrenceStatus = 'active' | 'paused' | 'completed';
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'customMonths' | 'yearly';

export interface RecurringRule {
  id: string;
  name: string;
  kind?: 'salary' | 'standard';
  transactionType: 'expense' | 'income';
  amountCents: number;
  accountId: string;
  categoryId: string;
  description: string;
  notes?: string;
  frequency: RecurrenceFrequency;
  interval: number;
  /** Day of the month (1-31) for monthly, customMonths and yearly rules. */
  dayOfMonth?: number;
  /** Day of the week for weekly rules, as returned by Date.getDay() (0 = Sunday). */
  dayOfWeek?: number;
  startDate: string;
  endDate?: string;
  nextOccurrenceDate: string;
  autoPost: boolean;
  status: RecurrenceStatus;
  /** Set when the rule was paused automatically because its account was archived. */
  pausedReason?: 'accountArchived' | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RecurringRuleDraft = Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt'>;

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Settimanale',
  monthly: 'Mensile',
  customMonths: 'Ogni N mesi',
  yearly: 'Annuale',
};
