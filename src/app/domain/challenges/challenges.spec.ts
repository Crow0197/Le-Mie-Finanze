import { ChallengeInput, ChallengeTransaction, buildChallenges } from './challenges';

const spesa = (
  effectiveDate: string,
  amountCents: number,
  extra: Partial<ChallengeTransaction> = {},
): ChallengeTransaction => ({
  effectiveDate,
  amountCents,
  type: 'expense',
  description: 'spesa',
  ...extra,
});

const base: ChallengeInput = {
  today: '2026-09-19',
  transactions: [],
  netWorthCents: 200000,
  subscriptions: [],
  categoryNames: { food: 'Alimentari', bar: 'Bar e caffè' },
  completedGoals: 0,
};

describe('buildChallenges', () => {
  it('conta i giorni senza spese vive, ignorando rate e abbonamenti', () => {
    const result = buildChallenges({
      ...base,
      transactions: [
        spesa('2026-09-15', 3000),
        spesa('2026-09-18', 1199, { recurringRuleId: 'netflix' }),
        { effectiveDate: '2026-09-19', amountCents: 5000, type: 'transfer', description: 'giro' },
      ],
    });
    expect(result.streak.days).toBe(4);
  });

  it('azzera la serie quando hai speso oggi', () => {
    const result = buildChallenges({ ...base, transactions: [spesa('2026-09-19', 2000)] });
    expect(result.streak.days).toBe(0);
  });

  it('pesa le piccole spese del mese', () => {
    const result = buildChallenges({
      ...base,
      transactions: [spesa('2026-09-02', 350), spesa('2026-09-03', 980), spesa('2026-09-04', 4000)],
    });
    expect(result.smallSpends).toEqual({ count: 2, countedCents: 1330 });
  });

  it('trova la spesa più folle e il giorno più caro del mese', () => {
    const result = buildChallenges({
      ...base,
      transactions: [
        spesa('2026-09-05', 12000, { description: 'Scarpe', categoryId: 'food' }),
        spesa('2026-09-06', 7000),
        spesa('2026-09-06', 8000),
      ],
    });
    expect(result.wildest?.description).toBe('Scarpe');
    expect(result.wildest?.categoryName).toBe('Alimentari');
    expect(result.worstDay).toEqual({ date: '2026-09-06', amountCents: 15000 });
  });

  it('confronta il mese con lo stesso giorno del mese scorso', () => {
    const result = buildChallenges({
      ...base,
      transactions: [spesa('2026-09-10', 5000), spesa('2026-08-10', 9000), spesa('2026-08-25', 4000)],
    });
    expect(result.duel.currentCents).toBe(5000);
    expect(result.duel.previousCents).toBe(9000);
    expect(result.duel.differenceCents).toBe(-4000);
  });

  it('calcola i mesi di autonomia sui mesi chiusi', () => {
    const result = buildChallenges({
      ...base,
      netWorthCents: 300000,
      transactions: [spesa('2026-08-10', 100000), spesa('2026-07-10', 100000)],
    });
    expect(result.runwayMonths).toBe(3);
  });

  it('assegna punti e livello solo per quello che hai davvero fatto', () => {
    const empty = buildChallenges(base);
    expect(empty.points).toBe(0);
    expect(empty.level.name).toBe('Principiante');

    const result = buildChallenges({
      ...base,
      netWorthCents: 300000,
      transactions: [spesa('2026-08-10', 100000), spesa('2026-07-10', 100000)],
      completedGoals: 1,
    });
    const unlocked = result.achievements.filter((item) => item.unlocked).map((item) => item.id);
    expect(unlocked).toContain('primo-passo');
    expect(unlocked).toContain('cuscinetto');
    expect(unlocked).toContain('paracadute');
    expect(unlocked).toContain('obiettivo');
    expect(unlocked).not.toContain('rete');
    expect(result.points > 0).toBe(true);
  });

  it('propone una sfida settimanale più bassa di quanto spendi di solito', () => {
    const transactions = Array.from({ length: 5 }, (_, index) => spesa(`2026-09-${String(index + 1).padStart(2, '0')}`, 10000));
    const result = buildChallenges({ ...base, transactions });
    expect(result.weekly.targetCents > 0).toBe(true);
    expect(result.weekly.won).toBe(true);
  });
});
