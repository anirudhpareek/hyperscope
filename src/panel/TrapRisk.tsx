import type { TrapRisk as TrapRiskState, MarketState } from '@/types/state';
import { formatPct } from '@/calculations/utils';

interface Props {
  trap: TrapRiskState;
  market: MarketState;
}

function getDirectionLabel(dir: 'long' | 'short' | null): string {
  if (dir === 'long') return 'Longs crowded';
  if (dir === 'short') return 'Shorts crowded';
  return '—';
}

export function TrapRisk({ trap, market }: Props) {
  return (
    <div class="hl-section">
      <div class="hl-section-header">
        <span class="hl-section-title">Trap Risk</span>
        <span class={`hl-section-badge ${trap.elevated ? 'badge-warning' : 'badge-neutral'}`}>
          {trap.elevated ? 'Elevated' : 'Normal'}
        </span>
      </div>

      {trap.elevated && (
        <div class="hl-alert warning">
          Crowded positioning. Squeeze risk elevated.
        </div>
      )}

      <div style={{ marginTop: '4px' }}>
        <div class="hl-row">
          <span class="hl-row-label">OI Change</span>
          <span class={`hl-row-value ${trap.oiDelta > 10 ? 'warning' : ''}`}>
            {trap.oiDelta > 0 ? '+' : ''}{trap.oiDelta.toFixed(1)}%
          </span>
        </div>
        <div class="hl-row">
          <span class="hl-row-label">Funding σ</span>
          <span class={`hl-row-value ${Math.abs(trap.fundingDeviation) > 2 ? 'warning' : ''}`}>
            {trap.fundingDeviation > 0 ? '+' : ''}{trap.fundingDeviation.toFixed(2)}
          </span>
        </div>
        <div class="hl-row">
          <span class="hl-row-label">Price Move</span>
          <span class="hl-row-value">
            {trap.priceMovement > 0 ? '+' : ''}{trap.priceMovement.toFixed(2)}%
          </span>
        </div>
        <div class="hl-row">
          <span class="hl-row-label">Funding (ann.)</span>
          <span class={`hl-row-value ${Math.abs(market.fundingAnnualized) > 0.5 ? 'warning' : ''}`}>
            {formatPct(market.fundingAnnualized)}
          </span>
        </div>
        {trap.elevated && (
          <div class="hl-row">
            <span class="hl-row-label">Direction</span>
            <span class={`hl-row-value ${trap.direction === 'long' ? 'positive' : 'negative'}`}>
              {getDirectionLabel(trap.direction)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
