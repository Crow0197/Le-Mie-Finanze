import { addDaysToLocalDate, daysBetween } from '../dates/local-date';

/** A signed movement on a day: positive for income, negative for expenses. */
export interface SimulationEntry {
  date: string;
  amountCents: number;
  description: string;
}

export interface TimelinePoint {
  date: string;
  baseCents: number;
  scenarioCents: number;
}

export interface SimulationResult {
  points: TimelinePoint[];
  /** Balance at the end of the period without and with the scenario. */
  baseEndCents: number;
  scenarioEndCents: number;
  differenceCents: number;
  /** Lowest balance reached with the scenario, and the day it happens. */
  minCents: number;
  minDate: string;
  /** First day the balance goes below zero with the scenario, null when it never does. */
  firstNegativeDate: string | null;
  /** Average monthly effect of the scenario over the period. */
  monthlyImpactCents: number;
  /** Total of the scenario movements. */
  scenarioTotalCents: number;
}

/**
 * Day by day balance with and without the extra movements of the scenario.
 * Both lists are signed: an expense is a negative amount.
 */
export function simulate(
  startingCents: number,
  baseEntries: readonly SimulationEntry[],
  scenarioEntries: readonly SimulationEntry[],
  today: string,
  endDate: string,
): SimulationResult {
  const base = sumByDate(baseEntries, today, endDate);
  const scenario = sumByDate(scenarioEntries, today, endDate);
  const points: TimelinePoint[] = [];
  let baseCents = startingCents;
  let scenarioCents = startingCents;
  let minCents = startingCents;
  let minDate = today;
  let firstNegativeDate: string | null = null;

  const days = Math.max(0, daysBetween(today, endDate));
  for (let index = 0; index <= days; index++) {
    const date = addDaysToLocalDate(today, index);
    baseCents += base.get(date) ?? 0;
    scenarioCents += (base.get(date) ?? 0) + (scenario.get(date) ?? 0);
    if (scenarioCents < minCents) {
      minCents = scenarioCents;
      minDate = date;
    }
    if (firstNegativeDate === null && scenarioCents < 0) {
      firstNegativeDate = date;
    }
    points.push({ date, baseCents, scenarioCents });
  }

  const scenarioTotalCents = [...scenario.values()].reduce((total, amount) => total + amount, 0);
  const months = Math.max(1, days / 30);
  return {
    points,
    baseEndCents: baseCents,
    scenarioEndCents: scenarioCents,
    differenceCents: scenarioCents - baseCents,
    minCents,
    minDate,
    firstNegativeDate,
    monthlyImpactCents: Math.round(scenarioTotalCents / months),
    scenarioTotalCents,
  };
}

function sumByDate(entries: readonly SimulationEntry[], from: string, to: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) {
      continue;
    }
    totals.set(entry.date, (totals.get(entry.date) ?? 0) + entry.amountCents);
  }
  return totals;
}

/** Monthly occurrences of a day of the month inside the period, clamped to short months. */
export function monthlyDates(dayOfMonth: number, from: string, to: string, maxCount = 120): string[] {
  const dates: string[] = [];
  const days = Math.max(0, daysBetween(from, to));
  for (let index = 0; index <= days && dates.length < maxCount; index++) {
    const date = addDaysToLocalDate(from, index);
    const day = Number(date.slice(8, 10));
    const isLastDayOfMonth = addDaysToLocalDate(date, 1).slice(8, 10) === '01';
    if (day === dayOfMonth || (isLastDayOfMonth && day < dayOfMonth)) {
      dates.push(date);
    }
  }
  return dates;
}
