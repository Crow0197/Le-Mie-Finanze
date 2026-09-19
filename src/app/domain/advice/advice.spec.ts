import { AdviceInput, buildAdvice, monthlyAmountCents } from './advice';

const base: AdviceInput = {
  today: '2026-09-19',
  hasSalary: true,
  safetyBufferCents: 50000,
  cycleEndCents: 120000,
  cycleMinCents: 80000,
  cycleMinDate: '2026-10-10',
  cycleEndDate: '2026-10-13',
  salaryMonthlyCents: 200000,
  commitmentsMonthlyCents: 40000,
  commitmentsCount: 5,
  duePlannedCount: 0,
  pausedRulesCount: 0,
};

const idsOf = (input: AdviceInput) => buildAdvice(input).map((advice) => advice.id);

describe('monthlyAmountCents', () => {
  it('riporta al mese ogni frequenza', () => {
    expect(monthlyAmountCents({ frequency: 'monthly', interval: 1, amountCents: 1000 })).toBe(1000);
    expect(monthlyAmountCents({ frequency: 'yearly', interval: 1, amountCents: 12000 })).toBe(1000);
    expect(monthlyAmountCents({ frequency: 'customMonths', interval: 3, amountCents: 3000 })).toBe(1000);
    expect(monthlyAmountCents({ frequency: 'weekly', interval: 1, amountCents: 1000 })).toBe(4333);
  });
});

describe('buildAdvice', () => {
  it('mette per prima la cosa più seria', () => {
    const advice = buildAdvice({ ...base, cycleMinCents: -15000, duePlannedCount: 2 });
    expect(advice[0].id).toBe('liquidita-negativo');
    expect(advice[0].level).toBe('danger');
  });

  it('avvisa quando si passa sotto il margine di sicurezza', () => {
    const advice = buildAdvice({ ...base, cycleMinCents: 20000 });
    expect(advice.find((item) => item.id === 'liquidita-margine')?.level).toBe('warning');
  });

  it('pesa le spese fisse sullo stipendio', () => {
    expect(idsOf({ ...base, commitmentsMonthlyCents: 110000 })).toContain('impegni-pesanti');
    expect(idsOf({ ...base, commitmentsMonthlyCents: 70000 })).toContain('impegni-alti');
    expect(idsOf(base)).toContain('impegni-ok');
  });

  it('segnala solo le categorie davvero sopra la media', () => {
    const categories = [
      { categoryId: 'svago', name: 'Svago', currentCents: 20000, previousMonthlyCents: [10000, 10000] },
      { categoryId: 'casa', name: 'Casa', currentCents: 10500, previousMonthlyCents: [10000, 10000] },
    ];
    const ids = idsOf({ ...base, categories });
    expect(ids).toContain('spese-svago');
    expect(ids).not.toContain('spese-casa');
  });

  it('salta le regole che non hanno i dati', () => {
    const ids = idsOf(base);
    expect(ids.some((id) => id.startsWith('spese-'))).toBe(false);
    expect(ids.some((id) => id.startsWith('risparmio-'))).toBe(false);
  });

  it('dice quando un obiettivo non è alla portata', () => {
    const goals = [{ name: 'Viaggio', targetCents: 300000, currentCents: 0, targetDate: '2026-12-19' }];
    const monthlySavings = [
      { month: '2026-07', incomeCents: 200000, expenseCents: 180000 },
      { month: '2026-08', incomeCents: 200000, expenseCents: 180000 },
    ];
    const advice = buildAdvice({ ...base, goals, monthlySavings });
    const goal = advice.find((item) => item.id === 'obiettivo-Viaggio');
    expect(goal?.level).toBe('warning');
    expect(goal?.detail).toContain('3 mesi');
  });

  it('riconosce un mese chiuso in perdita', () => {
    const monthlySavings = [
      { month: '2026-07', incomeCents: 200000, expenseCents: 150000 },
      { month: '2026-08', incomeCents: 200000, expenseCents: 230000 },
    ];
    expect(idsOf({ ...base, monthlySavings })).toContain('risparmio-negativo');
  });

  it('elenca le cose da sistemare', () => {
    const ids = idsOf({ ...base, hasSalary: false, duePlannedCount: 3, safetyBufferCents: 0, pausedRulesCount: 1 });
    for (const expected of ['dati-stipendio', 'dati-pianificate', 'dati-margine', 'dati-sospese']) {
      expect(ids).toContain(expected);
    }
  });
});
