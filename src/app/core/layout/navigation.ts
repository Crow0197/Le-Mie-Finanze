import { IconName } from '../../shared/ui/icon/icon';

export interface NavigationItem {
  id: string;
  path: string;
  label: string;
  icon: IconName;
  exact: boolean;
  /** Amministrazione cannot be hidden: it is where the sections are turned back on. */
  locked?: boolean;
}

/** Default order of the sections; the user can change it from Amministrazione. */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { id: 'dashboard', path: '/', label: 'Riepilogo', icon: 'house', exact: true },
  { id: 'transactions', path: '/movimenti', label: 'Movimenti', icon: 'list', exact: false },
  { id: 'recurring', path: '/pianificate', label: 'Pianificate', icon: 'calendar-clock', exact: false },
  { id: 'savings', path: '/risparmio', label: 'Risparmio', icon: 'piggy-bank', exact: false },
  { id: 'reports', path: '/resoconto', label: 'Resoconto', icon: 'chart-column', exact: false },
  { id: 'simulation', path: '/simulazione', label: 'Simulazione', icon: 'trending-up', exact: false },
  { id: 'advice', path: '/consigli', label: 'Consigli', icon: 'sparkles', exact: false },
  { id: 'challenges', path: '/sfide', label: 'Sfide', icon: 'star', exact: false },
  { id: 'accounts', path: '/conti', label: 'Conti', icon: 'landmark', exact: false },
  { id: 'administration', path: '/amministrazione', label: 'Amministrazione', icon: 'settings', exact: false, locked: true },
];
