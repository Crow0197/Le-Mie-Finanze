import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <div class="dialog">
      <h2 id="confirm-dialog-title">{{ data.title }}</h2>
      <p class="dialog__text">{{ data.message }}</p>
      <div class="dialog__footer">
        <button type="button" class="button button--secondary" (click)="dialogRef.close(false)">Annulla</button>
        <button
          type="button"
          class="button"
          [class.button--danger]="data.danger"
          [class.button--primary]="!data.danger"
          (click)="dialogRef.close(true)"
        >
          {{ data.confirmLabel }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
}
