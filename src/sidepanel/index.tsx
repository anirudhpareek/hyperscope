import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { AnalyticsState } from '@/types/state';
import { formatNumber, formatPct } from '@/calculations/utils';

function SidePanel() {
  const [state, setState] = useState<AnalyticsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    console.log('[SP] SidePanel mounting...');

    // Connect to background
    const port = chrome.runtime.connect({ name: 'hl-sidepanel' });
    console.log('[SP] Connected to background');

    port.onMessage.addListener((msg) => {
      console.log('[SP] Received message:', msg.type, msg.payload ? 'has payload' : 'no payload');
      if (msg.type === 'STATE_UPDATE' && msg.payload) {
        setState(msg.payload);
        setLoading(false);
      }
    });

    // Request current state
    port.postMessage({ type: 'GET_STATE' });
    console.log('[SP] Sent GET_STATE');

    // Get current tab and subscribe to its coin
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log('[SP] Got tabs:', tabs.length, tabs[0]?.url);
      const tab = tabs[0];
      if (tab?.url?.includes('app.hyperliquid.xyz')) {
        const match = tab.url.match(/\/trade\/([A-Z0-9]+)/i);
        console.log('[SP] URL match:', match);
        if (match) {
          const coin = match[1].toUpperCase();
          console.log('[SP] Subscribing to coin:', coin);
          port.postMessage({ type: 'SUBSCRIBE', payload: { coin } });
        }
      } else {
        // Default to BTC if not on a trade page
        console.log('[SP] Not on trade page, defaulting to BTC');
        port.postMessage({ type: 'SUBSCRIBE', payload: { coin: 'BTC' } });
      }
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url?.includes('app.hyperliquid.xyz')) {
        const match = changeInfo.url.match(/\/trade\/([A-Z0-9]+)/i);
        if (match) {
          port.postMessage({ type: 'SUBSCRIBE', payload: { coin: match[1].toUpperCase() } });
        }
      }
    });

    return () => port.disconnect();
  }, []);

  const toggle = (section: string) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div class="hl-sidepanel">
        <div class="hl-header">
          <span class="hl-header-title">HL Analytics</span>
        </div>
        <div class="hl-loading">
          <div class="hl-loading-spinner" />
          <span class="hl-loading-text">Loading...</span>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div class="hl-sidepanel">
        <div class="hl-header">
          <span class="hl-header-title">HL Analytics</span>
        </div>
        <div class="hl-no-data">
          <div class="hl-no-data-icon">📊</div>
          <div class="hl-no-data-text">No data available</div>
          <div class="hl-no-data-hint">Open Hyperliquid trading page</div>
        </div>
      </div>
    );
  }

  const { market, pressure, gravity, compression, trap, orderbook, volatility, cvd, tape, oiDivergence } = state;

  // Helper to format large numbers compactly
  const formatCompact = (n: number): string => {
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toFixed(1);
  };

  // CVD momentum color
  const getCvdMomentumColor = (momentum: string): string => {
    if (momentum === 'strong_buy') return 'positive';
    if (momentum === 'buy') return 'positive';
    if (momentum === 'strong_sell') return 'negative';
    if (momentum === 'sell') return 'negative';
    return '';
  };

  // OI Divergence pattern label
  const getOiPatternLabel = (pattern: string | null): string => {
    switch (pattern) {
      case 'short_covering': return 'Short Covering';
      case 'new_shorts': return 'New Shorts';
      case 'new_longs': return 'New Longs';
      case 'long_liquidation': return 'Long Liquidation';
      default: return 'Neutral';
    }
  };

  return (
    <div class="hl-sidepanel">
      {/* Header */}
      <div class="hl-header">
        <span class="hl-header-title">HL Analytics</span>
        <div class="hl-header-coin">
          <span class="live-dot" />
          <span>{state.coin}</span>
        </div>
      </div>

      {/* Stats */}
      <div class="hl-stats">
        <div class="hl-stat">
          <div class="hl-stat-value">${formatNumber(market.price)}</div>
          <div class="hl-stat-label">Price</div>
        </div>
        <div class="hl-stat">
          <div class="hl-stat-value">${formatNumber(market.openInterest * market.price)}</div>
          <div class="hl-stat-label">Open Interest</div>
        </div>
        <div class="hl-stat">
          <div class={`hl-stat-value ${orderbook.imbalance > 0.15 ? 'positive' : orderbook.imbalance < -0.15 ? 'negative' : ''}`}>
            {(orderbook.imbalance * 100).toFixed(0)}%
          </div>
          <div class="hl-stat-label">Book Imbalance</div>
        </div>
        <div class="hl-stat">
          <div class={`hl-stat-value ${Math.abs(market.fundingAnnualized) > 0.5 ? 'warning' : ''}`}>
            {formatPct(market.fundingAnnualized)}
          </div>
          <div class="hl-stat-label">Funding (Ann.)</div>
        </div>
      </div>

      {/* CVD (Cumulative Volume Delta) */}
      <div class={`hl-section ${collapsed.cvd ? 'collapsed' : ''}`}>
        <div class="hl-section-header" onClick={() => toggle('cvd')}>
          <span class="hl-section-title">Order Flow (CVD)</span>
          <span class={`hl-section-badge ${getCvdMomentumColor(cvd.momentum)}`}>
            {cvd.momentum.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <div class="hl-section-content">
          {cvd.divergence && (
            <div class={`hl-alert ${cvd.divergence === 'bullish' ? 'bullish' : 'bearish'}`}>
              {cvd.divergence === 'bullish' ? 'Bullish' : 'Bearish'} divergence detected
            </div>
          )}
          <div class="hl-cvd-deltas">
            <div class="hl-cvd-delta">
              <span class="hl-cvd-label">5m</span>
              <span class={`hl-cvd-value ${cvd.delta5m > 0 ? 'positive' : cvd.delta5m < 0 ? 'negative' : ''}`}>
                {cvd.delta5m > 0 ? '+' : ''}{formatCompact(cvd.delta5m)}
              </span>
            </div>
            <div class="hl-cvd-delta">
              <span class="hl-cvd-label">15m</span>
              <span class={`hl-cvd-value ${cvd.delta15m > 0 ? 'positive' : cvd.delta15m < 0 ? 'negative' : ''}`}>
                {cvd.delta15m > 0 ? '+' : ''}{formatCompact(cvd.delta15m)}
              </span>
            </div>
            <div class="hl-cvd-delta">
              <span class="hl-cvd-label">1h</span>
              <span class={`hl-cvd-value ${cvd.delta1h > 0 ? 'positive' : cvd.delta1h < 0 ? 'negative' : ''}`}>
                {cvd.delta1h > 0 ? '+' : ''}{formatCompact(cvd.delta1h)}
              </span>
            </div>
          </div>
          <div class="hl-cvd-bar">
            <div
              class="hl-cvd-bar-fill"
              style={`width: ${Math.min(Math.abs(cvd.delta5m) / (Math.abs(cvd.delta15m) || 1) * 50, 100)}%; background: ${cvd.delta5m > 0 ? '#22c55e' : '#ef4444'}`}
            />
          </div>
        </div>
      </div>

      {/* Trade Tape / Whale Activity */}
      <div class={`hl-section ${collapsed.tape ? 'collapsed' : ''}`}>
        <div class="hl-section-header" onClick={() => toggle('tape')}>
          <span class="hl-section-title">Whale Activity</span>
          <span class={`hl-section-badge ${tape.whaleCount5m > 3 ? 'badge-warning' : 'badge-neutral'}`}>
            {tape.whaleCount5m} whales (5m)
          </span>
        </div>
        <div class="hl-section-content">
          <div class="hl-tape-intensity">
            <div class="hl-tape-bar">
              <div class="hl-tape-buy" style={`width: ${tape.buyIntensity}%`} />
              <div class="hl-tape-sell" style={`width: ${tape.sellIntensity}%`} />
            </div>
            <div class="hl-tape-labels">
              <span class="positive">{tape.buyIntensity}% Buy</span>
              <span class="negative">{tape.sellIntensity}% Sell</span>
            </div>
          </div>
          <div class="hl-row">
            <span class="hl-row-label">Whale Buys</span>
            <span class="hl-row-value positive">${formatCompact(tape.whaleBuyVolume)}</span>
          </div>
          <div class="hl-row">
            <span class="hl-row-label">Whale Sells</span>
            <span class="hl-row-value negative">${formatCompact(tape.whaleSellVolume)}</span>
          </div>
          {tape.lastWhale && (
            <div class="hl-last-whale">
              <span class={tape.lastWhale.side === 'buy' ? 'positive' : 'negative'}>
                Last: ${formatCompact(tape.lastWhale.notional)} {tape.lastWhale.side.toUpperCase()}
              </span>
              <span class="hl-whale-time">
                {new Date(tape.lastWhale.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* OI × Price Divergence */}
      <div class={`hl-section ${collapsed.oiDiv ? 'collapsed' : ''}`}>
        <div class="hl-section-header" onClick={() => toggle('oiDiv')}>
          <span class="hl-section-title">OI × Price</span>
          <span class={`hl-section-badge ${oiDivergence.pattern === 'new_longs' ? 'badge-positive' : oiDivergence.pattern === 'new_shorts' || oiDivergence.pattern === 'long_liquidation' ? 'badge-negative' : 'badge-neutral'}`}>
            {getOiPatternLabel(oiDivergence.pattern)}
          </span>
        </div>
        <div class="hl-section-content">
          <div class="hl-divergence-meter">
            <div class="hl-divergence-track">
              <div
                class="hl-divergence-fill"
                style={`width: ${Math.abs(oiDivergence.score)}%; margin-left: ${oiDivergence.score >= 0 ? '50%' : `${50 - Math.abs(oiDivergence.score)}%`}; background: ${oiDivergence.score >= 0 ? '#22c55e' : '#ef4444'}`}
              />
              <div class="hl-divergence-center" />
            </div>
            <div class="hl-divergence-labels">
              <span>Bearish</span>
              <span>Bullish</span>
            </div>
          </div>
          <div class="hl-row">
            <span class="hl-row-label">Price (1h)</span>
            <span class={`hl-row-value ${oiDivergence.priceChange > 0 ? 'positive' : oiDivergence.priceChange < 0 ? 'negative' : ''}`}>
              {oiDivergence.priceChange > 0 ? '+' : ''}{oiDivergence.priceChange.toFixed(2)}%
            </span>
          </div>
          <div class="hl-row">
            <span class="hl-row-label">OI (1h)</span>
            <span class={`hl-row-value ${oiDivergence.oiChange > 0 ? 'positive' : oiDivergence.oiChange < 0 ? 'negative' : ''}`}>
              {oiDivergence.oiChange > 0 ? '+' : ''}{oiDivergence.oiChange.toFixed(2)}%
            </span>
          </div>
          <div class="hl-row">
            <span class="hl-row-label">Strength</span>
            <span class="hl-row-value">{oiDivergence.strength.charAt(0).toUpperCase() + oiDivergence.strength.slice(1)}</span>
          </div>
        </div>
      </div>

      {/* Pressure Map */}
      <div class={`hl-section ${collapsed.pressure ? 'collapsed' : ''}`}>
        <div class="hl-section-header" onClick={() => toggle('pressure')}>
          <span class="hl-section-title">Pressure Map ±5%</span>
        </div>
        <div class="hl-section-content">
          <div class="hl-pressure-item">
            <div class="hl-pressure-left">
              <span class="hl-pressure-arrow up">▲</span>
              <span class="hl-pressure-price">${formatNumber(market.price * 1.05, 0)}</span>
            </div>
            <span class="hl-pressure-liq">~${formatNumber(pressure.upside.liqEstimate)} liq</span>
          </div>
          <div class="hl-pressure-item">
            <div class="hl-pressure-left">
              <span class="hl-pressure-arrow down">▼</span>
              <span class="hl-pressure-price">${formatNumber(market.price * 0.95, 0)}</span>
            </div>
            <span class="hl-pressure-liq">~${formatNumber(pressure.downside.liqEstimate)} liq</span>
          </div>
        </div>
      </div>

      {/* Liquidation Gravity */}
      <div class={`hl-section ${collapsed.gravity ? 'collapsed' : ''}`}>
        <div class="hl-section-header" onClick={() => toggle('gravity')}>
          <span class="hl-section-title">Liquidation Gravity</span>
          <span class={`hl-section-badge ${gravity.score === 'HIGH_ABOVE' ? 'badge-positive' : gravity.score === 'HIGH_BELOW' ? 'badge-negative' : 'badge-neutral'}`}>
            {gravity.score === 'HIGH_ABOVE' ? 'Above' : gravity.score === 'HIGH_BELOW' ? 'Below' : 'Balanced'}
          </span>
        </div>
        <div class="hl-section-content">
          <div class="hl-gravity-bar">
            <span class="hl-gravity-label below">{(gravity.densityBelow * 100).toFixed(0)}%</span>
            <div class="hl-gravity-track">
              {gravity.score === 'HIGH_BELOW' && <div class="hl-gravity-fill left" style="width: 60%" />}
              {gravity.score === 'HIGH_ABOVE' && <div class="hl-gravity-fill right" style="width: 60%" />}
            </div>
            <span class="hl-gravity-label above">{(gravity.densityAbove * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Volatility Compression */}
      <div class={`hl-section ${collapsed.compression ? 'collapsed' : ''}`}>
        <div class="hl-section-header" onClick={() => toggle('compression')}>
          <span class="hl-section-title">Compression</span>
          <span class={`hl-section-badge ${compression.isCompressed ? 'badge-warning' : 'badge-neutral'}`}>
            {compression.score}/4 signals
          </span>
        </div>
        <div class="hl-section-content">
          {compression.isCompressed && (
            <div class="hl-alert warning">Expansion probability elevated</div>
          )}
          <div class="hl-signals">
            <div class={`hl-signal ${compression.signals.rangeNarrowing ? 'active' : ''}`}>
              <span class="hl-signal-dot" />
              <span>Range Narrow</span>
            </div>
            <div class={`hl-signal ${compression.signals.oiRising ? 'active' : ''}`}>
              <span class="hl-signal-dot" />
              <span>OI Rising</span>
            </div>
            <div class={`hl-signal ${compression.signals.fundingExtreme ? 'active' : ''}`}>
              <span class="hl-signal-dot" />
              <span>Funding Extreme</span>
            </div>
            <div class={`hl-signal ${compression.signals.volumeDeclining ? 'active' : ''}`}>
              <span class="hl-signal-dot" />
              <span>Volume Declining</span>
            </div>
          </div>
          <div class="hl-row" style="margin-top: 8px">
            <span class="hl-row-label">BB Width Percentile</span>
            <span class={`hl-row-value ${volatility.bbWidthPercentile < 0.2 ? 'warning' : ''}`}>
              {formatPct(volatility.bbWidthPercentile)}
            </span>
          </div>
        </div>
      </div>

      {/* Trap Risk */}
      <div class={`hl-section ${collapsed.trap ? 'collapsed' : ''}`}>
        <div class="hl-section-header" onClick={() => toggle('trap')}>
          <span class="hl-section-title">Trap Risk</span>
          <span class={`hl-section-badge ${trap.elevated ? 'badge-warning' : 'badge-neutral'}`}>
            {trap.elevated ? 'Elevated' : 'Normal'}
          </span>
        </div>
        <div class="hl-section-content">
          {trap.elevated && (
            <div class="hl-alert warning">
              {trap.direction === 'long' ? 'Longs' : 'Shorts'} crowded. Squeeze risk elevated.
            </div>
          )}
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
        </div>
      </div>

      {/* Footer */}
      <div class="hl-footer">
        Updated {new Date(state.lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  );
}

render(h(SidePanel, {}), document.getElementById('app')!);
