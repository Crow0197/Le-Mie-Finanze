/** Order and visibility of the sections, as chosen by the user. */
export interface NavigationPreference {
  id: string;
  visible: boolean;
}

export interface NavigationEntry<T> {
  item: T;
  visible: boolean;
}

/**
 * Applies the saved preferences to the known sections: the saved order comes first, sections added
 * later are appended at the end, and locked sections stay visible so the settings remain reachable.
 */
export function resolveNavigation<T extends { id: string; locked?: boolean }>(
  definitions: readonly T[],
  preferences: readonly NavigationPreference[] | undefined,
): NavigationEntry<T>[] {
  const remaining = new Map(definitions.map((item) => [item.id, item]));
  const entries: NavigationEntry<T>[] = [];
  for (const preference of preferences ?? []) {
    const item = remaining.get(preference.id);
    if (item) {
      remaining.delete(preference.id);
      entries.push({ item, visible: item.locked ? true : preference.visible });
    }
  }
  for (const item of definitions) {
    if (remaining.has(item.id)) {
      entries.push({ item, visible: true });
    }
  }
  return entries;
}
