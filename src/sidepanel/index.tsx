import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { AnalyticsState } from '@/types/state';
import { formatNumber, formatPct } from '@/calculations/utils';

// Tooltip descriptions for metrics
const TOOLTIPS = {
  price: 'Current mark price of the asset',
  openInterest: 'Total value of all open positions',
  bookImbalance: 'Difference between bid and ask depth. Positive = more buyers',
  funding: 'Annualized funding rate. Positive = longs pay shorts',
  cvd: 'Cumulative Volume Delta - net buying vs selling pressure over time',
  cvdMomentum: 'Short-term trend direction based on order flow',
  cvdDivergence: 'Price and CVD moving in opposite directions - potential reversal signal',
  whaleActivity: 'Large trades (>$50K) detected in recent order flow',
  buyIntensity: 'Percentage of volume from aggressive buyers',
  sellIntensity: 'Percentage of volume from aggressive sellers',
  oiDivergence: 'Relationship between price movement and open interest changes',
  oiPattern: 'Interpretation of OI × Price: new longs, short covering, etc.',
  pressureMap: 'Estimated liquidation volume at price levels ±5% from current',
  liqGravity: 'Which direction has more liquidation clusters to attract price',
  compression: 'Volatility squeeze signals - low volatility often precedes big moves',
  trapRisk: 'Risk of a position squeeze based on crowding and funding',
  rangeNarrowing: 'Price range getting tighter (Bollinger Bands squeezing)',
  oiRising: 'Open interest increasing while price consolidates',
  fundingExtreme: 'Funding rate significantly above/below normal',
  volumeDeclining: 'Trading volume decreasing during consolidation',
  bbWidth: 'Bollinger Band width percentile - lower = more compressed',
};

// Default settings
const DEFAULT_SETTINGS = {
  showCVD: true,
  showWhaleActivity: true,
  showOIDivergence: true,
  showPressureMap: true,
  showGravity: true,
  showCompression: true,
  showTrapRisk: true,
  showInsight: true,
};

type Settings = typeof DEFAULT_SETTINGS;

// Insight generator - rule-based tips
interface Insight {
  type: 'bullish' | 'bearish' | 'warning' | 'info';
  title: string;
  message: string;
}

function generateInsight(state: AnalyticsState): Insight | null {
  const { cvd, compression, gravity, trap, tape, oiDivergence, market } = state;

  // Priority 1: Squeeze setups (high conviction)
  if (compression.isCompressed && gravity.score === 'HIGH_BELOW' && trap.direction === 'long') {
    return {
      type: 'bearish',
      title: 'Breakdown Setup',
      message: 'Compression + liquidations clustered below + longs crowded. Breakdown could trigger cascade.',
    };
  }

  if (compression.isCompressed && gravity.score === 'HIGH_ABOVE' && trap.direction === 'short') {
    return {
      type: 'bullish',
      title: 'Breakout Setup',
      message: 'Compression + liquidations clustered above + shorts crowded. Breakout could trigger squeeze.',
    };
  }

  // Priority 2: CVD divergence + trap (reversal signals)
  if (cvd.divergence === 'bullish' && trap.elevated && trap.direction === 'short') {
    return {
      type: 'bullish',
      title: 'Short Squeeze Risk',
      message: 'Bullish CVD divergence while shorts are crowded. Potential squeeze setup forming.',
    };
  }

  if (cvd.divergence === 'bearish' && trap.elevated && trap.direction === 'long') {
    return {
      type: 'bearish',
      title: 'Long Squeeze Risk',
      message: 'Bearish CVD divergence while longs are crowded. Potential flush setup forming.',
    };
  }

  // Priority 3: Whale activity divergence
  if (tape.whaleBuyVolume > tape.whaleSellVolume * 2 && market.fundingAnnualized < -0.3) {
    return {
      type: 'bullish',
      title: 'Smart Money Accumulation',
      message: 'Whales aggressively buying while funding is negative. Potential accumulation phase.',
    };
  }

  if (tape.whaleSellVolume > tape.whaleBuyVolume * 2 && market.fundingAnnualized > 0.3) {
    return {
      type: 'bearish',
      title: 'Smart Money Distribution',
      message: 'Whales aggressively selling while funding is positive. Potential distribution phase.',
    };
  }

  // Priority 4: OI divergence patterns
  if (oiDivergence.pattern === 'short_covering' && oiDivergence.strength !== 'weak') {
    return {
      type: 'bullish',
      title: 'Short Covering Rally',
      message: 'Price rising while OI falling. Shorts closing positions, not new longs entering.',
    };
  }

  if (oiDivergence.pattern === 'long_liquidation' && oiDivergence.strength !== 'weak') {
    return {
      type: 'bearish',
      title: 'Long Liquidation Cascade',
      message: 'Price falling while OI falling. Longs being forced out, watch for capitulation.',
    };
  }

  // Priority 5: Extreme funding
  if (Math.abs(market.fundingAnnualized) > 1) {
    const direction = market.fundingAnnualized > 0 ? 'longs' : 'shorts';
    const opposite = market.fundingAnnualized > 0 ? 'short' : 'long';
    return {
      type: 'warning',
      title: 'Extreme Funding',
      message: `${direction.charAt(0).toUpperCase() + direction.slice(1)} paying ${Math.abs(market.fundingAnnualized * 100).toFixed(0)}% annualized. Crowded trade, consider ${opposite} bias.`,
    };
  }

  // Priority 6: Strong CVD momentum
  if (cvd.momentum === 'strong_buy' && tape.buyIntensity > 65) {
    return {
      type: 'bullish',
      title: 'Strong Buying Pressure',
      message: 'Aggressive buying across timeframes. Order flow strongly favors bulls.',
    };
  }

  if (cvd.momentum === 'strong_sell' && tape.sellIntensity > 65) {
    return {
      type: 'bearish',
      title: 'Strong Selling Pressure',
      message: 'Aggressive selling across timeframes. Order flow strongly favors bears.',
    };
  }

  // Priority 7: Compression warning
  if (compression.isCompressed) {
    return {
      type: 'warning',
      title: 'Volatility Compression',
      message: 'Multiple compression signals active. Expansion likely soon, direction uncertain.',
    };
  }

  // Priority 8: Trap risk
  if (trap.elevated) {
    const crowded = trap.direction === 'long' ? 'Longs' : 'Shorts';
    return {
      type: 'warning',
      title: `${crowded} Crowded`,
      message: `${crowded} appear crowded based on OI and funding. Elevated squeeze risk.`,
    };
  }

  // No strong signal
  return null;
}

// Settings icon SVG
const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

// Close icon SVG
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

// Info icon component
const InfoIcon = ({ tooltip, className = '' }: { tooltip: string; className?: string }) => (
  <span class={`hl-tooltip hl-info-icon ${className}`} data-tooltip={tooltip}>?</span>
);

// Toggle component
const Toggle = ({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) => (
  <label class="hl-toggle">
    <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} id={id} />
    <span class="hl-toggle-slider" />
  </label>
);

// Settings Panel component
const SettingsPanel = ({
  open,
  onClose,
  settings,
  onSettingsChange,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (key: keyof Settings, value: boolean) => void;
  onReset: () => void;
}) => (
  <div class={`hl-settings-overlay ${open ? 'open' : ''}`} onClick={onClose}>
    <div class="hl-settings-panel" onClick={(e) => e.stopPropagation()}>
      <div class="hl-settings-header">
        <span class="hl-settings-title">Settings</span>
        <button class="hl-settings-close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div class="hl-settings-content">
        <div class="hl-settings-section">
          <div class="hl-settings-section-title">Visible Sections</div>

          <div class="hl-settings-item">
            <div>
              <div class="hl-settings-item-label">Order Flow (CVD)</div>
              <div class="hl-settings-item-desc">Cumulative volume delta analysis</div>
            </div>
            <Toggle checked={settings.showCVD} onChange={(v) => onSettingsChange('showCVD', v)} id="showCVD" />
          </div>

          <div class="hl-settings-item">
            <div>
              <div class="hl-settings-item-label">Whale Activity</div>
              <div class="hl-settings-item-desc">Large trade detection</div>
            </div>
            <Toggle checked={settings.showWhaleActivity} onChange={(v) => onSettingsChange('showWhaleActivity', v)} id="showWhaleActivity" />
          </div>

          <div class="hl-settings-item">
            <div>
              <div class="hl-settings-item-label">OI × Price</div>
              <div class="hl-settings-item-desc">Open interest divergence</div>
            </div>
            <Toggle checked={settings.showOIDivergence} onChange={(v) => onSettingsChange('showOIDivergence', v)} id="showOIDivergence" />
          </div>

          <div class="hl-settings-item">
            <div>
              <div class="hl-settings-item-label">Pressure Map</div>
              <div class="hl-settings-item-desc">Liquidation estimates ±5%</div>
            </div>
            <Toggle checked={settings.showPressureMap} onChange={(v) => onSettingsChange('showPressureMap', v)} id="showPressureMap" />
          </div>

          <div class="hl-settings-item">
            <div>
              <div class="hl-settings-item-label">Liquidation Gravity</div>
              <div class="hl-settings-item-desc">Liquidation cluster direction</div>
            </div>
            <Toggle checked={settings.showGravity} onChange={(v) => onSettingsChange('showGravity', v)} id="showGravity" />
          </div>

          <div class="hl-settings-item">
            <div>
              <div class="hl-settings-item-label">Compression</div>
              <div class="hl-settings-item-desc">Volatility squeeze signals</div>
            </div>
            <Toggle checked={settings.showCompression} onChange={(v) => onSettingsChange('showCompression', v)} id="showCompression" />
          </div>

          <div class="hl-settings-item">
            <div>
              <div class="hl-settings-item-label">Trap Risk</div>
              <div class="hl-settings-item-desc">Position squeeze risk</div>
            </div>
            <Toggle checked={settings.showTrapRisk} onChange={(v) => onSettingsChange('showTrapRisk', v)} id="showTrapRisk" />
          </div>

          <div class="hl-settings-item">
            <div>
              <div class="hl-settings-item-label">Signal Insight</div>
              <div class="hl-settings-item-desc">AI-like tips based on metrics</div>
            </div>
            <Toggle checked={settings.showInsight} onChange={(v) => onSettingsChange('showInsight', v)} id="showInsight" />
          </div>
        </div>
      </div>
      <div class="hl-settings-footer">
        <button class="hl-settings-reset" onClick={onReset}>Reset to Defaults</button>
      </div>
    </div>
  </div>
);

function SidePanel() {
  const [state, setState] = useState<AnalyticsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // Load settings from chrome.storage on mount
  useEffect(() => {
    chrome.storage.local.get(['hlAnalyticsSettings'], (result) => {
      if (result.hlAnalyticsSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.hlAnalyticsSettings });
      }
    });
  }, []);

  // Save settings to chrome.storage when they change
  const updateSettings = (key: keyof Settings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    chrome.storage.local.set({ hlAnalyticsSettings: newSettings });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    chrome.storage.local.set({ hlAnalyticsSettings: DEFAULT_SETTINGS });
  };

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
          <span class="hl-loading-text">Connecting...</span>
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
          <div class="hl-no-data-icon">⊘</div>
          <div class="hl-no-data-text">No data available</div>
          <div class="hl-no-data-hint">Open Hyperliquid trading page</div>
        </div>
      </div>
    );
  }

  const { market, pressure, gravity, compression, trap, orderbook, volatility, cvd, tape, oiDivergence } = state;

  // Generate insight
  const insight = generateInsight(state);

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
      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={updateSettings}
        onReset={resetSettings}
      />

      {/* Header */}
      <div class="hl-header">
        <span class="hl-header-title">HL Analytics</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="hl-header-coin">
            <span class="live-dot" />
            <span>{state.coin}</span>
          </div>
          <button class="hl-settings-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            <SettingsIcon />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div class="hl-stats">
        <div class="hl-stat hl-tooltip" data-tooltip={TOOLTIPS.price}>
          <div class="hl-stat-value">${formatNumber(market.price)}</div>
          <div class="hl-stat-label">Price</div>
        </div>
        <div class="hl-stat hl-tooltip" data-tooltip={TOOLTIPS.openInterest}>
          <div class="hl-stat-value">${formatNumber(market.openInterest * market.price)}</div>
          <div class="hl-stat-label">Open Interest</div>
        </div>
        <div class="hl-stat hl-tooltip" data-tooltip={TOOLTIPS.bookImbalance}>
          <div class={`hl-stat-value ${orderbook.imbalance > 0.15 ? 'positive' : orderbook.imbalance < -0.15 ? 'negative' : ''}`}>
            {(orderbook.imbalance * 100).toFixed(0)}%
          </div>
          <div class="hl-stat-label">Book Imbalance</div>
        </div>
        <div class="hl-stat hl-tooltip" data-tooltip={TOOLTIPS.funding}>
          <div class={`hl-stat-value ${Math.abs(market.fundingAnnualized) > 0.5 ? 'warning' : ''}`}>
            {formatPct(market.fundingAnnualized)}
          </div>
          <div class="hl-stat-label">Funding (Ann.)</div>
        </div>
      </div>

      {/* Signal Insight */}
      {settings.showInsight && insight && (
        <div class={`hl-insight hl-insight--${insight.type}`}>
          <div class="hl-insight-header">
            <span class="hl-insight-icon">
              {insight.type === 'bullish' && '▲'}
              {insight.type === 'bearish' && '▼'}
              {insight.type === 'warning' && '⚠'}
              {insight.type === 'info' && 'ℹ'}
            </span>
            <span class="hl-insight-title">{insight.title}</span>
          </div>
          <div class="hl-insight-message">{insight.message}</div>
        </div>
      )}

      {/* CVD (Cumulative Volume Delta) */}
      {settings.showCVD && (
        <div class={`hl-section ${collapsed.cvd ? 'collapsed' : ''}`}>
          <div class="hl-section-header" onClick={() => toggle('cvd')}>
            <span class="hl-section-title">
              Order Flow (CVD)
              <InfoIcon tooltip={TOOLTIPS.cvd} />
            </span>
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
                style={`width: ${Math.min(Math.abs(cvd.delta5m) / (Math.abs(cvd.delta15m) || 1) * 50, 100)}%; background: ${cvd.delta5m > 0 ? '#0ECB81' : '#F6465D'}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Trade Tape / Whale Activity */}
      {settings.showWhaleActivity && (
        <div class={`hl-section ${collapsed.tape ? 'collapsed' : ''}`}>
          <div class="hl-section-header" onClick={() => toggle('tape')}>
            <span class="hl-section-title">
              Whale Activity
              <InfoIcon tooltip={TOOLTIPS.whaleActivity} />
            </span>
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
                <span class="positive hl-tooltip hl-tooltip--left" data-tooltip={TOOLTIPS.buyIntensity}>{tape.buyIntensity}% Buy</span>
                <span class="negative hl-tooltip hl-tooltip--right" data-tooltip={TOOLTIPS.sellIntensity}>{tape.sellIntensity}% Sell</span>
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
      )}

      {/* OI × Price Divergence */}
      {settings.showOIDivergence && (
        <div class={`hl-section ${collapsed.oiDiv ? 'collapsed' : ''}`}>
          <div class="hl-section-header" onClick={() => toggle('oiDiv')}>
            <span class="hl-section-title">
              OI × Price
              <InfoIcon tooltip={TOOLTIPS.oiDivergence} />
            </span>
            <span class={`hl-section-badge ${oiDivergence.pattern === 'new_longs' ? 'badge-positive' : oiDivergence.pattern === 'new_shorts' || oiDivergence.pattern === 'long_liquidation' ? 'badge-negative' : 'badge-neutral'}`}>
              {getOiPatternLabel(oiDivergence.pattern)}
            </span>
          </div>
          <div class="hl-section-content">
            <div class="hl-divergence-meter">
              <div class="hl-divergence-track">
                <div
                  class="hl-divergence-fill"
                  style={`width: ${Math.abs(oiDivergence.score)}%; margin-left: ${oiDivergence.score >= 0 ? '50%' : `${50 - Math.abs(oiDivergence.score)}%`}; background: ${oiDivergence.score >= 0 ? '#0ECB81' : '#F6465D'}`}
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
      )}

      {/* Pressure Map */}
      {settings.showPressureMap && (
        <div class={`hl-section ${collapsed.pressure ? 'collapsed' : ''}`}>
          <div class="hl-section-header" onClick={() => toggle('pressure')}>
            <span class="hl-section-title">
              Pressure Map ±5%
              <InfoIcon tooltip={TOOLTIPS.pressureMap} />
            </span>
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
      )}

      {/* Liquidation Gravity */}
      {settings.showGravity && (
        <div class={`hl-section ${collapsed.gravity ? 'collapsed' : ''}`}>
          <div class="hl-section-header" onClick={() => toggle('gravity')}>
            <span class="hl-section-title">
              Liquidation Gravity
              <InfoIcon tooltip={TOOLTIPS.liqGravity} />
            </span>
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
      )}

      {/* Volatility Compression */}
      {settings.showCompression && (
        <div class={`hl-section ${collapsed.compression ? 'collapsed' : ''}`}>
          <div class="hl-section-header" onClick={() => toggle('compression')}>
            <span class="hl-section-title">
              Compression
              <InfoIcon tooltip={TOOLTIPS.compression} />
            </span>
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
                <span class="hl-tooltip" data-tooltip={TOOLTIPS.rangeNarrowing}>Range Narrow</span>
              </div>
              <div class={`hl-signal ${compression.signals.oiRising ? 'active' : ''}`}>
                <span class="hl-signal-dot" />
                <span class="hl-tooltip" data-tooltip={TOOLTIPS.oiRising}>OI Rising</span>
              </div>
              <div class={`hl-signal ${compression.signals.fundingExtreme ? 'active' : ''}`}>
                <span class="hl-signal-dot" />
                <span class="hl-tooltip" data-tooltip={TOOLTIPS.fundingExtreme}>Funding Extreme</span>
              </div>
              <div class={`hl-signal ${compression.signals.volumeDeclining ? 'active' : ''}`}>
                <span class="hl-signal-dot" />
                <span class="hl-tooltip" data-tooltip={TOOLTIPS.volumeDeclining}>Volume Declining</span>
              </div>
            </div>
            <div class="hl-row" style="margin-top: 8px">
              <span class="hl-row-label hl-tooltip hl-tooltip--left" data-tooltip={TOOLTIPS.bbWidth}>BB Width Percentile</span>
              <span class={`hl-row-value ${volatility.bbWidthPercentile < 0.2 ? 'warning' : ''}`}>
                {formatPct(volatility.bbWidthPercentile)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Trap Risk */}
      {settings.showTrapRisk && (
        <div class={`hl-section ${collapsed.trap ? 'collapsed' : ''}`}>
          <div class="hl-section-header" onClick={() => toggle('trap')}>
            <span class="hl-section-title">
              Trap Risk
              <InfoIcon tooltip={TOOLTIPS.trapRisk} />
            </span>
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
      )}

      {/* Footer */}
      <div class="hl-footer">
        <div class="hl-footer-time">Updated {new Date(state.lastUpdate).toLocaleTimeString()}</div>
        <div class="hl-footer-disclaimer">
          Not financial advice. For informational purposes only. Trade at your own risk.
        </div>
      </div>
    </div>
  );
}

render(h(SidePanel, {}), document.getElementById('app')!);
