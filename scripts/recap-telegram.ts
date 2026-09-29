/**
 * Invia su Telegram un riepilogo giornaliero: saldo spendibile, scadenze di oggi
 * e quanto resta fino al prossimo stipendio.
 *
 * Riusa gli stessi moduli di dominio (framework-agnostic, gli stessi della Dashboard)
 * così i numeri nel messaggio coincidono sempre con quelli dell'app: la parte "fino al
 * prossimo stipendio" replica lo stesso calcolo della card Riepilogo (cycleEnd/cycleDaily
 * in dashboard.ts) — dal saldo di oggi si sottraggono solo le scadenze fino al giorno
 * prima del prossimo stipendio, che quindi non viene mai contato come entrata.
 *
 * Eseguito da .github/workflows/recap-giornaliero.yml, programmato due volte al giorno
 * (7:00 e 8:00 UTC) per restare alle 9 di mattina a Roma sia in ora solare che legale:
 * questo script controlla l'ora locale ed esce subito se non è il momento giusto.
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  addDaysToLocalDate,
  APP_TIME_ZONE,
  daysBetween,
  formatLocalDate,
  todayInTimeZone,
} from '../src/app/domain/dates/local-date';
import { calculateAvailableCents, calculateNetWorthCents } from '../src/app/domain/forecast/balances';
import { buildVirtualOccurrences, toForecastEntry } from '../src/app/domain/forecast/forecast';
import { resolveSalaryCycleRange } from '../src/app/domain/forecast/salary-cycle';
import { formatCents } from '../src/app/domain/money/money';
import type { Account } from '../src/app/domain/models/account';
import type { RecurringRule } from '../src/app/domain/models/recurring-rule';
import type { Transaction } from '../src/app/domain/models/transaction';

const TARGET_HOUR = '09';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile d'ambiente mancante: ${name}`);
  }
  return value;
}

function currentHourInRome(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
}

async function sendTelegramMessage(text: string): Promise<void> {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!response.ok) {
    throw new Error(`Telegram ha risposto ${response.status}: ${await response.text()}`);
  }
}

async function main(): Promise<void> {
  // Un avvio manuale (workflow_dispatch, per esempio per provarlo) invia subito,
  // senza aspettare l'orario: quello serve solo per non duplicare l'invio schedulato.
  const isManualRun = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
  const hour = currentHourInRome();
  if (!isManualRun && hour !== TARGET_HOUR) {
    console.log(`Sono le ${hour} a Roma, non le ${TARGET_HOUR}: esco senza inviare nulla.`);
    return;
  }

  const uid = requireEnv('FIREBASE_UID');
  const serviceAccount = JSON.parse(requireEnv('FIREBASE_SERVICE_ACCOUNT_JSON'));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const today = todayInTimeZone();
  const horizon = addDaysToLocalDate(today, 180);

  // Un solo filtro per query e il resto in JavaScript: il progetto evita apposta gli indici
  // compositi di Firestore (vedi firestore.indexes.json), lo stesso pattern di transaction.repository.ts.
  const [settingsSnap, accountsSnap, rulesSnap, plannedSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collection(`users/${uid}/accounts`).get(),
    db.collection(`users/${uid}/recurringRules`).get(),
    db.collection(`users/${uid}/transactions`).where('status', '==', 'planned').get(),
  ]);

  const safetyBufferCents = (settingsSnap.data()?.['safetyBufferCents'] as number | undefined) ?? 0;
  const accounts = accountsSnap.docs.map((doc) => doc.data() as Account).filter((account) => !account.archived);
  const rules = rulesSnap.docs.map((doc) => doc.data() as RecurringRule);
  const planned = plannedSnap.docs
    .map((doc) => doc.data() as Transaction)
    .filter((transaction) => transaction.effectiveDate >= today && transaction.effectiveDate <= horizon);

  const salaryRuleIds = new Set(rules.filter((rule) => rule.kind === 'salary').map((rule) => rule.id));
  const plannedEntries = planned.map((transaction) => toForecastEntry(transaction, salaryRuleIds));
  const storedKeys = new Set(
    planned.map((transaction) => transaction.occurrenceKey).filter((key): key is string => !!key),
  );

  const availableCents = calculateAvailableCents(accounts);
  const dueToday = rules.filter((rule) => rule.status === 'active' && rule.nextOccurrenceDate === today);
  const cycle = resolveSalaryCycleRange(rules, today);

  const lines: string[] = [`📊 <b>Riepilogo di oggi</b> — ${formatLocalDate(today, 'long')}`, ''];

  lines.push(`💰 Saldo spendibile ora: <b>${formatCents(availableCents)}</b>`);
  lines.push('');

  if (dueToday.length === 0) {
    lines.push('📅 Nessuna scadenza oggi.');
  } else {
    const totalDueToday = dueToday.reduce((total, rule) => total + rule.amountCents, 0);
    lines.push(`📅 <b>Scadenze di oggi</b> (totale ${formatCents(totalDueToday)}):`);
    for (const rule of dueToday) {
      lines.push(`• ${rule.description || rule.name}: ${formatCents(rule.amountCents)}`);
    }
  }
  lines.push('');

  if (cycle) {
    const future = [
      ...plannedEntries.filter((entry) => entry.date > today && entry.date <= cycle.endDate),
      ...buildVirtualOccurrences(rules, addDaysToLocalDate(today, 1), cycle.endDate, storedKeys),
    ];
    let incomeCents = 0;
    let expenseCents = 0;
    for (const entry of future) {
      if (entry.type === 'income') {
        incomeCents += entry.amountCents;
      } else if (entry.type === 'expense') {
        expenseCents += entry.amountCents;
      } else {
        expenseCents += entry.feeCents ?? 0;
      }
    }
    const balanceCents = calculateNetWorthCents(accounts) + incomeCents - expenseCents;
    const days = Math.max(1, daysBetween(today, cycle.endDate) + 1);
    const dailyCents = Math.floor(Math.max(0, balanceCents - safetyBufferCents) / days);

    lines.push(
      `⏳ Fino al prossimo stipendio (${formatLocalDate(cycle.endDate, 'short')}): <b>${formatCents(balanceCents)}</b>`,
    );
    lines.push(`   circa ${formatCents(dailyCents)}/giorno per ${days} giorni`);
    if (balanceCents - safetyBufferCents < 0) {
      lines.push('');
      lines.push(
        `⚠️ Rischi di andare in rosso prima dello stipendio: mancano ${formatCents(safetyBufferCents - balanceCents)}.`,
      );
    }
  } else {
    lines.push('⏳ Nessuno stipendio ricorrente configurato: previsione limitata al saldo attuale.');
  }

  await sendTelegramMessage(lines.join('\n'));
  console.log('Recap inviato.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
