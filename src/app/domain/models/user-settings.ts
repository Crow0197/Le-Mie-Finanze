import type { Timestamp } from 'firebase/firestore';
import type { NavigationPreference } from '../navigation/navigation';

export const SCHEMA_VERSION = 1;

export type ViewPeriodPreset =
  | 'salaryCycle'
  | 'all'
  | 'currentMonth'
  | 'previousMonth'
  | 'last3Months'
  | 'currentYear'
  | 'custom';

export interface ViewPeriod {
  preset: ViewPeriodPreset;
  startDate?: string;
  endDate?: string;
}

export interface UserSettings {
  displayName: string;
  locale: 'it-IT';
  currency: 'EUR';
  timeZone: 'Europe/Rome';
  safetyBufferCents: number;
  weekStartsOn: 1;
  onboardingCompleted: boolean;
  defaultAccountId?: string | null;
  viewPeriod: ViewPeriod;
  /** Order and visibility of the sections in the menu; empty means the default order. */
  navigation?: NavigationPreference[];
  schemaVersion: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const VIEW_PERIOD_LABELS: Record<ViewPeriodPreset, string> = {
  salaryCycle: 'Tra due stipendi',
  currentMonth: 'Mese corrente',
  previousMonth: 'Mese scorso',
  last3Months: 'Ultimi 3 mesi',
  currentYear: 'Anno corrente',
  custom: 'Date scelte da me',
  all: 'Tutto',
};
