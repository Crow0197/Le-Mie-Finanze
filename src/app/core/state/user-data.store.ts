import { Injectable, computed, inject, signal } from '@angular/core';
import { Timestamp } from 'firebase/firestore';
import { AccountDraft, AccountRepository } from '../../data-access/repositories/account.repository';
import { CategoryDraft, CategoryRepository } from '../../data-access/repositories/category.repository';
import {
  QuickTemplateDraft,
  QuickTemplateRepository,
} from '../../data-access/repositories/quick-template.repository';
import { RecurringRuleRepository } from '../../data-access/repositories/recurring-rule.repository';
import {
  UserSettingsChanges,
  UserSettingsRepository,
} from '../../data-access/repositories/user-settings.repository';
import { BalanceEffects } from '../../domain/balance-effects/balance-effects';
import { Account } from '../../domain/models/account';
import { Category } from '../../domain/models/category';
import { MAX_FAVORITE_TEMPLATES, QuickTemplate } from '../../domain/models/quick-template';
import { RecurringRule, RecurringRuleDraft } from '../../domain/models/recurring-rule';
import { UserSettings } from '../../domain/models/user-settings';
import { AuthService } from '../auth/auth.service';

/**
 * Small, rarely changing user data kept in memory after the first load to limit Firestore reads.
 */
@Injectable({ providedIn: 'root' })
export class UserDataStore {
  private readonly authService = inject(AuthService);
  private readonly settingsRepository = inject(UserSettingsRepository);
  private readonly accountRepository = inject(AccountRepository);
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly templateRepository = inject(QuickTemplateRepository);
  private readonly ruleRepository = inject(RecurringRuleRepository);

  private loadedUid: string | null = null;
  private loading: Promise<void> | null = null;

  private readonly settingsState = signal<UserSettings | null>(null);
  private readonly accountsState = signal<Account[]>([]);
  private readonly categoriesState = signal<Category[]>([]);
  private readonly templatesState = signal<QuickTemplate[]>([]);
  private readonly rulesState = signal<RecurringRule[]>([]);
  private readonly loadedState = signal(false);

  readonly settings = this.settingsState.asReadonly();
  readonly accounts = this.accountsState.asReadonly();
  readonly categories = this.categoriesState.asReadonly();
  readonly templates = this.templatesState.asReadonly();
  readonly rules = this.rulesState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();

  readonly activeAccounts = computed(() => this.accountsState().filter((account) => !account.archived));
  readonly accountsById = computed(() => new Map(this.accountsState().map((account) => [account.id, account])));
  readonly categoriesById = computed(() => new Map(this.categoriesState().map((category) => [category.id, category])));
  readonly activeTemplates = computed(() => this.templatesState().filter((template) => !template.archived));
  readonly favoriteTemplates = computed(() =>
    this.activeTemplates()
      .filter((template) => template.favorite)
      .slice(0, MAX_FAVORITE_TEMPLATES),
  );
  readonly defaultAccount = computed(() => {
    const id = this.settingsState()?.defaultAccountId;
    return this.activeAccounts().find((account) => account.id === id) ?? null;
  });
  /** True when accounts exist but no valid default account is set (for example after archiving it). */
  readonly needsDefaultAccount = computed(
    () => this.loadedState() && this.activeAccounts().length > 0 && !this.defaultAccount(),
  );

  get uid(): string {
    const uid = this.authService.user()?.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }
    return uid;
  }

  load(): Promise<void> {
    const uid = this.uid;
    if (this.loadedUid === uid && this.loading) {
      return this.loading;
    }
    this.loadedUid = uid;
    this.loadedState.set(false);
    this.loading = this.fetch(uid).catch((error: unknown) => {
      this.loadedUid = null;
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  /** Reloads the data without clearing what is currently displayed. */
  async refresh(): Promise<void> {
    const uid = this.uid;
    this.loadedUid = uid;
    this.loading = this.fetch(uid);
    await this.loading;
  }

  reset(): void {
    this.loadedUid = null;
    this.loading = null;
    this.loadedState.set(false);
    this.settingsState.set(null);
    this.accountsState.set([]);
    this.categoriesState.set([]);
    this.templatesState.set([]);
    this.rulesState.set([]);
  }

  async updateSettings(changes: UserSettingsChanges): Promise<void> {
    await this.settingsRepository.update(this.uid, changes);
    this.settingsState.update((settings) => (settings ? { ...settings, ...changes } : settings));
  }

  async createAccount(draft: AccountDraft): Promise<Account> {
    const account = await this.accountRepository.create(this.uid, draft);
    this.accountsState.update((accounts) => [...accounts, account]);
    if (!this.defaultAccount()) {
      await this.updateSettings({ defaultAccountId: account.id });
    }
    return account;
  }

  async updateAccount(account: Account, draft: AccountDraft): Promise<void> {
    const updated = await this.accountRepository.update(this.uid, account, draft);
    this.replaceAccount(updated);
  }

  /** Archives the account and pauses its active recurring rules. Returns the number of paused rules. */
  async archiveAccount(account: Account): Promise<number> {
    const rulesToPause = this.rulesState().filter(
      (rule) => rule.accountId === account.id && rule.status === 'active',
    );
    await this.accountRepository.archive(this.uid, account.id, rulesToPause.map((rule) => rule.id));
    this.replaceAccount({ ...account, archived: true });
    this.rulesState.update((rules) =>
      rules.map((rule) =>
        rulesToPause.includes(rule) ? { ...rule, status: 'paused', pausedReason: 'accountArchived' } : rule,
      ),
    );
    return rulesToPause.length;
  }

  async restoreAccount(account: Account): Promise<void> {
    await this.accountRepository.restore(this.uid, account.id);
    this.replaceAccount({ ...account, archived: false });
  }

  async reorderAccounts(orderedIds: readonly string[]): Promise<void> {
    await this.accountRepository.reorder(this.uid, orderedIds);
    this.accountsState.update((accounts) =>
      accounts
        .map((account) => ({ ...account, sortOrder: orderedIds.indexOf(account.id) }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  /** Mirrors in memory the balance changes already committed to Firestore. */
  applyBalanceEffects(effects: BalanceEffects): void {
    if (Object.keys(effects).length === 0) {
      return;
    }
    this.accountsState.update((accounts) =>
      accounts.map((account) =>
        effects[account.id]
          ? { ...account, currentBalanceCents: account.currentBalanceCents + effects[account.id] }
          : account,
      ),
    );
  }

  setBalances(balances: Record<string, number>): void {
    this.accountsState.update((accounts) =>
      accounts.map((account) =>
        account.id in balances ? { ...account, currentBalanceCents: balances[account.id] } : account,
      ),
    );
  }

  async createCategory(draft: CategoryDraft): Promise<void> {
    const category = await this.categoryRepository.create(this.uid, draft);
    this.categoriesState.update((categories) => [...categories, category].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async updateCategory(id: string, changes: Partial<CategoryDraft>): Promise<void> {
    await this.categoryRepository.update(this.uid, id, changes);
    this.categoriesState.update((categories) =>
      categories.map((category) => (category.id === id ? { ...category, ...changes } : category)),
    );
  }

  /** Categories already used by transactions are archived instead of deleted. Returns true when archived. */
  async removeCategory(category: Category): Promise<boolean> {
    const hasChildren = this.categoriesState().some((item) => item.parentId === category.id);
    const used = hasChildren || category.system || (await this.categoryRepository.isUsed(this.uid, category.id));
    if (used) {
      await this.updateCategory(category.id, { archived: true });
      return true;
    }
    await this.categoryRepository.delete(this.uid, category.id);
    this.categoriesState.update((categories) => categories.filter((item) => item.id !== category.id));
    return false;
  }

  async createTemplate(draft: QuickTemplateDraft): Promise<void> {
    const template = await this.templateRepository.create(this.uid, draft);
    this.templatesState.update((templates) => [...templates, template]);
  }

  async updateTemplate(id: string, changes: Partial<QuickTemplateDraft>): Promise<void> {
    await this.templateRepository.update(this.uid, id, changes);
    this.templatesState.update((templates) =>
      templates.map((template) => (template.id === id ? { ...template, ...changes } : template)),
    );
  }

  async reorderTemplates(orderedIds: readonly string[]): Promise<void> {
    await this.templateRepository.reorder(this.uid, orderedIds);
    this.templatesState.update((templates) =>
      templates
        .map((template) => ({ ...template, sortOrder: orderedIds.indexOf(template.id) }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  async createRule(draft: RecurringRuleDraft): Promise<RecurringRule> {
    const rule = await this.ruleRepository.create(this.uid, draft);
    this.rulesState.update((rules) => [...rules, rule]);
    return rule;
  }

  async updateRule(id: string, changes: Partial<RecurringRuleDraft>): Promise<void> {
    await this.ruleRepository.update(this.uid, id, changes);
    this.patchRule(id, changes);
  }

  async removeRule(id: string): Promise<void> {
    await this.ruleRepository.remove(this.uid, id);
    this.rulesState.update((rules) => rules.filter((rule) => rule.id !== id));
  }

  /** Updates the in memory copy only, after a write performed elsewhere. */
  patchRule(id: string, changes: Partial<RecurringRuleDraft>): void {
    this.rulesState.update((rules) =>
      rules.map((rule) => (rule.id === id ? { ...rule, ...changes, updatedAt: Timestamp.now() } : rule)),
    );
  }

  private async fetch(uid: string): Promise<void> {
    let settings = await this.settingsRepository.get(uid);
    if (!settings) {
      await this.settingsRepository.initialize(uid, this.authService.user()?.displayName ?? '');
      settings = await this.settingsRepository.get(uid);
    }
    const [accounts, categories, templates, rules] = await Promise.all([
      this.accountRepository.listAll(uid),
      this.categoryRepository.listAll(uid),
      this.templateRepository.listAll(uid),
      this.ruleRepository.listAll(uid),
    ]);
    if (this.loadedUid !== uid) {
      return;
    }
    this.settingsState.set(settings);
    this.accountsState.set(accounts);
    this.categoriesState.set(categories);
    this.templatesState.set(templates);
    this.rulesState.set(rules);
    this.loadedState.set(true);
  }

  private replaceAccount(updated: Account): void {
    this.accountsState.update((accounts) =>
      accounts.map((account) => (account.id === updated.id ? updated : account)),
    );
  }
}
