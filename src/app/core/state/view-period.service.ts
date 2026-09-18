import { Injectable, computed, inject } from '@angular/core';
import { DateRange, formatLocalDate, resolveViewPeriod, todayInTimeZone } from '../../domain/dates/local-date';
import { resolveSalaryCycleRange } from '../../domain/forecast/salary-cycle';
import { VIEW_PERIOD_LABELS, ViewPeriod } from '../../domain/models/user-settings';
import { UserDataStore } from './user-data.store';

/** The display period chosen on the summary or in "Altro", applied to transaction lists and period totals. */
@Injectable({ providedIn: 'root' })
export class ViewPeriodService {
  private readonly store = inject(UserDataStore);

  readonly period = computed<ViewPeriod>(() => this.store.settings()?.viewPeriod ?? { preset: 'salaryCycle' });

  readonly range = computed<DateRange>(() => {
    const today = todayInTimeZone();
    if (this.period().preset === 'salaryCycle') {
      // Without an active salary there is no cycle: the current month is the closest thing.
      return resolveSalaryCycleRange(this.store.rules(), today) ?? resolveViewPeriod({ preset: 'currentMonth' }, today);
    }
    return resolveViewPeriod(this.period(), today);
  });

  readonly isAll = computed(() => this.period().preset === 'all');

  readonly label = computed(() => {
    const preset = this.period().preset;
    if (preset === 'all') {
      return VIEW_PERIOD_LABELS.all;
    }
    const { startDate, endDate } = this.range();
    const dates = `${startDate ? formatLocalDate(startDate) : '…'} – ${endDate ? formatLocalDate(endDate) : '…'}`;
    return preset === 'custom' ? dates : `${VIEW_PERIOD_LABELS[preset]} · ${dates}`;
  });

  async update(period: ViewPeriod): Promise<void> {
    await this.store.updateSettings({ viewPeriod: period });
  }
}
