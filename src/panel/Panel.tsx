import { useState, useEffect, useRef } from 'preact/hooks';
import type { AnalyticsState } from '@/types/state';
import { PressureMap } from './PressureMap';
import { LiqGravity } from './LiqGravity';
import { Compression } from './Compression';
import { TrapRisk } from './TrapRisk';
import { formatNumber } from '@/calculations/utils';

interface Props {
  state: AnalyticsState | null;
}

export function Panel({ state }: Props) {
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
    };

    const handleMouseUp = () => {
      dragRef.current.isDragging = false;
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleDragStart = (e: MouseEvent) => {
    e.preventDefault();
    dragRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY };
    document.body.style.cursor = 'grabbing';
  };

  return (
    <div
      ref={panelRef}
      class={`hl-panel ${minimized ? 'minimized' : ''}`}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div class="hl-panel-header" onMouseDown={handleDragStart}>
        <div class="hl-panel-title">
          <span>HL Analytics</span>
          {state && <span class="hl-panel-coin">{state.coin}</span>}
        </div>
        <button class="hl-panel-minimize" onClick={() => setMinimized(!minimized)}>
          {minimized ? '▼' : '—'}
        </button>
      </div>

      <div class="hl-panel-body">
        {!state ? (
          <div class="hl-loading">
            <div class="hl-loading-spinner" />
            <span>Loading...</span>
          </div>
        ) : (
          <>
            {/* Compact market overview */}
            <div class="hl-market-overview">
              <div class="hl-market-stat">
                <div class="hl-market-stat-value">${formatNumber(state.market.price)}</div>
                <div class="hl-market-stat-label">Price</div>
              </div>
              <div class="hl-market-stat">
                <div class="hl-market-stat-value">${formatNumber(state.market.openInterest * state.market.price)}</div>
                <div class="hl-market-stat-label">OI</div>
              </div>
              <div class="hl-market-stat">
                <div class={`hl-market-stat-value ${state.orderbook.imbalance > 0.15 ? 'positive' : state.orderbook.imbalance < -0.15 ? 'negative' : ''}`}>
                  {(state.orderbook.imbalance * 100).toFixed(0)}%
                </div>
                <div class="hl-market-stat-label">Imbal</div>
              </div>
            </div>

            <PressureMap pressure={state.pressure} market={state.market} />
            <LiqGravity gravity={state.gravity} />
            <Compression compression={state.compression} volatility={state.volatility} />
            <TrapRisk trap={state.trap} market={state.market} />

            <div class="hl-timestamp">
              {new Date(state.lastUpdate).toLocaleTimeString('en-US', { hour12: false })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
