import { useState } from 'preact/hooks';
import type { PressureMap as PressureMapState, MarketState } from '@/types/state';
import { formatNumber } from '@/calculations/utils';

interface Props {
  pressure: PressureMapState;
  market: MarketState;
}

export function PressureMap({ pressure, market }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const upPrice = market.price * 1.05;
  const downPrice = market.price * 0.95;

  return (
    <div class={`hl-section ${collapsed ? 'collapsed' : ''}`}>
      <div class="hl-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span class="hl-section-title">Pressure ±5%</span>
      </div>
      <div class="hl-section-content">
        <div class="hl-pressure-block">
          <div class="hl-pressure-direction up">
            <span class="arrow">▲</span>
            <span>${formatNumber(upPrice, 0)}</span>
            <span style="color: #555; margin-left: auto">~${formatNumber(pressure.upside.liqEstimate)} liq</span>
          </div>
        </div>
        <div class="hl-pressure-block">
          <div class="hl-pressure-direction down">
            <span class="arrow">▼</span>
            <span>${formatNumber(downPrice, 0)}</span>
            <span style="color: #555; margin-left: auto">~${formatNumber(pressure.downside.liqEstimate)} liq</span>
          </div>
        </div>
      </div>
    </div>
  );
}
