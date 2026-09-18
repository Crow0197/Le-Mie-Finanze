import { Component, input } from '@angular/core';
import { formatCents } from '../../domain/money/money';

const DONUT_RADIUS = 62;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
/** Surface gap between adjacent slices. */
const DONUT_GAP = 2;

export interface DonutItem {
  key: string;
  name: string;
  color: string;
  amountCents: number;
}

export interface DonutSlice extends DonutItem {
  percent: number;
  dasharray: string;
  dashoffset: number;
  tooltip: string;
}

/** Converts amounts into stroke-dasharray slices of a single circle, starting at 12 o'clock. */
export function buildDonutSlices(items: readonly DonutItem[]): DonutSlice[] {
  const totalCents = items.reduce((total, item) => total + item.amountCents, 0);
  if (totalCents <= 0) {
    return [];
  }
  const visibleItems = items.filter((item) => item.amountCents > 0);
  let offset = 0;
  return visibleItems.map((item) => {
    const length = (item.amountCents / totalCents) * DONUT_CIRCUMFERENCE;
    const visibleLength = visibleItems.length > 1 ? Math.max(0, length - DONUT_GAP) : length;
    const percent = Math.round((item.amountCents / totalCents) * 100);
    const slice: DonutSlice = {
      ...item,
      percent,
      dasharray: `${visibleLength} ${DONUT_CIRCUMFERENCE}`,
      dashoffset: -offset,
      tooltip: `${item.name}: ${formatCents(item.amountCents)} (${percent}%)`,
    };
    offset += length;
    return slice;
  });
}

@Component({
  selector: 'app-donut-chart',
  template: `
    <svg class="donut" viewBox="0 0 160 160" role="img" [attr.aria-label]="ariaLabel()">
      <circle class="donut__track" cx="80" cy="80" [attr.r]="radius" />
      @for (slice of slices(); track slice.key) {
        <circle
          class="donut__slice"
          cx="80"
          cy="80"
          [attr.r]="radius"
          [style.stroke]="slice.color"
          [attr.stroke-dasharray]="slice.dasharray"
          [attr.stroke-dashoffset]="slice.dashoffset"
          transform="rotate(-90 80 80)"
        >
          <title>{{ slice.tooltip }}</title>
        </circle>
      }
      <text class="donut__value" x="80" y="80" text-anchor="middle">{{ centerValue() }}</text>
      <text class="donut__label" x="80" y="100" text-anchor="middle">{{ centerLabel() }}</text>
    </svg>
  `,
  styles: `
    :host {
      display: block;
      flex: none;
      width: 160px;
      height: 160px;
    }

    .donut {
      display: block;
      width: 100%;
      height: 100%;
    }

    .donut__track {
      fill: none;
      stroke: var(--color-surface-soft);
      stroke-width: 18;
    }

    .donut__slice {
      fill: none;
      stroke-width: 18;
      transition: stroke-width 120ms ease;
      cursor: default;
    }

    .donut__slice:hover {
      stroke-width: 24;
    }

    .donut__value {
      fill: var(--color-text);
      font-size: 20px;
      font-weight: 700;
    }

    .donut__label {
      fill: var(--color-text-muted);
      font-size: 11px;
    }
  `,
})
export class DonutChart {
  readonly slices = input.required<DonutSlice[]>();
  readonly ariaLabel = input.required<string>();
  readonly centerValue = input('');
  readonly centerLabel = input('');

  protected readonly radius = DONUT_RADIUS;
}
