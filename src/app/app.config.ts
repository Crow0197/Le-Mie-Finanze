import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { provideFirebase } from './core/firebase/firebase.providers';
import { AppTitleStrategy } from './core/layout/app-title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideFirebase(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
