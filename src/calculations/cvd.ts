import type { CVDState } from '@/types/state';

interface TradeData {
  timestamp: number;
  size: number;
  side: 'buy' | 'sell';
  price: number;
}

export class CVDCalculator {
  private trades: TradeData[] = [];
  private priceHistory: Array<{ timestamp: number; price: number }> = [];

  // Time windows in ms
  private readonly WINDOW_5M = 5 * 60 * 1000;
  private readonly WINDOW_15M = 15 * 60 * 1000;
  private readonly WINDOW_1H = 60 * 60 * 1000;
  private readonly MAX_HISTORY = 2 * 60 * 60 * 1000; // Keep 2 hours

  addTrade(trade: TradeData): void {
    this.trades.push(trade);
    this.priceHistory.push({ timestamp: trade.timestamp, price: trade.price });
    this.cleanup();
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.MAX_HISTORY;
    this.trades = this.trades.filter(t => t.timestamp > cutoff);
    this.priceHistory = this.priceHistory.filter(p => p.timestamp > cutoff);
  }

  private calculateDelta(windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    const windowTrades = this.trades.filter(t => t.timestamp > cutoff);

    return windowTrades.reduce((delta, trade) => {
      const volume = trade.size;
      return delta + (trade.side === 'buy' ? volume : -volume);
    }, 0);
  }

  private calculateCumulativeDelta(): number {
    return this.trades.reduce((delta, trade) => {
      const volume = trade.size;
      return delta + (trade.side === 'buy' ? volume : -volume);
    }, 0);
  }

  private getMomentum(delta5m: number, delta15m: number): CVDState['momentum'] {
    const ratio = delta15m !== 0 ? delta5m / Math.abs(delta15m) : 0;

    if (delta5m > 0 && ratio > 0.5) return 'strong_buy';
    if (delta5m > 0) return 'buy';
    if (delta5m < 0 && ratio < -0.5) return 'strong_sell';
    if (delta5m < 0) return 'sell';
    return 'neutral';
  }

  private detectDivergence(delta1h: number): CVDState['divergence'] {
    if (this.priceHistory.length < 10) return null;

    const cutoff1h = Date.now() - this.WINDOW_1H;
    const hourPrices = this.priceHistory.filter(p => p.timestamp > cutoff1h);

    if (hourPrices.length < 2) return null;

    const priceStart = hourPrices[0].price;
    const priceEnd = hourPrices[hourPrices.length - 1].price;
    const priceChange = (priceEnd - priceStart) / priceStart;

    // Bullish divergence: Price down but CVD up (buying into weakness)
    if (priceChange < -0.005 && delta1h > 0) {
      return 'bullish';
    }

    // Bearish divergence: Price up but CVD down (selling into strength)
    if (priceChange > 0.005 && delta1h < 0) {
      return 'bearish';
    }

    return null;
  }

  getState(): CVDState {
    const cumulative = this.calculateCumulativeDelta();
    const delta5m = this.calculateDelta(this.WINDOW_5M);
    const delta15m = this.calculateDelta(this.WINDOW_15M);
    const delta1h = this.calculateDelta(this.WINDOW_1H);

    return {
      cumulative,
      delta5m,
      delta15m,
      delta1h,
      momentum: this.getMomentum(delta5m, delta15m),
      divergence: this.detectDivergence(delta1h),
      lastUpdate: Date.now(),
    };
  }

  reset(): void {
    this.trades = [];
    this.priceHistory = [];
  }
}

export const cvdCalculator = new CVDCalculator();
