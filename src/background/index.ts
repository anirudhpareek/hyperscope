import { stateManager } from './state';
import type { ExtensionMessage, SubscribeMessage, AnalyticsState } from '@/types/state';

// Track connected ports (content scripts and sidepanel)
const connectedPorts = new Map<string, chrome.runtime.Port>();

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Auto-open side panel on Hyperliquid
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('app.hyperliquid.xyz')) {
    chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true,
    });
  }
});

// Handle connections from content scripts and sidepanel
chrome.runtime.onConnect.addListener((port) => {
  const portId = `${port.name}-${Date.now()}`;
  console.log(`[BG] Port connected: ${port.name}`);
  connectedPorts.set(portId, port);

  // Subscribe to state updates
  const unsubscribe = stateManager.subscribe((state) => {
    try {
      port.postMessage({ type: 'STATE_UPDATE', payload: state });
    } catch (e) {
      console.error('[BG] Failed to send state:', e);
    }
  });

  // Handle messages
  port.onMessage.addListener(async (msg: ExtensionMessage) => {
    console.log(`[BG] Message from ${port.name}:`, msg.type);

    switch (msg.type) {
      case 'SUBSCRIBE': {
        const { coin } = (msg as SubscribeMessage).payload;
        await stateManager.setCoin(coin);
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
    console.log(`[BG] Port disconnected: ${port.name}`);
    connectedPorts.delete(portId);
    unsubscribe();
  });
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[BG] Extension installed:', details.reason);

  // Set up side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

console.log('[BG] Service worker started');
