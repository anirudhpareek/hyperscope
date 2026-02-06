import type { PressureMap as PressureMapState, MarketState } from '@/types/state';
import { formatNumber } from '@/calculations/utils';

interface Props {
  pressure: PressureMapState;
  market: MarketState;
}

function getImpactLabel(impact: 'positive' | 'negative' | 'neutral'): string {
  switch (impact) {
    case 'positive': return 'Favorable';
    case 'negative': return 'Unfavorable';
    default: return 'Neutral';
  }
}

function getBeneficiaryLabel(b: 'longs' | 'shorts' | 'neutral'): string {
  switch (b) {
    case 'longs': return 'Longs';
    case 'shorts': return 'Shorts';
    default: return 'Neutral';
  }
}

export function PressureMap({ pressure, market }: Props) {
  const upPrice = market.price * 1.05;
  const downPrice = market.price * 0.95;

  return (
    <div class="hl-section">
      <div class="hl-section-header">
        <span class="hl-section-title">Pressure Map (±5%)</span>
      </div>

      {/* Upside scenario */}
      <div class="hl-pressure-block">
        <div class="hl-pressure-direction up">
          <span class="arrow">▲</span>
          <span>${formatNumber(upPrice, 0)}</span>
        </div>
        <div class="hl-pressure-detail">
          <span>Short Liq Est</span>
          <span>${formatNumber(pressure.upside.liqEstimate)}</span>
        </div>
        <div class="hl-pressure-detail">
          <span>Funding Impact</span>
          <span>{getImpactLabel(pressure.upside.fundingImpact)}</span>
        </div>
        <div class="hl-pressure-detail">
          <span>OI Implication</span>
          <span>{pressure.upside.oiImplication.split('→')[0].trim()}</span>
        </div>
        <div class="hl-pressure-detail">
          <span>Benefits</span>
          <span>{getBeneficiaryLabel(pressure.upside.structuralBeneficiary)}</span>
        </div>
      </div>

      {/* Downside scenario */}
      <div class="hl-pressure-block">
        <div class="hl-pressure-direction down">
          <span class="arrow">▼</span>
          <span>${formatNumber(downPrice, 0)}</span>
        </div>
        <div class="hl-pressure-detail">
          <span>Long Liq Est</span>
          <span>${formatNumber(pressure.downside.liqEstimate)}</span>
        </div>
        <div class="hl-pressure-detail">
          <span>Funding Impact</span>
          <span>{getImpactLabel(pressure.downside.fundingImpact)}</span>
        </div>
        <div class="hl-pressure-detail">
          <span>OI Implication</span>
          <span>{pressure.downside.oiImplication.split('→')[0].trim()}</span>
        </div>
        <div class="hl-pressure-detail">
          <span>Trap Risk</span>
          <span>{getBeneficiaryLabel(pressure.downside.trapRisk)}</span>
        </div>
      </div>
    </div>
  );
}
