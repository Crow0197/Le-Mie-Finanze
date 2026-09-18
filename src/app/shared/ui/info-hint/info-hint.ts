import { Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { Icon } from '../icon/icon';

let nextHintId = 0;

const HINT_WIDTH = 260;
const VIEWPORT_MARGIN = 12;
const GAP = 8;

interface HintPosition {
  top: number;
  left: number;
  width: number;
}

@Component({
  selector: 'app-info-hint',
  imports: [Icon],
  host: {
    '(document:click)': 'closeIfOutside($event.target)',
    '(focusout)': 'closeIfOutside($event.relatedTarget)',
    '(window:scroll)': 'close()',
    '(window:resize)': 'close()',
  },
  template: `
    <button
      type="button"
      class="icon-button info-hint__trigger"
      [attr.aria-label]="'Informazioni su ' + label()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="hintId"
      (click)="toggle($event.currentTarget)"
      (keydown.escape)="close()"
    >
      <app-icon name="info" [size]="16" />
    </button>
    @if (position(); as place) {
      <p
        class="info-hint__text"
        role="note"
        [id]="hintId"
        [style.top.px]="place.top"
        [style.left.px]="place.left"
        [style.width.px]="place.width"
      >
        {{ text() }}
      </p>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .info-hint__trigger {
      width: 32px;
      height: 32px;
      margin: -6px;
    }

    .info-hint__text {
      position: fixed;
      z-index: 1200;
      margin: 0;
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
      color: var(--color-text);
      font-size: var(--font-size-sm);
      font-weight: 400;
      line-height: 1.45;
      text-align: left;
      white-space: normal;
    }
  `,
})
export class InfoHint {
  readonly label = input.required<string>();
  readonly text = input.required<string>();

  protected readonly hintId = `info-hint-${nextHintId++}`;
  /** Viewport coordinates of the open hint, kept inside the screen margins; null when closed. */
  protected readonly position = signal<HintPosition | null>(null);
  protected readonly open = computed(() => this.position() !== null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected toggle(trigger: EventTarget | null): void {
    if (this.open() || !(trigger instanceof HTMLElement)) {
      this.close();
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const width = Math.min(HINT_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
    const centeredLeft = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(Math.max(centeredLeft, VIEWPORT_MARGIN), viewportWidth - width - VIEWPORT_MARGIN);
    this.position.set({ top: rect.bottom + GAP, left, width });
  }

  protected close(): void {
    if (this.open()) {
      this.position.set(null);
    }
  }

  /** Closes the hint when a click or the focus moves anywhere outside it. */
  protected closeIfOutside(target: EventTarget | null): void {
    if (this.open() && !(target instanceof Node && this.host.nativeElement.contains(target))) {
      this.close();
    }
  }
}
