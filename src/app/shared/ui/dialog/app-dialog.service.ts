import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';

/**
 * Opens a centered modal dialog on every screen size, with focus trap and focus restore.
 * The panel scrolls internally, so long forms stay usable on small phones.
 */
@Injectable({ providedIn: 'root' })
export class AppDialogService {
  private readonly dialog = inject(Dialog);

  open<R, D = unknown, C = unknown>(component: ComponentType<C>, data?: D, ariaLabelledBy?: string): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(component, {
      data,
      ariaLabelledBy,
      panelClass: 'dialog-panel',
      maxWidth: '100vw',
      // Set inline: the CDK overlay stylesheet would otherwise force max-height: 100%.
      maxHeight: 'calc(100dvh - 48px)',
      restoreFocus: true,
    });
  }
}
