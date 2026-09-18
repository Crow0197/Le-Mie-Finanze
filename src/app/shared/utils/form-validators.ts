import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { isLocalDate } from '../../domain/dates/local-date';
import { parseAmountToCents, parseSignedAmountToCents } from '../../domain/money/money';

/** Positive amount typed by the user, parsed to cents without floating point numbers. */
export const positiveAmountValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value.trim()) {
    return null;
  }
  const cents = parseAmountToCents(value);
  return cents !== null && cents > 0 ? null : { amount: true };
};

export const signedAmountValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value.trim()) {
    return null;
  }
  return parseSignedAmountToCents(value) === null ? { amount: true } : null;
};

export const localDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  return !value || isLocalDate(value) ? null : { date: true };
};

export function showControlError(control: AbstractControl): boolean {
  return control.invalid && control.touched;
}
