import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'accesso',
    title: 'Accedi',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'recupera-password',
    title: 'Recupera password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/password-reset/password-reset').then((m) => m.PasswordReset),
  },
  {
    // Hidden page, not linked anywhere: lets the owner try the first setup as a brand new user.
    path: 'prova',
    title: 'Modalità prova',
    loadComponent: () => import('./features/test-mode/test-mode-page').then((m) => m.TestModePage),
  },
  {
    path: 'benvenuto',
    title: 'Benvenuto',
    canActivate: [authGuard],
    loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.Onboarding),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Riepilogo',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'movimenti',
        title: 'Movimenti',
        loadComponent: () =>
          import('./features/transactions/transactions-page/transactions-page').then((m) => m.TransactionsPage),
      },
      {
        path: 'pianificate',
        title: 'Pianificate',
        loadComponent: () => import('./features/recurring/recurring-page').then((m) => m.RecurringPage),
      },
      {
        path: 'risparmio',
        title: 'Risparmio',
        loadComponent: () => import('./features/savings/savings-page').then((m) => m.SavingsPage),
      },
      {
        path: 'resoconto',
        title: 'Resoconto',
        loadComponent: () => import('./features/reports/reports-page').then((m) => m.ReportsPage),
      },
      {
        path: 'simulazione',
        title: 'Simulazione',
        loadComponent: () => import('./features/simulation/simulation-page').then((m) => m.SimulationPage),
      },
      {
        path: 'consigli',
        title: 'Consigli',
        loadComponent: () => import('./features/advice/advice-page').then((m) => m.AdvicePage),
      },
      {
        path: 'sfide',
        title: 'Sfide',
        loadComponent: () => import('./features/challenges/challenges-page').then((m) => m.ChallengesPage),
      },
      {
        path: 'conti',
        title: 'Conti',
        loadComponent: () => import('./features/accounts/accounts-page').then((m) => m.AccountsPage),
      },
      {
        path: 'amministrazione',
        title: 'Amministrazione',
        loadComponent: () =>
          import('./features/administration/administration-page').then((m) => m.AdministrationPage),
      },
      {
        path: 'altro',
        title: 'Altro',
        loadComponent: () => import('./features/more/more').then((m) => m.More),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
