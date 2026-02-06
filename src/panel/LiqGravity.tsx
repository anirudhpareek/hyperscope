import type { LiquidationGravity } from '@/types/state';
import { formatPct } from '@/calculations/utils';

interface Props {
  gravity: LiquidationGravity;
}

function getScoreLabel(score: LiquidationGravity['score']): string {
  switch (score) {
    case 'HIGH_ABOVE': return 'High Gravity Above';
    case 'HIGH_BELOW': return 'High Gravity Below';
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
  const indicatorPosition = gravity.score === 'HIGH_ABOVE'
    ? 'above'
    : gravity.score === 'HIGH_BELOW'
    ? 'below'
    : null;

  return (
    <div class="hl-section">
      <div class="hl-section-header">
        <span class="hl-section-title">Liquidation Gravity</span>
        <span class={`hl-section-badge ${getScoreBadgeClass(gravity.score)}`}>
          {getScoreLabel(gravity.score)}
        </span>
      </div>

      <div class="hl-gravity-bar">
        <span style={{ color: '#ef4444', fontSize: '10px' }}>Below</span>
        <div class="hl-gravity-visual">
          {indicatorPosition && (
            <div class={`hl-gravity-indicator ${indicatorPosition}`} />
          )}
        </div>
        <span style={{ color: '#22c55e', fontSize: '10px' }}>Above</span>
      </div>

      <div style={{ marginTop: '8px' }}>
        <div class="hl-row">
          <span class="hl-row-label">Nearest thin zone ↑</span>
          <span class={`hl-row-value ${gravity.nearestAbove ? '' : 'muted'}`}>
            {gravity.nearestAbove ? formatPct(gravity.nearestAbove) : '—'}
          </span>
        </div>
        <div class="hl-row">
          <span class="hl-row-label">Nearest thin zone ↓</span>
          <span class={`hl-row-value ${gravity.nearestBelow ? '' : 'muted'}`}>
            {gravity.nearestBelow ? formatPct(gravity.nearestBelow) : '—'}
          </span>
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
