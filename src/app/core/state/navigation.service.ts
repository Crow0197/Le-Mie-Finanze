import { Injectable, computed, inject } from '@angular/core';
import { NavigationPreference, resolveNavigation } from '../../domain/navigation/navigation';
import { NAVIGATION_ITEMS } from '../layout/navigation';
import { UserDataStore } from './user-data.store';

/** Sections shown in the bar at the bottom of the phone, besides Altro and the add button. */
const BOTTOM_NAV_COUNT = 3;

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly store = inject(UserDataStore);

  /** Every section with its visibility, in the order chosen by the user. */
  readonly entries = computed(() => resolveNavigation(NAVIGATION_ITEMS, this.store.settings()?.navigation));
  readonly items = computed(() => this.entries().filter((entry) => entry.visible).map((entry) => entry.item));

  readonly bottomStart = computed(() => this.items().slice(0, BOTTOM_NAV_COUNT - 1));
  readonly bottomEnd = computed(() => this.items().slice(BOTTOM_NAV_COUNT - 1, BOTTOM_NAV_COUNT));
  readonly moreItems = computed(() => this.items().slice(BOTTOM_NAV_COUNT));

  async save(navigation: readonly NavigationPreference[]): Promise<void> {
    await this.store.updateSettings({ navigation: [...navigation] });
  }
}
