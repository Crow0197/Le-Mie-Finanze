import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { TransactionActions } from '../../core/state/transaction-actions.service';
import { UserDataStore } from '../../core/state/user-data.store';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { addDaysToLocalDate, addMonthsToLocalDate, todayInTimeZone } from '../../domain/dates/local-date';
import { calculateNetWorthCents } from '../../domain/forecast/balances';
import { buildVirtualOccurrences, toForecastEntry } from '../../domain/forecast/forecast';
import { parseAmountToCents, parseSignedAmountToCents } from '../../domain/money/money';
import { Transaction } from '../../domain/models/transaction';
import { SimulationEntry, monthlyDates, simulate, toSimulationEntries } from '../../domain/simulation/simulation';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Icon } from '../../shared/ui/icon/icon';
import { InfoHint } from '../../shared/ui/info-hint/info-hint';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { withTimeout } from '../../shared/utils/with-timeout';

const CHART_HEIGHT = 200;
const AXIS_WIDTH = 72;
const LABEL_HEIGHT = 24;
/** Spending changes are spread day by day, so the line moves smoothly instead of jumping once a month. */
const DAYS_PER_MONTH = 30;

@Component({
  selector: 'app-simulation-page',
  imports: [FormsModule, LocalDatePipe, MoneyPipe, Icon, InfoHint, Skeleton],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.scss',
})
export class SimulationPage {
  protected readonly store = inject(UserDataStore);
  private readonly repository = inject(TransactionRepository);
  private readonly transactionActions = inject(TransactionActions);

  protected readonly today = todayInTimeZone();
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly planned = signal<Transaction[]>([]);
  private readonly chartHost = viewChild<ElementRef<HTMLElement>>('chartHost');
  private readonly chartAvailableWidth = signal(640);

  protected readonly horizons = [
    { months: 1, label: '1 mese' },
    { months: 3, label: '3 mesi' },
    { months: 6, label: '6 mesi' },
    { months: 12, label: '1 anno' },
  ];
  protected readonly horizonMonths = signal(3);

  protected readonly oneOffAmount = signal('');
  protected readonly oneOffDate = signal(addDaysToLocalDate(todayInTimeZone(), 7));
  protected readonly oneOffLabel = signal('Spesa imprevista');

  protected readonly instalmentAmount = signal('');
  protected readonly instalmentDay = signal(1);
  protected readonly instalmentMonths = signal(0);
  protected readonly instalmentLabel = signal('Nuova rata');

  protected readonly monthlyExtraAmount = signal('');
  protected readonly salaryChangeAmount = signal('');

  protected readonly endDate = computed(() => addMonthsToLocalDate(this.today, this.horizonMonths()));

  private readonly salaryRuleIds = computed(
    () => new Set(this.store.rules().filter((rule) => rule.kind === 'salary').map((rule) => rule.id)),
  );

  /** Everything already planned: stored operations and the next occurrences of the recurring rules. */
  private readonly baseEntries = computed<SimulationEntry[]>(() => {
    const end = this.endDate();
    const storedKeys = new Set(
      this.planned().map((transaction) => transaction.occurrenceKey).filter((key): key is string => !!key),
    );
    const stored = this.planned()
      .filter((transaction) => transaction.effectiveDate > this.today && transaction.effectiveDate <= end)
      .map((transaction) => toForecastEntry(transaction, this.salaryRuleIds()));
    const virtual = buildVirtualOccurrences(this.store.rules(), addDaysToLocalDate(this.today, 1), end, storedKeys);
    return toSimulationEntries([...stored, ...virtual]);
  });

  /** Dates of the salaries inside the period, used by the "salary change" scenario. */
  private readonly salaryDates = computed(() =>
    buildVirtualOccurrences(
      this.store.rules().filter((rule) => rule.kind === 'salary'),
      addDaysToLocalDate(this.today, 1),
      this.endDate(),
      new Set<string>(),
    ).map((entry) => entry.date),
  );

  protected readonly scenarioEntries = computed<SimulationEntry[]>(() => {
    const end = this.endDate();
    const entries: SimulationEntry[] = [];

    const oneOff = parseAmountToCents(this.oneOffAmount());
    if (oneOff && this.oneOffDate() >= this.today && this.oneOffDate() <= end) {
      entries.push({ date: this.oneOffDate(), amountCents: -oneOff, description: this.oneOffLabel() || 'Spesa imprevista' });
    }

    const instalment = parseAmountToCents(this.instalmentAmount());
    if (instalment) {
      const limit = this.instalmentMonths() > 0 ? this.instalmentMonths() : 120;
      for (const date of monthlyDates(this.instalmentDay(), this.today, end, limit)) {
        entries.push({ date, amountCents: -instalment, description: this.instalmentLabel() || 'Nuova rata' });
      }
    }

    const monthlyExtra = parseAmountToCents(this.monthlyExtraAmount());
    if (monthlyExtra) {
      const daily = Math.round(monthlyExtra / DAYS_PER_MONTH);
      for (let date = addDaysToLocalDate(this.today, 1); date <= end; date = addDaysToLocalDate(date, 1)) {
        entries.push({ date, amountCents: -daily, description: 'Spese di tutti i giorni' });
      }
    }

    const salaryChange = parseSignedAmountToCents(this.salaryChangeAmount());
    if (salaryChange) {
      for (const date of this.salaryDates()) {
        entries.push({ date, amountCents: salaryChange, description: 'Variazione stipendio' });
      }
    }
    return entries;
  });

  protected readonly hasScenario = computed(() => this.scenarioEntries().length > 0);

  protected readonly result = computed(() =>
    simulate(
      calculateNetWorthCents(this.store.activeAccounts()),
      this.baseEntries(),
      this.scenarioEntries(),
      this.today,
      this.endDate(),
    ),
  );

  /** Answers the main question of the page: do I run out of money in this period? */
  protected readonly risk = computed(() => {
    const result = this.result();
    const bufferCents = this.store.settings()?.safetyBufferCents ?? 0;
    const level = result.firstNegativeDate ? 'danger' : bufferCents > 0 && result.minCents < bufferCents ? 'warning' : 'ok';
    return {
      level,
      bufferCents,
      firstNegativeDate: result.firstNegativeDate,
      minCents: result.minCents,
      minDate: result.minDate,
      /** How much is missing at the worst moment: to stay above zero, or above the safety buffer. */
      missingCents: level === 'danger' ? -result.minCents : Math.max(0, bufferCents - result.minCents),
    };
  });

  /** The scenario movements grouped by description, to show what the simulation added. */
  protected readonly scenarioSummary = computed(() => {
    const totals = new Map<string, { description: string; count: number; amountCents: number }>();
    for (const entry of this.scenarioEntries()) {
      const current = totals.get(entry.description) ?? { description: entry.description, count: 0, amountCents: 0 };
      current.count++;
      current.amountCents += entry.amountCents;
      totals.set(entry.description, current);
    }
    return [...totals.values()].sort((a, b) => a.amountCents - b.amountCents);
  });

  protected readonly chart = computed(() => {
    const points = this.result().points;
    const width = Math.max(this.chartAvailableWidth(), AXIS_WIDTH + 120);
    const plotWidth = width - AXIS_WIDTH;
    const values = points.flatMap((point) => [point.baseCents, point.scenarioCents]);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const span = Math.max(1, max - min);
    const x = (index: number) => AXIS_WIDTH + (index / Math.max(1, points.length - 1)) * plotWidth;
    const y = (cents: number) => CHART_HEIGHT - ((cents - min) / span) * CHART_HEIGHT;
    const line = (pick: (index: number) => number) =>
      points.map((_, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(pick(index)).toFixed(1)}`).join(' ');
    return {
      width,
      height: CHART_HEIGHT,
      totalHeight: CHART_HEIGHT + LABEL_HEIGHT,
      axisWidth: AXIS_WIDTH,
      maxCents: max,
      minCents: min,
      zeroY: y(0),
      showZero: min < 0,
      basePath: line((index) => points[index].baseCents),
      scenarioPath: line((index) => points[index].scenarioCents),
      startLabel: points[0]?.date ?? this.today,
      endLabel: points.at(-1)?.date ?? this.endDate(),
    };
  });

  constructor() {
    effect(() => {
      this.transactionActions.version();
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

  protected reset(): void {
    this.oneOffAmount.set('');
    this.instalmentAmount.set('');
    this.monthlyExtraAmount.set('');
    this.salaryChangeAmount.set('');
  }

  protected async load(): Promise<void> {
    if (this.errorMessage()) {
      this.loading.set(true);
    }
    this.errorMessage.set(null);
    try {
      const planned = await withTimeout(this.repository.listPlanned(this.store.uid));
      this.planned.set(planned.filter((transaction) => !transaction.deletedAt));
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
