import type { CompressionState, VolatilityState } from '@/types/state';
import { formatPct } from '@/calculations/utils';

interface Props {
  compression: CompressionState;
  volatility: VolatilityState;
}

export function Compression({ compression, volatility }: Props) {
  const { signals, isCompressed, score } = compression;

  return (
    <div class="hl-section">
      <div class="hl-section-header">
        <span class="hl-section-title">Volatility Compression</span>
        <span class={`hl-section-badge ${isCompressed ? 'badge-warning' : 'badge-neutral'}`}>
          {score}/4 signals
        </span>
      </div>

      {isCompressed && (
        <div class="hl-alert warning">
          Expansion probability elevated
        </div>
      )}

      <div class="hl-signals">
        <div class={`hl-signal ${signals.rangeNarrowing ? 'active' : ''}`}>
          <span class="hl-signal-dot" />
          <span>Range narrow</span>
        </div>
        <div class={`hl-signal ${signals.oiRising ? 'active' : ''}`}>
          <span class="hl-signal-dot" />
          <span>OI rising</span>
        </div>
        <div class={`hl-signal ${signals.fundingExtreme ? 'active' : ''}`}>
          <span class="hl-signal-dot" />
          <span>Funding extreme</span>
        </div>
        <div class={`hl-signal ${signals.volumeDeclining ? 'active' : ''}`}>
          <span class="hl-signal-dot" />
          <span>Volume declining</span>
        </div>
      </div>

      <div style={{ marginTop: '8px' }}>
        <div class="hl-row">
          <span class="hl-row-label">BB Width %ile</span>
          <span class={`hl-row-value ${volatility.bbWidthPercentile < 0.2 ? 'warning' : ''}`}>
            {formatPct(volatility.bbWidthPercentile)}
          </span>
        </div>
        <div class="hl-row">
          <span class="hl-row-label">24h Range</span>
          <span class="hl-row-value">{formatPct(volatility.range24h)}</span>
        </div>
      </div>
    </div>
  );
}
