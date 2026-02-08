import { useState } from 'preact/hooks';
import type { LiquidationGravity } from '@/types/state';

interface Props {
  gravity: LiquidationGravity;
}

function getScoreLabel(score: LiquidationGravity['score']): string {
  switch (score) {
    case 'HIGH_ABOVE': return 'Above';
    case 'HIGH_BELOW': return 'Below';
    default: return 'Balanced';
  }
}

function getScoreBadgeClass(score: LiquidationGravity['score']): string {
  switch (score) {
    case 'HIGH_ABOVE': return 'badge-positive';
    case 'HIGH_BELOW': return 'badge-negative';
    default: return 'badge-neutral';
  }
}

export function LiqGravity({ gravity }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const indicatorPosition = gravity.score === 'HIGH_ABOVE' ? 'above' : gravity.score === 'HIGH_BELOW' ? 'below' : null;

  return (
    <div class={`hl-section ${collapsed ? 'collapsed' : ''}`}>
      <div class="hl-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span class="hl-section-title">Liq Gravity</span>
        <span class={`hl-section-badge ${getScoreBadgeClass(gravity.score)}`}>
          {getScoreLabel(gravity.score)}
        </span>
      </div>
      <div class="hl-section-content">
        <div class="hl-gravity-bar">
          <span style="color: #ef4444; font-size: 9px">↓</span>
          <div class="hl-gravity-visual">
            {indicatorPosition && <div class={`hl-gravity-indicator ${indicatorPosition}`} />}
          </div>
          <span style="color: #22c55e; font-size: 9px">↑</span>
        </div>
        <div class="hl-row">
          <span class="hl-row-label">Depth ratio</span>
          <span class="hl-row-value">
            {(gravity.densityBelow * 100).toFixed(0)}% / {(gravity.densityAbove * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}
