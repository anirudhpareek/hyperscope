import type { WsSubscription, WsMessage, WsBookUpdate, WsTrade, WsActiveAssetCtx } from '@/types/api';

const WS_URL = 'wss://api.hyperliquid.xyz/ws';
const RECONNECT_DELAY = 3000;
const HEARTBEAT_INTERVAL = 30000;

type MessageHandler = (data: WsMessage) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, WsSubscription> = new Map();
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnecting = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.connect();
  }

  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.reconnecting = false;
      this.resubscribeAll();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };
  }

  private handleMessage(msg: unknown): void {
    if (!msg || typeof msg !== 'object') return;

    const message = msg as { channel?: string; data?: unknown };
    if (!message.channel || message.channel === 'subscriptionResponse') return;

    const channel = message.channel;
    const handlers = this.handlers.get(channel);
    if (handlers) {
      handlers.forEach((handler) => {
        handler({ channel: channel as WsMessage['channel'], data: message.data });
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    this.reconnecting = true;
    setTimeout(() => this.connect(), RECONNECT_DELAY);
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach((sub) => {
      this.sendSubscribe(sub);
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendSubscribe(subscription: WsSubscription): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        method: 'subscribe',
        subscription,
      })
    );
  }

  private sendUnsubscribe(subscription: WsSubscription): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        method: 'unsubscribe',
        subscription,
      })
    );
  }

  private getSubKey(sub: WsSubscription): string {
    return sub.coin ? `${sub.type}:${sub.coin}` : sub.type;
  }

  subscribe(subscription: WsSubscription, handler: MessageHandler): () => void {
    const key = this.getSubKey(subscription);

    // Track subscription
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, subscription);
      this.sendSubscribe(subscription);
    }

    // Track handler
    if (!this.handlers.has(subscription.type)) {
      this.handlers.set(subscription.type, new Set());
    }
    this.handlers.get(subscription.type)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(subscription.type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(subscription.type);
          this.subscriptions.delete(key);
          this.sendUnsubscribe(subscription);
        }
      }
    };
  }

  subscribeToBook(coin: string, handler: (data: WsBookUpdate) => void): () => void {
    return this.subscribe({ type: 'l2Book', coin }, (msg) => {
      if (msg.channel === 'l2Book') {
        handler(msg.data as WsBookUpdate);
      }
    });
  }

  subscribeToTrades(coin: string, handler: (data: WsTrade[]) => void): () => void {
    return this.subscribe({ type: 'trades', coin }, (msg) => {
      if (msg.channel === 'trades') {
        handler(msg.data as WsTrade[]);
      }
    });
  }

  subscribeToAssetCtx(coin: string, handler: (data: WsActiveAssetCtx) => void): () => void {
    return this.subscribe({ type: 'activeAssetCtx', coin }, (msg) => {
      if (msg.channel === 'activeAssetCtx') {
        handler(msg.data as WsActiveAssetCtx);
      }
    });
  }

  subscribeToAllMids(handler: (data: Record<string, string>) => void): () => void {
    return this.subscribe({ type: 'allMids' }, (msg) => {
      if (msg.channel === 'allMids') {
        const mids = (msg.data as { mids: Record<string, string> }).mids;
        handler(mids);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.handlers.clear();
  }
}

export const wsManager = new WebSocketManager();
