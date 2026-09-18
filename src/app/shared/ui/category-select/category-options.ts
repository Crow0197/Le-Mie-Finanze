import { Category } from '../../../domain/models/category';

export interface CategoryOptionGroup {
  macro: Category;
  children: Category[];
}

/**
 * Macro categories with their sub categories for the given transaction type.
 * Archived categories are hidden unless they are the current value of an existing record.
 */
export function buildCategoryOptionGroups(
  categories: readonly Category[],
  type: 'expense' | 'income',
  currentId?: string,
): CategoryOptionGroup[] {
  const visible = (category: Category) =>
    (category.appliesTo === type || category.appliesTo === 'both') && (!category.archived || category.id === currentId);
  return categories
    .filter((category) => category.parentId === null && visible(category))
    .map((macro) => ({
      macro,
      children: categories.filter((category) => category.parentId === macro.id && visible(category)),
    }));
}
