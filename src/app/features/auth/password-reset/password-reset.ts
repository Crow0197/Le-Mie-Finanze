import { Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { APP_INFO } from '../../../core/app-info';
import { AuthService } from '../../../core/auth/auth.service';
import { getFirebaseErrorMessage } from '../../../core/error-handling/firebase-error-message';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-password-reset',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './password-reset.html',
  styleUrl: '../auth-page.scss',
})
export class PasswordReset {
  private readonly authService = inject(AuthService);

  protected readonly appName = APP_INFO.name;
  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected showError(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.authService.sendPasswordReset(this.form.getRawValue().email);
      this.sent.set(true);
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }
}
