import { daysBetween, formatLocalDate } from '../dates/local-date';
import { formatCents } from '../money/money';
import { RecurrenceFrequency } from '../models/recurring-rule';

export type AdviceLevel = 'danger' | 'warning' | 'info' | 'good';
export type AdviceTopic = 'liquidita' | 'spese' | 'impegni' | 'risparmio' | 'dati';

export interface Advice {
  id: string;
  level: AdviceLevel;
  topic: AdviceTopic;
  /** La frase principale, quella che si legge di colpo. */
  title: string;
  /** Il perché, con i numeri che lo dimostrano. */
  detail: string;
  /** Cosa si può fare; assente quando non c'è niente da fare. */
  action?: string;
  link?: { path: string; label: string };
}

/** Spesa di una macrocategoria nel mese in corso e nei mesi già chiusi. */
export interface CategorySpending {
  categoryId: string;
  name: string;
  currentCents: number;
  previousMonthlyCents: readonly number[];
}

/** Importo di una ricorrenza oggi contro quello della prima occorrenza registrata. */
export interface RecurringChange {
  name: string;
  oldCents: number;
  newCents: number;
}

export interface MonthlySaving {
  /** Mese chiuso, nel formato YYYY-MM. */
  month: string;
  incomeCents: number;
  expenseCents: number;
}

export interface GoalProgress {
  name: string;
  targetCents: number;
  currentCents: number;
  targetDate?: string;
}

export interface AdviceInput {
  today: string;
  hasSalary: boolean;
  safetyBufferCents: number;
  /** Saldo previsto alla fine del ciclo di stipendio e punto più basso del periodo. */
  cycleEndCents: number;
  cycleMinCents: number;
  cycleMinDate: string;
  cycleEndDate: string;
  /** Stipendio mensile previsto; 0 quando non è configurato. */
  salaryMonthlyCents: number;
  /** Spese ricorrenti riportate al mese. */
  commitmentsMonthlyCents: number;
  commitmentsCount: number;
  duePlannedCount: number;
  pausedRulesCount: number;
  /** Dati più pesanti, forniti solo dalla pagina Consigli: le regole che li usano vengono saltate senza. */
  categories?: readonly CategorySpending[];
  recurringChanges?: readonly RecurringChange[];
  monthlySavings?: readonly MonthlySaving[];
  goals?: readonly GoalProgress[];
}

/** Sopra questa quota le rate pesano troppo sullo stipendio. */
const COMMITMENTS_HEAVY = 0.5;
const COMMITMENTS_HIGH = 0.3;
/** Una categoria è "sopra il solito" oltre questa percentuale e oltre questa differenza. */
const CATEGORY_TOLERANCE = 1.4;
const CATEGORY_MIN_DIFFERENCE = 3000;
/** Rincaro di una ricorrenza che vale la pena segnalare. */
const RECURRING_MIN_INCREASE = 1.03;
const MAX_PER_RULE = 2;
const LEVEL_ORDER: Record<AdviceLevel, number> = { danger: 0, warning: 1, info: 2, good: 3 };

/** Quanto pesa al mese una ricorrenza, qualunque sia la sua frequenza. */
export function monthlyAmountCents(rule: {
  frequency: RecurrenceFrequency;
  interval: number;
  amountCents: number;
}): number {
  const interval = Math.max(1, rule.interval);
  switch (rule.frequency) {
    case 'weekly':
      return Math.round((rule.amountCents * 52) / 12 / interval);
    case 'monthly':
      return Math.round(rule.amountCents / interval);
    case 'customMonths':
      return Math.round(rule.amountCents / interval);
    case 'yearly':
      return Math.round(rule.amountCents / 12 / interval);
  }
}

/**
 * Osservazioni sulla situazione, ordinate dalla più seria alla meno seria.
 * Sono regole fisse sui dati dell'utente: niente stime magiche, niente consigli di investimento.
 */
export function buildAdvice(input: AdviceInput): Advice[] {
  const advice: Advice[] = [
    ...liquidityAdvice(input),
    ...commitmentsAdvice(input),
    ...categoryAdvice(input),
    ...recurringAdvice(input),
    ...savingsAdvice(input),
    ...goalAdvice(input),
    ...dataAdvice(input),
  ];
  return advice.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

function liquidityAdvice(input: AdviceInput): Advice[] {
  if (input.cycleMinCents < 0) {
    return [
      {
        id: 'liquidita-negativo',
        level: 'danger',
        topic: 'liquidita',
        title: `Prima del prossimo stipendio vai sotto zero`,
        detail: `Il ${formatLocalDate(input.cycleMinDate)} arrivi a ${formatCents(input.cycleMinCents)}: mancano ${formatCents(-input.cycleMinCents)}.`,
        action: 'Guarda cosa cade prima di quella data e sposta quello che puoi.',
        link: { path: '/simulazione', label: 'Apri la simulazione' },
      },
    ];
  }
  if (input.safetyBufferCents > 0 && input.cycleMinCents < input.safetyBufferCents) {
    return [
      {
        id: 'liquidita-margine',
        level: 'warning',
        topic: 'liquidita',
        title: 'Passi sotto il tuo margine di sicurezza',
        detail: `Il ${formatLocalDate(input.cycleMinDate)} resti con ${formatCents(input.cycleMinCents)}, sotto i ${formatCents(input.safetyBufferCents)} che vuoi tenere da parte.`,
        action: 'Non è un guaio, ma un imprevisto in quei giorni lo diventa.',
      },
    ];
  }
  return [
    {
      id: 'liquidita-ok',
      level: 'good',
      topic: 'liquidita',
      title: 'Arrivi allo stipendio senza affanni',
      detail: `Il punto più basso del periodo è ${formatCents(input.cycleMinCents)} il ${formatLocalDate(input.cycleMinDate)}, e chiudi a ${formatCents(input.cycleEndCents)}.`,
    },
  ];
}

function commitmentsAdvice(input: AdviceInput): Advice[] {
  if (input.salaryMonthlyCents <= 0 || input.commitmentsCount === 0) {
    return [];
  }
  const ratio = input.commitmentsMonthlyCents / input.salaryMonthlyCents;
  const percent = Math.round(ratio * 100);
  const freeCents = input.salaryMonthlyCents - input.commitmentsMonthlyCents;
  const detail = `${formatCents(input.commitmentsMonthlyCents)} al mese di rate e spese fisse su ${formatCents(input.salaryMonthlyCents)} di stipendio: il ${percent}%. Per tutto il resto ti restano ${formatCents(freeCents)}.`;
  if (ratio >= COMMITMENTS_HEAVY) {
    return [
      {
        id: 'impegni-pesanti',
        level: 'danger',
        topic: 'impegni',
        title: 'Metà stipendio se ne va prima che tu spenda qualcosa',
        detail,
        action: 'Guarda le ricorrenze una per una: quelle che non usi più valgono soldi ogni mese.',
        link: { path: '/pianificate', label: 'Vedi le ricorrenze' },
      },
    ];
  }
  if (ratio >= COMMITMENTS_HIGH) {
    return [
      {
        id: 'impegni-alti',
        level: 'warning',
        topic: 'impegni',
        title: 'Le spese fisse pesano parecchio',
        detail,
        action: 'Sotto un terzo dello stipendio saresti più libero di manovra.',
        link: { path: '/pianificate', label: 'Vedi le ricorrenze' },
      },
    ];
  }
  return [
    {
      id: 'impegni-ok',
      level: 'good',
      topic: 'impegni',
      title: 'Le spese fisse sono sotto controllo',
      detail,
    },
  ];
}

function categoryAdvice(input: AdviceInput): Advice[] {
  if (!input.categories) {
    return [];
  }
  const anomalies = input.categories
    .map((category) => {
      const previous = category.previousMonthlyCents;
      if (previous.length < 2) {
        return null;
      }
      const average = Math.round(previous.reduce((total, value) => total + value, 0) / previous.length);
      const difference = category.currentCents - average;
      const overTolerance = average > 0 && category.currentCents > average * CATEGORY_TOLERANCE;
      return overTolerance && difference >= CATEGORY_MIN_DIFFERENCE ? { category, average, difference } : null;
    })
    .filter((item): item is { category: CategorySpending; average: number; difference: number } => item !== null)
    .sort((a, b) => b.difference - a.difference)
    .slice(0, MAX_PER_RULE);

  return anomalies.map(({ category, average, difference }) => ({
    id: `spese-${category.categoryId}`,
    level: 'warning' as const,
    topic: 'spese' as const,
    title: `Su «${category.name}» stai spendendo più del solito`,
    detail: `Questo mese ${formatCents(category.currentCents)} contro una media di ${formatCents(average)}: ${formatCents(difference)} in più.`,
    action: 'Se è una spesa una tantum va bene così, altrimenti è il posto dove recuperare più in fretta.',
    link: { path: '/movimenti', label: 'Vedi i movimenti' },
  }));
}

function recurringAdvice(input: AdviceInput): Advice[] {
  if (!input.recurringChanges) {
    return [];
  }
  return input.recurringChanges
    .filter((change) => change.oldCents > 0 && change.newCents > change.oldCents * RECURRING_MIN_INCREASE)
    .sort((a, b) => b.newCents - b.oldCents - (a.newCents - a.oldCents))
    .slice(0, MAX_PER_RULE)
    .map((change) => ({
      id: `rincaro-${change.name}`,
      level: 'info' as const,
      topic: 'spese' as const,
      title: `«${change.name}» è aumentata`,
      detail: `Da ${formatCents(change.oldCents)} a ${formatCents(change.newCents)}, cioè ${formatCents(change.newCents - change.oldCents)} in più ogni volta.`,
      action: 'Se non te ne eri accorto, è il momento di decidere se tenerla.',
    }));
}

function savingsAdvice(input: AdviceInput): Advice[] {
  const months = input.monthlySavings;
  if (!months || months.length === 0) {
    return [];
  }
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const last = sorted[sorted.length - 1];
  const lastNet = last.incomeCents - last.expenseCents;
  const earlier = sorted.slice(0, -1);
  const average = earlier.length
    ? Math.round(earlier.reduce((total, month) => total + month.incomeCents - month.expenseCents, 0) / earlier.length)
    : null;

  if (lastNet < 0) {
    return [
      {
        id: 'risparmio-negativo',
        level: 'warning',
        topic: 'risparmio',
        title: `Nel mese chiuso hai speso più di quanto è entrato`,
        detail: `Entrate ${formatCents(last.incomeCents)}, spese ${formatCents(last.expenseCents)}: ${formatCents(lastNet)}. La differenza esce dai risparmi.`,
        action: 'Un mese storto capita; due di fila sono una tendenza.',
      },
    ];
  }
  if (average !== null && average > 0 && lastNet < average / 2) {
    return [
      {
        id: 'risparmio-in-calo',
        level: 'warning',
        topic: 'risparmio',
        title: 'Stai mettendo da parte meno del solito',
        detail: `Nell'ultimo mese chiuso ${formatCents(lastNet)}, contro una media di ${formatCents(average)}.`,
      },
    ];
  }
  return [
    {
      id: 'risparmio-ok',
      level: 'good',
      topic: 'risparmio',
      title: `Nell'ultimo mese chiuso hai messo da parte ${formatCents(lastNet)}`,
      detail:
        average !== null
          ? `La tua media dei mesi precedenti è ${formatCents(average)}.`
          : 'È il primo mese completo che l’app riesce a confrontare.',
    },
  ];
}

function goalAdvice(input: AdviceInput): Advice[] {
  const goals = input.goals;
  if (!goals || goals.length === 0) {
    return [];
  }
  const months = input.monthlySavings ?? [];
  const averageSaving = months.length
    ? Math.round(months.reduce((total, month) => total + month.incomeCents - month.expenseCents, 0) / months.length)
    : 0;

  return goals
    .filter((goal) => goal.targetDate && goal.currentCents < goal.targetCents)
    .map((goal) => {
      const missing = goal.targetCents - goal.currentCents;
      const monthsLeft = Math.max(1, Math.round(daysBetween(input.today, goal.targetDate!) / 30));
      const needed = Math.round(missing / monthsLeft);
      const reachable = averageSaving >= needed;
      return {
        id: `obiettivo-${goal.name}`,
        level: reachable ? ('good' as const) : ('warning' as const),
        topic: 'risparmio' as const,
        title: reachable ? `«${goal.name}» è alla tua portata` : `«${goal.name}» a questo ritmo non ci arrivi`,
        detail: `Mancano ${formatCents(missing)} in ${monthsLeft} ${monthsLeft === 1 ? 'mese' : 'mesi'}: ${formatCents(needed)} al mese${averageSaving > 0 ? `, contro i ${formatCents(averageSaving)} che metti da parte di solito` : ''}.`,
        action: reachable ? undefined : 'Puoi spostare la data, abbassare l’obiettivo o recuperare dalle spese qui sopra.',
        link: { path: '/risparmio', label: 'Vedi gli obiettivi' },
      };
    })
    .slice(0, MAX_PER_RULE);
}

function dataAdvice(input: AdviceInput): Advice[] {
  const advice: Advice[] = [];
  if (!input.hasSalary) {
    advice.push({
      id: 'dati-stipendio',
      level: 'warning',
      topic: 'dati',
      title: 'Senza stipendio configurato le previsioni valgono poco',
      detail: 'Tutto quello che riguarda "fino al prossimo stipendio" si basa su una data che qui manca.',
      action: 'Aggiungi la tua entrata ricorrente con giorno e importo.',
      link: { path: '/pianificate', label: 'Configura lo stipendio' },
    });
  }
  if (input.duePlannedCount > 0) {
    advice.push({
      id: 'dati-pianificate',
      level: 'warning',
      topic: 'dati',
      title: `${input.duePlannedCount} ${input.duePlannedCount === 1 ? 'operazione scaduta' : 'operazioni scadute'} da confermare`,
      detail: 'Finché restano lì, i saldi e le previsioni sono sfasati di quegli importi.',
      action: 'Confermale se sono avvenute, eliminale se non sono mai successe.',
      link: { path: '/pianificate', label: 'Vai a Pianificate' },
    });
  }
  if (input.safetyBufferCents === 0) {
    advice.push({
      id: 'dati-margine',
      level: 'info',
      topic: 'dati',
      title: 'Non hai impostato un margine di sicurezza',
      detail: 'È la cifra che l’app non considera mai spendibile: serve a non arrivare a zero al primo imprevisto.',
      action: 'Di solito va bene una via di mezzo tra una settimana di spese e un mese di spese fisse.',
      link: { path: '/amministrazione', label: 'Impostalo' },
    });
  }
  if (input.pausedRulesCount > 0) {
    advice.push({
      id: 'dati-sospese',
      level: 'info',
      topic: 'dati',
      title: `${input.pausedRulesCount} ${input.pausedRulesCount === 1 ? 'ricorrenza sospesa' : 'ricorrenze sospese'}`,
      detail: 'Una ricorrenza sospesa non genera più niente, quindi non compare nelle previsioni.',
      action: 'Riattivala o eliminala, così il quadro resta pulito.',
      link: { path: '/pianificate', label: 'Vai a Pianificate' },
    });
  }
  return advice;
}

