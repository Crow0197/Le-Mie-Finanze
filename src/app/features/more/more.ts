import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { getFirebaseErrorMessage } from '../../core/error-handling/firebase-error-message';
import { UserDataStore } from '../../core/state/user-data.store';
import { ViewPeriodService } from '../../core/state/view-period.service';
import { VIEW_PERIOD_LABELS, ViewPeriodPreset } from '../../domain/models/user-settings';
import { Icon, IconName } from '../../shared/ui/icon/icon';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';

interface MoreLink {
  path: string;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-more',
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './more.html',
  styleUrl: './more.scss',
})
export class More {
  private readonly authService = inject(AuthService);
  private readonly store = inject(UserDataStore);
  private readonly snackbar = inject(SnackbarService);
  protected readonly viewPeriod = inject(ViewPeriodService);

  protected readonly user = this.authService.user;
  protected readonly displayName = computed(() => this.store.settings()?.displayName || this.user()?.displayName || 'Profilo');
  protected readonly presets = Object.keys(VIEW_PERIOD_LABELS) as ViewPeriodPreset[];
  protected readonly presetLabels = VIEW_PERIOD_LABELS;
  protected readonly preset = signal<ViewPeriodPreset>('all');
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly saving = signal(false);

  protected readonly links: readonly MoreLink[] = [
    { path: '/resoconto', label: 'Resoconto', icon: 'chart-column' },
    { path: '/conti', label: 'Conti', icon: 'landmark' },
    { path: '/pianificate', label: 'Pianificate', icon: 'calendar-clock' },
    { path: '/amministrazione', label: 'Amministrazione', icon: 'settings' },
  ];

  constructor() {
    effect(() => {
      const period = this.viewPeriod.period();
      this.preset.set(period.preset);
      this.startDate.set(period.startDate ?? '');
      this.endDate.set(period.endDate ?? '');
    });
  }

  protected async savePeriod(): Promise<void> {
    const preset = this.preset();
    if (preset === 'custom' && (!this.startDate() || !this.endDate() || this.endDate() < this.startDate())) {
      this.snackbar.show('Scegli una data iniziale e una finale valide.');
      return;
    }
    this.saving.set(true);
    try {
      await this.viewPeriod.update(
        preset === 'custom' ? { preset, startDate: this.startDate(), endDate: this.endDate() } : { preset },
      );
      this.snackbar.show(`Periodo impostato: ${this.viewPeriod.label()}.`);
    } catch (error) {
      this.snackbar.show(getFirebaseErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected signOut(): void {
    void this.authService.signOut();
  }
}
