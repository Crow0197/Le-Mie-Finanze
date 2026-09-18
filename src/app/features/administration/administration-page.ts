import { Component } from '@angular/core';
import { CategoriesSection } from './categories-section';
import { DataSection } from './data-section';
import { SettingsSection } from './settings-section';
import { TemplatesSection } from './templates-section';

@Component({
  selector: 'app-administration-page',
  imports: [SettingsSection, CategoriesSection, TemplatesSection, DataSection],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>Amministrazione</h1>
          <p class="page-header__subtitle">Impostazioni, categorie, modelli rapidi e backup dei dati.</p>
        </div>
      </header>
      <app-settings-section />
      <app-categories-section />
      <app-templates-section />
      <app-data-section />
      <p class="muted">
        Le mie finanze è uno strumento personale: non sostituisce gli estratti conto né una consulenza finanziaria.
      </p>
    </section>
  `,
})
export class AdministrationPage {}
