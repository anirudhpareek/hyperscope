import { useState } from 'preact/hooks';
import type { TrapRisk as TrapRiskState, MarketState } from '@/types/state';
import { formatPct } from '@/calculations/utils';

interface Props {
  trap: TrapRiskState;
  market: MarketState;
}

export function TrapRisk({ trap, market }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div class={`hl-section ${collapsed ? 'collapsed' : ''}`}>
      <div class="hl-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span class="hl-section-title">Trap Risk</span>
        <span class={`hl-section-badge ${trap.elevated ? 'badge-warning' : 'badge-neutral'}`}>
          {trap.elevated ? 'High' : 'Normal'}
        </span>
      </div>
      <div class="hl-section-content">
        {trap.elevated && (
          <div class="hl-alert warning">
            {trap.direction === 'long' ? 'Longs' : 'Shorts'} crowded
          </div>
        )}
        <div class="hl-row">
          <span class="hl-row-label">OI Δ</span>
          <span class={`hl-row-value ${trap.oiDelta > 10 ? 'warning' : ''}`}>
            {trap.oiDelta > 0 ? '+' : ''}{trap.oiDelta.toFixed(1)}%
          </span>
        </div>
        <div class="hl-row">
          <span class="hl-row-label">Funding</span>
          <span class={`hl-row-value ${Math.abs(market.fundingAnnualized) > 0.5 ? 'warning' : ''}`}>
            {formatPct(market.fundingAnnualized)}
          </span>
        </div>
      </div>
    </div>
  );
}
