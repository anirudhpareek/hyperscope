import { symbolDetector } from './detector';
import { panelInjector } from './injector';
import type { AnalyticsState, StateUpdateMessage } from '@/types/state';

// Establish connection to background script
let port: chrome.runtime.Port | null = null;
let currentCoin: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    port = chrome.runtime.connect({ name: 'hl-analytics' });

    port.onMessage.addListener((msg: StateUpdateMessage) => {
      if (msg.type === 'STATE_UPDATE' && msg.payload) {
        panelInjector.updateState(msg.payload as AnalyticsState);
      }
    });

    port.onDisconnect.addListener(() => {
      console.log('[CS] Disconnected from background');
      port = null;
      // Attempt to reconnect after a delay
      reconnectTimer = setTimeout(connect, 2000);
    });

    // If we have a current coin, subscribe immediately
    if (currentCoin) {
      subscribeToCoin(currentCoin);
    }

    console.log('[CS] Connected to background');
  } catch (e) {
    console.error('[CS] Connection failed:', e);
    reconnectTimer = setTimeout(connect, 2000);
  }
}

function subscribeToCoin(coin: string): void {
  if (!port) {
    console.warn('[CS] Cannot subscribe - not connected');
    return;
  }

  port.postMessage({
    type: 'SUBSCRIBE',
    payload: { coin },
  });

  console.log(`[CS] Subscribed to ${coin}`);
}

function initialize(): void {
  console.log('[CS] Initializing Hyperliquid Analytics');

  // Inject the panel
  panelInjector.inject();

  // Connect to background
  connect();

  // Watch for coin changes
  symbolDetector.onCoinChange((coin) => {
    if (coin && coin !== currentCoin) {
      console.log(`[CS] Coin changed: ${currentCoin} -> ${coin}`);
      currentCoin = coin;
      subscribeToCoin(coin);
    }
  });
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (port) {
    port.disconnect();
    port = null;
  }
  symbolDetector.destroy();
  panelInjector.remove();
});
