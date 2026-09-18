import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { TransactionActions } from '../../core/state/transaction-actions.service';
import { UserDataStore } from '../../core/state/user-data.store';
import { ViewPeriodService } from '../../core/state/view-period.service';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import {
  addDaysToLocalDate,
  endOfMonthDate,
  formatLocalDate,
  startOfMonthDate,
  todayInTimeZone,
} from '../../domain/dates/local-date';
import { buildVirtualOccurrences } from '../../domain/forecast/forecast';
import { formatCents } from '../../domain/money/money';
import { Transaction } from '../../domain/models/transaction';
import {
  ReportCategoryTotal,
  ReportGranularity,
  ReportLevel,
  ReportPeriod,
  buildReport,
} from '../../domain/reports/reports';
import { FEES_CATEGORY_ID } from '../../domain/seed/default-data';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon } from '../../shared/ui/icon/icon';
import { InfoHint } from '../../shared/ui/info-hint/info-hint';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { withTimeout } from '../../shared/utils/with-timeout';
import { DonutChart, DonutItem, buildDonutSlices } from './donut-chart';

const CHART_HEIGHT = 220;
const AXIS_WIDTH = 72;
const LABEL_HEIGHT = 28;
const MIN_GROUP_WIDTH = 56;
const BAR_GAP = 2;
/** How far ahead virtual (not yet stored) recurring occurrences are projected when no "Al" date is set. */
const FORECAST_HORIZON_DAYS = 60;
/** Categorical slots validated with the dataviz palette validator (light surface, adjacent pairs). */
const MACRO_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const OTHER_COLOR = '#8b8a85';
const MAX_MACRO_SLICES = MACRO_COLORS.length;

/** Shape accepted by buildReport: either a real transaction or a forecast entry treated the same way. */
type ReportableEntry = Pick<Transaction, 'type' | 'status' | 'amountCents' | 'feeCents' | 'categoryId' | 'effectiveDate'> & {
  deletedAt?: unknown;
};

@Component({
  selector: 'app-reports-page',
  imports: [FormsModule, LocalDatePipe, MoneyPipe, EmptyState, Icon, InfoHint, Skeleton, DonutChart],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
})
export class ReportsPage {
  protected readonly store = inject(UserDataStore);
  private readonly viewPeriod = inject(ViewPeriodService);
  private readonly repository = inject(TransactionRepository);
  private readonly transactionActions = inject(TransactionActions);

  protected readonly granularities: { value: ReportGranularity; label: string }[] = [
    { value: 'day', label: 'Giorni' },
    { value: 'month', label: 'Mesi' },
    { value: 'year', label: 'Anni' },
    { value: 'all', label: 'Tutto' },
  ];

  protected readonly granularity = signal<ReportGranularity>('month');
  protected readonly level = signal<ReportLevel>('macro');
  protected readonly kind = signal<'expense' | 'income'>('expense');
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly activePeriodKey = signal<string | null>(null);
  /** When on, planned operations and forecasted recurring occurrences are counted alongside confirmed movements. */
  protected readonly includeForecast = signal(true);
  private readonly transactions = signal<Transaction[]>([]);
  private readonly chartHost = viewChild<ElementRef<HTMLElement>>('chartHost');
  private readonly chartAvailableWidth = signal(640);

  /** Confirmed movements plus, when includeForecast is on, planned ones and forecasted recurring occurrences. */
  protected readonly reportableEntries = computed<ReportableEntry[]>(() => {
    const items = this.transactions();
    if (!this.includeForecast()) {
      return items;
    }
    const today = todayInTimeZone();
    const asConfirmed = items.map((item) => (item.status === 'planned' ? { ...item, status: 'confirmed' as const } : item));
    const lowerBound = this.startDate() || today;
    const virtualStart = lowerBound > today ? lowerBound : today;
    const virtualEnd = this.endDate() || addDaysToLocalDate(today, FORECAST_HORIZON_DAYS);
    if (virtualStart > virtualEnd) {
      return asConfirmed;
    }
    const storedKeys = new Set(items.map((item) => item.occurrenceKey).filter((key): key is string => !!key));
    const virtual = buildVirtualOccurrences(this.store.rules(), virtualStart, virtualEnd, storedKeys);
    return [
      ...asConfirmed,
      ...virtual.map((entry) => ({
        type: entry.type,
        status: 'confirmed' as const,
        amountCents: entry.amountCents,
        feeCents: entry.feeCents,
        categoryId: entry.categoryId,
        effectiveDate: entry.date,
        deletedAt: null,
      })),
    ];
  });

  protected readonly report = computed(() =>
    buildReport(this.reportableEntries(), this.store.categories(), this.granularity(), this.level(), FEES_CATEGORY_ID),
  );

  /** Always grouped by macro category, independently from the "Macro / Dettaglio" switch. */
  private readonly macroReport = computed(() =>
    buildReport(this.reportableEntries(), this.store.categories(), 'all', 'macro', FEES_CATEGORY_ID),
  );

  protected readonly counts = computed(() => {
    let income = 0;
    let expense = 0;
    for (const entry of this.reportableEntries()) {
      if (entry.status !== 'confirmed' || entry.deletedAt) {
        continue;
      }
      if (entry.type === 'income') {
        income++;
      } else if (entry.type === 'expense') {
        expense++;
      }
    }
    return { income, expense };
  });

  /** Share of the income left after expenses; null when there is no income to compare with. */
  protected readonly savingsRate = computed(() => {
    const { incomeCents, netCents } = this.report();
    return incomeCents > 0 ? Math.round((netCents / incomeCents) * 100) : null;
  });

  /** Average expense per period of the chosen grouping (only meaningful with more than one period). */
  protected readonly averageExpenseCents = computed(() => {
    const periods = this.report().periods;
    return periods.length > 1 ? Math.round(this.report().expenseCents / periods.length) : null;
  });

  protected readonly incomeExpenseSlices = computed(() =>
    buildDonutSlices([
      { key: 'income', name: 'Entrate', color: 'var(--chart-income)', amountCents: this.report().incomeCents },
      { key: 'expense', name: 'Spese', color: 'var(--chart-expense)', amountCents: this.report().expenseCents },
    ]),
  );

  protected readonly expenseMacroSlices = computed(() => buildDonutSlices(toMacroItems(this.macroReport().expenseByCategory)));
  protected readonly incomeMacroSlices = computed(() => buildDonutSlices(toMacroItems(this.macroReport().incomeByCategory)));

  protected readonly categoryTotals = computed(() => {
    const report = this.report();
    const items = this.kind() === 'expense' ? report.expenseByCategory : report.incomeByCategory;
    const total = this.kind() === 'expense' ? report.expenseCents : report.incomeCents;
    const max = Math.max(1, ...items.map((item) => item.amountCents));
    return items.map((item) => ({
      ...item,
      share: total > 0 ? Math.round((item.amountCents / total) * 100) : 0,
      width: Math.max(1, Math.round((item.amountCents / max) * 100)),
    }));
  });

  /** Grouped columns that stretch to the card width; with many periods they keep a minimum width and scroll. */
  protected readonly chart = computed(() => {
    const periods = this.report().periods;
    const plotWidth = Math.max(this.chartAvailableWidth() - AXIS_WIDTH, MIN_GROUP_WIDTH);
    const groupWidth = Math.max(MIN_GROUP_WIDTH, Math.floor(plotWidth / Math.max(1, periods.length)));
    const barWidth = Math.min(36, Math.max(12, Math.floor(groupWidth * 0.22)));
    const max = Math.max(1, ...periods.flatMap((period) => [period.incomeCents, period.expenseCents]));
    const scale = (cents: number) => Math.max(cents > 0 ? 2 : 0, Math.round((cents / max) * CHART_HEIGHT));
    const width = AXIS_WIDTH + Math.max(plotWidth, groupWidth * periods.length);
    return {
      width,
      height: CHART_HEIGHT,
      totalHeight: CHART_HEIGHT + LABEL_HEIGHT,
      axisWidth: AXIS_WIDTH,
      maxLabel: formatCents(max),
      halfLabel: formatCents(Math.round(max / 2)),
      groups: periods.map((period, index) => {
        const left = AXIS_WIDTH + index * groupWidth;
        const x = left + (groupWidth - (barWidth * 2 + BAR_GAP)) / 2;
        const incomeHeight = scale(period.incomeCents);
        const expenseHeight = scale(period.expenseCents);
        return {
          period,
          label: this.periodLabel(period.key, true),
          left,
          groupWidth,
          center: left + groupWidth / 2,
          incomePath: barPath(x, CHART_HEIGHT, incomeHeight, barWidth),
          expensePath: barPath(x + barWidth + BAR_GAP, CHART_HEIGHT, expenseHeight, barWidth),
        };
      }),
    };
  });

  protected readonly granularityNoun = computed(() => {
    const nouns: Record<ReportGranularity, string> = { day: 'giorno', month: 'mese', year: 'anno', all: 'periodo' };
    return nouns[this.granularity()];
  });

  protected readonly activePeriod = computed(() =>
    this.report().periods.find((period) => period.key === this.activePeriodKey()) ?? null,
  );

  constructor() {
    effect(() => {
      // With the global period set to "Tutto" the report opens on the current month, the most useful default.
      const today = todayInTimeZone();
      const range = this.viewPeriod.isAll()
        ? { startDate: startOfMonthDate(today), endDate: endOfMonthDate(today) }
        : this.viewPeriod.range();
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
    effect((onCleanup) => {
      const host = this.chartHost()?.nativeElement;
      if (!host) {
        return;
      }
      const observer = new ResizeObserver(([entry]) => this.chartAvailableWidth.set(Math.floor(entry.contentRect.width)));
      observer.observe(host);
      onCleanup(() => observer.disconnect());
    });
  }

  protected periodLabel(key: string, short = false): string {
    switch (this.granularity()) {
      case 'day':
        return short ? key.slice(8, 10) + '/' + key.slice(5, 7) : formatLocalDate(key, 'long');
      case 'month':
        return short
          ? new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' }).format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1))
          : formatLocalDate(key, 'month');
      case 'year':
        return key;
      case 'all':
        return 'Totale';
    }
  }

  protected describePeriod(period: ReportPeriod): string {
    return `${this.periodLabel(period.key)}: entrate ${formatCents(period.incomeCents)}, spese ${formatCents(period.expenseCents)}, netto ${formatCents(period.netCents)}`;
  }

  protected async load(): Promise<void> {
    if (this.errorMessage()) {
      this.loading.set(true);
    }
    this.errorMessage.set(null);
    try {
      const items = await withTimeout(
        this.repository.listRange(this.store.uid, {
          startDate: this.startDate() || undefined,
          endDate: this.endDate() || undefined,
        }),
      );
      this.transactions.set(items);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}

/** Largest macro categories keep their own slice; the rest folds into "Altre" so the donut stays readable. */
function toMacroItems(totals: readonly ReportCategoryTotal[]): DonutItem[] {
  const needsFold = totals.length > MAX_MACRO_SLICES;
  const kept = needsFold ? totals.slice(0, MAX_MACRO_SLICES - 1) : totals;
  const items: DonutItem[] = kept.map((total, index) => ({
    key: total.categoryId,
    name: total.name,
    color: MACRO_COLORS[index],
    amountCents: total.amountCents,
  }));
  if (needsFold) {
    items.push({
      key: 'others',
      name: 'Altre',
      color: OTHER_COLOR,
      amountCents: totals.slice(MAX_MACRO_SLICES - 1).reduce((sum, total) => sum + total.amountCents, 0),
    });
  }
  return items;
}

/** Column with a 4px rounded top and a square base on the baseline. */
function barPath(x: number, baseline: number, height: number, width: number): string {
  if (height <= 0) {
    return '';
  }
  const radius = Math.min(4, height, width / 2);
  const top = baseline - height;
  return [
    `M${x},${baseline}`,
    `V${top + radius}`,
    `Q${x},${top} ${x + radius},${top}`,
    `H${x + width - radius}`,
    `Q${x + width},${top} ${x + width},${top + radius}`,
    `V${baseline}`,
    'Z',
  ].join(' ');
}
