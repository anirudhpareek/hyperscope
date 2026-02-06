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

  // Dragging logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.isDragging || !panelRef.current) return;

      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      setPosition((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));

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
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
    };
    document.body.style.cursor = 'grabbing';
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div
      ref={panelRef}
      class={`hl-panel ${minimized ? 'minimized' : ''}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      <div class="hl-panel-header" onMouseDown={handleDragStart}>
        <div class="hl-panel-title">
          <span>HL Analytics</span>
          {state && <span class="hl-panel-coin">{state.coin}</span>}
        </div>
        <button class="hl-panel-minimize" onClick={() => setMinimized(!minimized)}>
          {minimized ? '▼' : '▲'}
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
            {/* Market overview */}
            <div class="hl-section">
              <div class="hl-row">
                <span class="hl-row-label">Price</span>
                <span class="hl-row-value">${formatNumber(state.market.price)}</span>
              </div>
              <div class="hl-row">
                <span class="hl-row-label">Open Interest</span>
                <span class="hl-row-value">${formatNumber(state.market.openInterest * state.market.price)}</span>
              </div>
              <div class="hl-row">
                <span class="hl-row-label">Book Imbalance</span>
                <span class={`hl-row-value ${state.orderbook.imbalance > 0.2 ? 'positive' : state.orderbook.imbalance < -0.2 ? 'negative' : ''}`}>
                  {(state.orderbook.imbalance * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <PressureMap pressure={state.pressure} market={state.market} />
            <LiqGravity gravity={state.gravity} />
            <Compression compression={state.compression} volatility={state.volatility} />
            <TrapRisk trap={state.trap} market={state.market} />

            <div class="hl-timestamp">
              Updated {formatTime(state.lastUpdate)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
