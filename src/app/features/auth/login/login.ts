import { Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { APP_INFO } from '../../../core/app-info';
import { AuthService } from '../../../core/auth/auth.service';
import { getFirebaseErrorMessage } from '../../../core/error-handling/firebase-error-message';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './login.html',
  styleUrl: '../auth-page.scss',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly appName = APP_INFO.name;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected showError(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    await this.run(() => this.authService.signIn(email, password));
  }

  protected async signInWithGoogle(): Promise<void> {
    await this.run(() => this.authService.signInWithGoogle());
  }

  private async run(signIn: () => Promise<void>): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await signIn();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(getFirebaseErrorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }
}
