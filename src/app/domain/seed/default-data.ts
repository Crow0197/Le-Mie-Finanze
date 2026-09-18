import { Category } from '../models/category';
import { QuickTemplate } from '../models/quick-template';

export type SeedCategory = Omit<Category, 'createdAt' | 'updatedAt'>;
export type SeedTemplate = Omit<QuickTemplate, 'createdAt' | 'updatedAt'>;

export const FEES_CATEGORY_ID = 'expense-fees';
export const SALARY_CATEGORY_ID = 'income-salary';

interface MacroDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  children?: [id: string, name: string][];
}

const EXPENSE_MACROS: MacroDefinition[] = [
  {
    id: 'expense-home',
    name: 'Casa e bollette',
    icon: 'house',
    color: '#176b51',
    children: [
      ['expense-home-rent', 'Affitto o mutuo'],
      ['expense-home-utilities', 'Bollette'],
      ['expense-home-maintenance', 'Manutenzione'],
    ],
  },
  {
    id: 'expense-food',
    name: 'Alimentari',
    icon: 'shopping-cart',
    color: '#3f8f5a',
    children: [
      ['expense-food-groceries', 'Supermercato'],
      ['expense-food-restaurants', 'Ristoranti e bar'],
    ],
  },
  {
    id: 'expense-transport',
    name: 'Trasporti',
    icon: 'car',
    color: '#2f6f9f',
    children: [
      ['expense-transport-fuel', 'Carburante'],
      ['expense-transport-public', 'Mezzi pubblici'],
      ['expense-transport-car', 'Auto e manutenzione'],
    ],
  },
  {
    id: 'expense-health',
    name: 'Salute',
    icon: 'heart-pulse',
    color: '#ad444c',
    children: [
      ['expense-health-pharmacy', 'Farmacia'],
      ['expense-health-visits', 'Visite mediche'],
    ],
  },
  {
    id: 'expense-leisure',
    name: 'Svago',
    icon: 'party-popper',
    color: '#8a5cb8',
    children: [
      ['expense-leisure-going-out', 'Uscite'],
      ['expense-leisure-travel', 'Viaggi'],
      ['expense-leisure-hobby', 'Hobby'],
    ],
  },
  {
    id: 'expense-loans',
    name: 'Rate e finanziamenti',
    icon: 'hand-coins',
    color: '#9b6819',
    children: [
      ['expense-loans-loan', 'Prestiti'],
      ['expense-loans-installments', 'Rate acquisti'],
    ],
  },
  {
    id: 'expense-subscriptions',
    name: 'Abbonamenti',
    icon: 'tv',
    color: '#c0632e',
    children: [
      ['expense-subscriptions-streaming', 'Streaming'],
      ['expense-subscriptions-phone', 'Telefono e internet'],
      ['expense-subscriptions-gym', 'Palestra'],
    ],
  },
  {
    id: 'expense-shopping',
    name: 'Shopping',
    icon: 'shopping-bag',
    color: '#b8487a',
    children: [
      ['expense-shopping-clothes', 'Abbigliamento'],
      ['expense-shopping-tech', 'Tecnologia'],
    ],
  },
  { id: FEES_CATEGORY_ID, name: 'Commissioni', icon: 'receipt', color: '#687873' },
  { id: 'expense-other', name: 'Altro', icon: 'ellipsis', color: '#8a9792' },
];

const INCOME_MACROS: MacroDefinition[] = [
  { id: SALARY_CATEGORY_ID, name: 'Stipendio', icon: 'briefcase', color: '#176b51' },
  { id: 'income-refund', name: 'Rimborso', icon: 'undo-2', color: '#2f6f9f' },
  { id: 'income-gift', name: 'Regalo', icon: 'gift', color: '#8a5cb8' },
  { id: 'income-sale', name: 'Vendita', icon: 'tag', color: '#9b6819' },
  { id: 'income-other', name: 'Altro', icon: 'ellipsis', color: '#8a9792' },
];

export function buildDefaultCategories(): SeedCategory[] {
  const categories: SeedCategory[] = [];
  const addMacros = (macros: MacroDefinition[], appliesTo: 'expense' | 'income') => {
    macros.forEach((macro, macroIndex) => {
      categories.push({
        id: macro.id,
        name: macro.name,
        appliesTo,
        parentId: null,
        icon: macro.icon,
        color: macro.color,
        sortOrder: macroIndex * 100,
        archived: false,
        system: true,
      });
      (macro.children ?? []).forEach(([id, name], childIndex) => {
        categories.push({
          id,
          name,
          appliesTo,
          parentId: macro.id,
          icon: macro.icon,
          color: macro.color,
          sortOrder: macroIndex * 100 + childIndex + 1,
          archived: false,
          system: true,
        });
      });
    });
  };
  addMacros(EXPENSE_MACROS, 'expense');
  addMacros(INCOME_MACROS, 'income');
  return categories;
}

export function buildDefaultTemplates(): SeedTemplate[] {
  const templates: [id: string, name: string, categoryId: string, favorite: boolean][] = [
    ['template-groceries', 'Supermercato', 'expense-food-groceries', true],
    ['template-fuel', 'Carburante', 'expense-transport-fuel', true],
    ['template-dinner', 'Cena fuori', 'expense-food-restaurants', true],
    ['template-pharmacy', 'Farmacia', 'expense-health-pharmacy', true],
    ['template-utilities', 'Bollette', 'expense-home-utilities', false],
    ['template-coffee', 'Bar e caffè', 'expense-food-restaurants', false],
    ['template-streaming', 'Streaming', 'expense-subscriptions-streaming', false],
    ['template-clothes', 'Abbigliamento', 'expense-shopping-clothes', false],
  ];
  return templates.map(([id, name, categoryId, favorite], index) => ({
    id,
    name,
    type: 'expense',
    description: name,
    categoryId,
    favorite,
    sortOrder: index,
    archived: false,
  }));
}
