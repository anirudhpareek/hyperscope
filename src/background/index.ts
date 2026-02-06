import { stateManager } from './state';
import type { ExtensionMessage, SubscribeMessage, AnalyticsState } from '@/types/state';

// Track connected tabs
const connectedTabs = new Map<number, chrome.runtime.Port>();

// Handle connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'hl-analytics') return;

  const tabId = port.sender?.tab?.id;
  if (!tabId) return;

  console.log(`[BG] Tab ${tabId} connected`);
  connectedTabs.set(tabId, port);

  // Subscribe to state updates for this tab
  const unsubscribe = stateManager.subscribe((state) => {
    try {
      port.postMessage({ type: 'STATE_UPDATE', payload: state });
    } catch (e) {
      console.error('[BG] Failed to send state:', e);
    }
  });

  // Handle messages from content script
  port.onMessage.addListener(async (msg: ExtensionMessage) => {
    console.log(`[BG] Received message:`, msg.type);

    switch (msg.type) {
      case 'SUBSCRIBE': {
        const { coin } = (msg as SubscribeMessage).payload;
        await stateManager.setCoin(coin);
        break;
      }

      case 'UNSUBSCRIBE': {
        // Handled by disconnect
        break;
      }

      case 'GET_STATE': {
        const state = stateManager.getState();
        if (state) {
          port.postMessage({ type: 'STATE_UPDATE', payload: state });
        }
        break;
      }
    }
  });

  // Handle disconnection
  port.onDisconnect.addListener(() => {
    console.log(`[BG] Tab ${tabId} disconnected`);
    connectedTabs.delete(tabId);
    unsubscribe();
  });
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[BG] Extension installed:', details.reason);
});

console.log('[BG] Service worker started');
