import { useState } from 'preact/hooks';
import type { CompressionState, VolatilityState } from '@/types/state';
import { formatPct } from '@/calculations/utils';

interface Props {
  compression: CompressionState;
  volatility: VolatilityState;
}

export function Compression({ compression, volatility }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { signals, isCompressed, score } = compression;

  return (
    <div class={`hl-section ${collapsed ? 'collapsed' : ''}`}>
      <div class="hl-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span class="hl-section-title">Compression</span>
        <span class={`hl-section-badge ${isCompressed ? 'badge-warning' : 'badge-neutral'}`}>
          {score}/4
        </span>
      </div>
      <div class="hl-section-content">
        {isCompressed && (
          <div class="hl-alert warning">Expansion likely</div>
        )}
        <div class="hl-signals">
          <div class={`hl-signal ${signals.rangeNarrowing ? 'active' : ''}`}>
            <span class="hl-signal-dot" />
            <span>Range</span>
          </div>
          <div class={`hl-signal ${signals.oiRising ? 'active' : ''}`}>
            <span class="hl-signal-dot" />
            <span>OI ↑</span>
          </div>
          <div class={`hl-signal ${signals.fundingExtreme ? 'active' : ''}`}>
            <span class="hl-signal-dot" />
            <span>Funding</span>
          </div>
          <div class={`hl-signal ${signals.volumeDeclining ? 'active' : ''}`}>
            <span class="hl-signal-dot" />
            <span>Vol ↓</span>
          </div>
        </div>
        <div class="hl-row">
          <span class="hl-row-label">BB Width</span>
          <span class={`hl-row-value ${volatility.bbWidthPercentile < 0.2 ? 'warning' : ''}`}>
            {formatPct(volatility.bbWidthPercentile)}
          </span>
        </div>
      </div>
    </div>
  );
}
