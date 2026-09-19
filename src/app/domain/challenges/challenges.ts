import { addDaysToLocalDate, daysBetween, monthOf, startOfMonthDate } from '../dates/local-date';

/** Movimento ridotto all'essenziale: alla sezione Sfide serve solo questo. */
export interface ChallengeTransaction {
  effectiveDate: string;
  amountCents: number;
  type: 'expense' | 'income' | 'transfer';
  categoryId?: string;
  description: string;
  /** Presente quando la spesa nasce da una ricorrenza: rate e abbonamenti non contano come "spese vive". */
  recurringRuleId?: string;
}

export interface Subscription {
  name: string;
  yearlyCents: number;
}

export interface ChallengeInput {
  today: string;
  /** Solo movimenti confermati e non eliminati, in ordine qualsiasi. */
  transactions: readonly ChallengeTransaction[];
  netWorthCents: number;
  subscriptions: readonly Subscription[];
  categoryNames: Readonly<Record<string, string>>;
  completedGoals: number;
}

export interface Streak {
  /** Giorni consecutivi senza spese vive, oggi compreso. */
  days: number;
  record: number;
}

export interface Duel {
  currentCents: number;
  previousCents: number;
  /** Differenza rispetto allo stesso giorno del mese scorso: negativa quando stai spendendo meno. */
  differenceCents: number;
}

export interface WeeklyChallenge {
  /** Spese vive degli ultimi sette giorni. */
  spentCents: number;
  /** Obiettivo: il 10% in meno della media delle quattro settimane precedenti. */
  targetCents: number;
  won: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  points: number;
  unlocked: boolean;
}

export interface ChallengeResult {
  streak: Streak;
  smallSpends: { countedCents: number; count: number };
  habit: { name: string; yearlyCents: number; count: number } | null;
  duel: Duel;
  wildest: { description: string; amountCents: number; date: string; categoryName: string } | null;
  worstDay: { date: string; amountCents: number } | null;
  runwayMonths: number | null;
  subscriptions: { items: Subscription[]; yearlyCents: number };
  weekly: WeeklyChallenge;
  achievements: Achievement[];
  points: number;
  level: { name: string; index: number; nextPoints: number | null };
}

/** Sotto questa cifra una spesa "non sembra niente". */
const SMALL_SPEND_MAX = 1000;
const WEEK_DAYS = 7;
/** L'obiettivo della settimana è il 10% in meno di quanto spendi di solito. */
const WEEKLY_TARGET_RATIO = 0.9;
const LEVELS = [
  { name: 'Principiante', points: 0 },
  { name: 'Attento', points: 100 },
  { name: 'Prudente', points: 250 },
  { name: 'Stratega', points: 500 },
  { name: 'Maestro', points: 1000 },
];

/** Spesa "viva": quella che decidi tu, senza rate, abbonamenti e trasferimenti. */
function isLiveExpense(transaction: ChallengeTransaction): boolean {
  return transaction.type === 'expense' && !transaction.recurringRuleId;
}

function sumBetween(transactions: readonly ChallengeTransaction[], from: string, to: string): number {
  return transactions
    .filter((transaction) => isLiveExpense(transaction) && transaction.effectiveDate >= from && transaction.effectiveDate <= to)
    .reduce((total, transaction) => total + transaction.amountCents, 0);
}

export function buildChallenges(input: ChallengeInput): ChallengeResult {
  const { today, transactions } = input;
  const live = transactions.filter(isLiveExpense);
  const spendDays = new Set(live.map((transaction) => transaction.effectiveDate));
  const firstDate = transactions.reduce(
    (earliest, transaction) => (transaction.effectiveDate < earliest ? transaction.effectiveDate : earliest),
    today,
  );

  const streak = buildStreak(spendDays, firstDate, today);
  const monthStart = startOfMonthDate(today);
  const monthLive = live.filter((transaction) => transaction.effectiveDate >= monthStart);

  const small = monthLive.filter((transaction) => transaction.amountCents < SMALL_SPEND_MAX);
  const smallSpends = {
    count: small.length,
    countedCents: small.reduce((total, transaction) => total + transaction.amountCents, 0),
  };

  const wildest = monthLive.reduce<ChallengeTransaction | null>(
    (worst, transaction) => (!worst || transaction.amountCents > worst.amountCents ? transaction : worst),
    null,
  );

  const byDay = new Map<string, number>();
  for (const transaction of monthLive) {
    byDay.set(transaction.effectiveDate, (byDay.get(transaction.effectiveDate) ?? 0) + transaction.amountCents);
  }
  const worstDay = [...byDay.entries()].reduce<{ date: string; amountCents: number } | null>(
    (worst, [date, amountCents]) => (!worst || amountCents > worst.amountCents ? { date, amountCents } : worst),
    null,
  );

  const subscriptionsTotal = input.subscriptions.reduce((total, item) => total + item.yearlyCents, 0);

  return {
    streak,
    smallSpends,
    habit: buildHabit(live, input.categoryNames, today),
    duel: buildDuel(live, today),
    wildest: wildest
      ? {
          description: wildest.description,
          amountCents: wildest.amountCents,
          date: wildest.effectiveDate,
          categoryName: (wildest.categoryId && input.categoryNames[wildest.categoryId]) || 'Senza categoria',
        }
      : null,
    worstDay,
    runwayMonths: buildRunway(transactions, input.netWorthCents, today),
    subscriptions: {
      items: [...input.subscriptions].sort((a, b) => b.yearlyCents - a.yearlyCents),
      yearlyCents: subscriptionsTotal,
    },
    weekly: buildWeekly(live, today),
    ...buildScore(input, streak, transactions),
  };
}

function buildStreak(spendDays: ReadonlySet<string>, firstDate: string, today: string): Streak {
  let days = 0;
  for (let date = today; date >= firstDate && !spendDays.has(date); date = addDaysToLocalDate(date, -1)) {
    days++;
  }
  let record = 0;
  let run = 0;
  const total = Math.max(0, daysBetween(firstDate, today));
  for (let index = 0; index <= total; index++) {
    const date = addDaysToLocalDate(firstDate, index);
    run = spendDays.has(date) ? 0 : run + 1;
    record = Math.max(record, run);
  }
  return { days, record: Math.max(record, days) };
}

function buildHabit(
  live: readonly ChallengeTransaction[],
  categoryNames: Readonly<Record<string, string>>,
  today: string,
): ChallengeResult['habit'] {
  const from = addDaysToLocalDate(today, -90);
  const recent = live.filter((transaction) => transaction.effectiveDate >= from);
  const byCategory = new Map<string, { count: number; amountCents: number }>();
  for (const transaction of recent) {
    const key = transaction.categoryId ?? 'uncategorized';
    const current = byCategory.get(key) ?? { count: 0, amountCents: 0 };
    current.count++;
    current.amountCents += transaction.amountCents;
    byCategory.set(key, current);
  }
  const top = [...byCategory.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (!top || top[1].count < 3) {
    return null;
  }
  return {
    name: categoryNames[top[0]] ?? 'Senza categoria',
    count: top[1].count,
    yearlyCents: Math.round((top[1].amountCents / 3) * 12),
  };
}

function buildDuel(live: readonly ChallengeTransaction[], today: string): Duel {
  const monthStart = startOfMonthDate(today);
  const dayOfMonth = Number(today.slice(8, 10));
  const previousMonthEnd = addDaysToLocalDate(monthStart, -1);
  const previousMonthStart = startOfMonthDate(previousMonthEnd);
  /** Stesso giorno del mese scorso, o la sua fine quando quel giorno non esiste. */
  const previousSameDay = [previousMonthStart.slice(0, 8), String(dayOfMonth).padStart(2, '0')].join('');
  const previousLimit = previousSameDay > previousMonthEnd ? previousMonthEnd : previousSameDay;

  const currentCents = sumBetween(live, monthStart, today);
  const previousCents = sumBetween(live, previousMonthStart, previousLimit);
  return { currentCents, previousCents, differenceCents: currentCents - previousCents };
}

function buildRunway(
  transactions: readonly ChallengeTransaction[],
  netWorthCents: number,
  today: string,
): number | null {
  const months = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.effectiveDate >= startOfMonthDate(today)) {
      continue;
    }
    const month = monthOf(transaction.effectiveDate);
    months.set(month, (months.get(month) ?? 0) + transaction.amountCents);
  }
  const closed = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3);
  if (closed.length === 0) {
    return null;
  }
  const average = closed.reduce((total, [, amount]) => total + amount, 0) / closed.length;
  return average > 0 ? Math.round((netWorthCents / average) * 10) / 10 : null;
}

function buildWeekly(live: readonly ChallengeTransaction[], today: string): WeeklyChallenge {
  const weekStart = addDaysToLocalDate(today, -(WEEK_DAYS - 1));
  const spentCents = sumBetween(live, weekStart, today);
  const historyStart = addDaysToLocalDate(weekStart, -WEEK_DAYS * 4);
  const historyCents = sumBetween(live, historyStart, addDaysToLocalDate(weekStart, -1));
  const targetCents = Math.round((historyCents / 4) * WEEKLY_TARGET_RATIO);
  return { spentCents, targetCents, won: targetCents > 0 && spentCents <= targetCents };
}

function buildScore(
  input: ChallengeInput,
  streak: Streak,
  transactions: readonly ChallengeTransaction[],
): Pick<ChallengeResult, 'achievements' | 'points' | 'level'> {
  const monthlyNet = netByMonth(transactions);
  const closedMonths = [...monthlyNet.entries()]
    .filter(([month]) => month < monthOf(input.today))
    .sort((a, b) => b[0].localeCompare(a[0]));
  const positiveStreak = closedMonths.findIndex(([, net]) => net <= 0);
  const positiveMonths = positiveStreak === -1 ? closedMonths.length : positiveStreak;
  const runway = buildRunway(transactions, input.netWorthCents, input.today) ?? 0;
  const count = transactions.length;

  const achievements: Achievement[] = [
    { id: 'primo-passo', name: 'Primo passo', description: 'Hai registrato il tuo primo movimento.', points: 10, unlocked: count > 0 },
    { id: 'archivista', name: 'Archivista', description: 'Hai registrato 100 movimenti.', points: 25, unlocked: count >= 100 },
    { id: 'cronista', name: 'Cronista', description: 'Hai registrato 500 movimenti.', points: 75, unlocked: count >= 500 },
    { id: 'tre-giorni', name: 'Tre giorni puliti', description: 'Tre giorni di fila senza spese vive.', points: 15, unlocked: streak.record >= 3 },
    { id: 'settimana', name: 'Settimana pulita', description: 'Sette giorni di fila senza spese vive.', points: 40, unlocked: streak.record >= 7 },
    { id: 'due-settimane', name: 'Quattordici giorni', description: 'Due settimane di fila senza spese vive.', points: 90, unlocked: streak.record >= 14 },
    { id: 'mese-positivo', name: 'Mese in positivo', description: 'Un mese chiuso con più entrate che uscite.', points: 30, unlocked: positiveMonths >= 1 },
    { id: 'tris', name: 'Tris', description: 'Tre mesi chiusi di fila in positivo.', points: 90, unlocked: positiveMonths >= 3 },
    { id: 'cuscinetto', name: 'Cuscinetto', description: 'Sui conti hai almeno un mese di spese.', points: 30, unlocked: runway >= 1 },
    { id: 'paracadute', name: 'Paracadute', description: 'Sui conti hai almeno tre mesi di spese.', points: 100, unlocked: runway >= 3 },
    { id: 'rete', name: 'Rete di sicurezza', description: 'Sui conti hai almeno sei mesi di spese.', points: 200, unlocked: runway >= 6 },
    { id: 'obiettivo', name: 'Obiettivo centrato', description: 'Hai completato un obiettivo di risparmio.', points: 100, unlocked: input.completedGoals > 0 },
  ];

  const points = achievements.filter((achievement) => achievement.unlocked).reduce((total, item) => total + item.points, 0);
  const index = LEVELS.reduce((current, level, position) => (points >= level.points ? position : current), 0);
  return {
    achievements,
    points,
    level: { name: LEVELS[index].name, index, nextPoints: LEVELS[index + 1]?.points ?? null },
  };
}

function netByMonth(transactions: readonly ChallengeTransaction[]): Map<string, number> {
  const months = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type === 'transfer') {
      continue;
    }
    const month = monthOf(transaction.effectiveDate);
    const sign = transaction.type === 'income' ? 1 : -1;
    months.set(month, (months.get(month) ?? 0) + sign * transaction.amountCents);
  }
  return months;
}
