import type {
  AnalyticsState,
  MarketState,
  OrderbookState,
  VolatilityState,
  VolumeState,
  HistoricalSnapshot,
} from '@/types/state';
import type { AssetContext, L2BookResponse, Candle, FundingHistoryEntry } from '@/types/api';
import { getMetaAndAssetCtxs, getL2Book, getCandles, getFundingHistory } from './api';
import { wsManager } from './websocket';
import { calculatePressureMap } from '@/calculations/pressure';
import { calculateLiquidationGravity } from '@/calculations/gravity';
import { detectCompression, calculateVolatilityState, calculateVolumeState } from '@/calculations/compression';
import { calculateTrapRisk, createSnapshot } from '@/calculations/trap';

const POLL_INTERVAL = 5000;
const CANDLE_INTERVAL = 60000;
const HISTORY_SNAPSHOT_INTERVAL = 3600000; // 1 hour

type StateListener = (state: AnalyticsState) => void;

export class StateManager {
  private currentCoin: string | null = null;
  private state: AnalyticsState | null = null;
  private listeners: Set<StateListener> = new Set();

  // Raw data cache
  private assetContext: AssetContext | null = null;
  private orderbook: L2BookResponse | null = null;
  private candles: Candle[] = [];
  private fundingHistory: FundingHistoryEntry[] = [];

  // Historical snapshots for trap detection
  private snapshots: HistoricalSnapshot[] = [];

  // Timers
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private candleTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;

  // WS unsubscribe functions
  private wsUnsubscribers: Array<() => void> = [];

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    if (this.state) {
      listener(this.state);
    }
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    if (this.state) {
      this.listeners.forEach((l) => l(this.state!));
    }
  }

  async setCoin(coin: string): Promise<void> {
    if (this.currentCoin === coin) return;

    this.cleanup();
    this.currentCoin = coin;

    // Initial data fetch
    await this.fetchInitialData();

    // Setup WebSocket subscriptions
    this.setupWebSocket();

    // Setup polling for data not available via WS
    this.startPolling();

    // Take initial snapshot
    this.takeSnapshot();
  }

  private async fetchInitialData(): Promise<void> {
    if (!this.currentCoin) return;

    try {
      const [metaData, book, candles, funding] = await Promise.all([
        getMetaAndAssetCtxs(),
        getL2Book(this.currentCoin),
        getCandles(
          this.currentCoin,
          '15m',
          Date.now() - 24 * 60 * 60 * 1000 // Last 24h
        ),
        getFundingHistory(
          this.currentCoin,
          Date.now() - 7 * 24 * 60 * 60 * 1000 // Last 7 days
        ),
      ]);

      this.assetContext = metaData.contexts.get(this.currentCoin) || null;
      this.orderbook = book;
      this.candles = candles;
      this.fundingHistory = funding;

      this.recalculate();
    } catch (error) {
      console.error('[State] Initial fetch error:', error);
    }
  }

  private setupWebSocket(): void {
    if (!this.currentCoin) return;

    // Subscribe to order book updates
    const unsubBook = wsManager.subscribeToBook(this.currentCoin, (data) => {
      this.orderbook = data;
      this.recalculate();
    });

    // Subscribe to asset context (funding, OI updates)
    const unsubCtx = wsManager.subscribeToAssetCtx(this.currentCoin, (data) => {
      if (data.coin === this.currentCoin) {
        this.assetContext = data.ctx;
        this.recalculate();
      }
    });

    this.wsUnsubscribers = [unsubBook, unsubCtx];
  }

  private startPolling(): void {
    // Poll for meta data (OI, funding) as backup
    this.pollTimer = setInterval(async () => {
      if (!this.currentCoin) return;
      try {
        const data = await getMetaAndAssetCtxs();
        const ctx = data.contexts.get(this.currentCoin);
        if (ctx) {
          this.assetContext = ctx;
          this.recalculate();
        }
      } catch (e) {
        console.error('[State] Poll error:', e);
      }
    }, POLL_INTERVAL);

    // Poll for candles less frequently
    this.candleTimer = setInterval(async () => {
      if (!this.currentCoin) return;
      try {
        const candles = await getCandles(
          this.currentCoin,
          '15m',
          Date.now() - 24 * 60 * 60 * 1000
        );
        this.candles = candles;
        this.recalculate();
      } catch (e) {
        console.error('[State] Candle poll error:', e);
      }
    }, CANDLE_INTERVAL);

    // Snapshot for trap detection
    this.snapshotTimer = setInterval(() => {
      this.takeSnapshot();
    }, HISTORY_SNAPSHOT_INTERVAL);
  }

  private takeSnapshot(): void {
    if (!this.assetContext) return;

    const snapshot = createSnapshot(
      parseFloat(this.assetContext.openInterest),
      parseFloat(this.assetContext.funding),
      parseFloat(this.assetContext.markPx)
    );

    this.snapshots.push(snapshot);

    // Keep only last 24 hours of snapshots
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.snapshots = this.snapshots.filter((s) => s.timestamp > cutoff);
  }

  private getOrderbookState(): OrderbookState {
    if (!this.orderbook || !this.assetContext) {
      return {
        coin: this.currentCoin || '',
        bids: [],
        asks: [],
        bidDepthPct: [0, 0, 0, 0, 0],
        askDepthPct: [0, 0, 0, 0, 0],
        imbalance: 0,
        spreadPct: 0,
        lastUpdate: Date.now(),
      };
    }

    const price = parseFloat(this.assetContext.markPx);
    const [rawBids, rawAsks] = this.orderbook.levels;

    const bids = rawBids.map((l) => ({
      price: parseFloat(l.px),
      size: parseFloat(l.sz),
      count: l.n,
    }));

    const asks = rawAsks.map((l) => ({
      price: parseFloat(l.px),
      size: parseFloat(l.sz),
      count: l.n,
    }));

    // Calculate cumulative depth at percentage levels
    const pctLevels = [0.01, 0.02, 0.03, 0.04, 0.05];

    const bidDepthPct = pctLevels.map((pct) => {
      const threshold = price * (1 - pct);
      return bids.filter((b) => b.price >= threshold).reduce((sum, b) => sum + b.size, 0);
    });

    const askDepthPct = pctLevels.map((pct) => {
      const threshold = price * (1 + pct);
      return asks.filter((a) => a.price <= threshold).reduce((sum, a) => sum + a.size, 0);
    });

    // Imbalance within 2%
    const bidDepth2 = bidDepthPct[1];
    const askDepth2 = askDepthPct[1];
    const total = bidDepth2 + askDepth2;
    const imbalance = total > 0 ? (bidDepth2 - askDepth2) / total : 0;

    // Spread
    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spreadPct = bestBid > 0 ? (bestAsk - bestBid) / bestBid : 0;

    return {
      coin: this.currentCoin || '',
      bids,
      asks,
      bidDepthPct,
      askDepthPct,
      imbalance,
      spreadPct,
      lastUpdate: Date.now(),
    };
  }

  private recalculate(): void {
    if (!this.currentCoin || !this.assetContext) return;

    const ctx = this.assetContext;
    const price = parseFloat(ctx.markPx);
    const fundingRate = parseFloat(ctx.funding);

    // Build market state
    const market: MarketState = {
      coin: this.currentCoin,
      price,
      markPrice: parseFloat(ctx.markPx),
      oraclePrice: parseFloat(ctx.oraclePx),
      openInterest: parseFloat(ctx.openInterest),
      fundingRate,
      fundingAnnualized: fundingRate * 24 * 365,
      premium: parseFloat(ctx.premium),
      dayVolume: parseFloat(ctx.dayNtlVlm),
      lastUpdate: Date.now(),
    };

    // Build orderbook state
    const orderbook = this.getOrderbookState();

    // Calculate volatility from candles
    const volatility: VolatilityState = this.candles.length > 0
      ? calculateVolatilityState(this.candles)
      : { atr14: 0, range24h: 0, bbWidth: 0, bbWidthPercentile: 0.5, historicalVolatility: 0 };

    // Calculate volume state
    const recentCandles = this.candles.slice(-4); // Last hour (4x15m)
    const priorCandles = this.candles.slice(-20, -4);
    const recentVolume = recentCandles.reduce((sum, c) => sum + parseFloat(c.v), 0);
    const avgVolume = priorCandles.length > 0
      ? priorCandles.reduce((sum, c) => sum + parseFloat(c.v), 0) / priorCandles.length * 4
      : recentVolume;
    const volume = calculateVolumeState(recentVolume, avgVolume);

    // Calculate pressure map
    const pressure = calculatePressureMap(market, orderbook);

    // Calculate liquidation gravity
    const gravity = calculateLiquidationGravity(orderbook, price);

    // Calculate compression
    const priorOI = this.snapshots.length > 0
      ? this.snapshots[0].openInterest
      : market.openInterest;
    const compression = detectCompression({
      candles: this.candles,
      currentOI: market.openInterest,
      priorOI,
      fundingRate,
      recentVolume,
      avgVolume,
    });

    // Calculate trap risk
    const priorSnapshot = this.snapshots.length > 0
      ? this.snapshots[0]
      : createSnapshot(market.openInterest, fundingRate, price);
    const fundingRates = this.fundingHistory.map((f) => parseFloat(f.fundingRate));
    const trap = calculateTrapRisk({
      currentOI: market.openInterest,
      currentFunding: fundingRate,
      currentPrice: price,
      priorSnapshot,
      fundingHistory: fundingRates.length > 0 ? fundingRates : [fundingRate],
    });

    this.state = {
      coin: this.currentCoin,
      market,
      orderbook,
      volatility,
      volume,
      pressure,
      gravity,
      compression,
      trap,
      lastUpdate: Date.now(),
    };

    this.notify();
  }

  private cleanup(): void {
    // Clear timers
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.candleTimer) clearInterval(this.candleTimer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);

    // Unsubscribe WebSockets
    this.wsUnsubscribers.forEach((unsub) => unsub());
    this.wsUnsubscribers = [];

    // Clear data
    this.assetContext = null;
    this.orderbook = null;
    this.candles = [];
    this.snapshots = [];
    this.state = null;
    this.currentCoin = null;
  }

  getState(): AnalyticsState | null {
    return this.state;
  }

  getCurrentCoin(): string | null {
    return this.currentCoin;
  }
}

export const stateManager = new StateManager();
