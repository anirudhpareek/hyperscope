import type { TapeEntry, TapeState } from '@/types/state';

export interface RawTrade {
  timestamp: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
}

export class TapeTracker {
  private trades: TapeEntry[] = [];
  private readonly MAX_TRADES = 100;
  private readonly WHALE_THRESHOLD_USD = 50000; // $50k = whale trade
  private readonly WINDOW_5M = 5 * 60 * 1000;

  addTrade(trade: RawTrade, markPrice: number): TapeEntry | null {
    const notional = trade.size * markPrice;
    const isWhale = notional >= this.WHALE_THRESHOLD_USD;

    const entry: TapeEntry = {
      timestamp: trade.timestamp,
      price: trade.price,
      size: trade.size,
      side: trade.side,
      notional,
      isWhale,
    };

    this.trades.unshift(entry); // Add to front

    // Keep only recent trades
    if (this.trades.length > this.MAX_TRADES) {
      this.trades = this.trades.slice(0, this.MAX_TRADES);
    }

    return isWhale ? entry : null;
  }

  private getRecentWhales(): TapeEntry[] {
    const cutoff = Date.now() - this.WINDOW_5M;
    return this.trades.filter(t => t.isWhale && t.timestamp > cutoff);
  }

  private calculateIntensity(side: 'buy' | 'sell'): number {
    const cutoff = Date.now() - this.WINDOW_5M;
    const recentTrades = this.trades.filter(t => t.timestamp > cutoff);

    if (recentTrades.length === 0) return 50;

    const sideVolume = recentTrades
      .filter(t => t.side === side)
      .reduce((sum, t) => sum + t.notional, 0);

    const totalVolume = recentTrades.reduce((sum, t) => sum + t.notional, 0);

    if (totalVolume === 0) return 50;

    return Math.round((sideVolume / totalVolume) * 100);
  }

  getState(): TapeState {
    const recentWhales = this.getRecentWhales();

    const whaleBuyVolume = recentWhales
      .filter(t => t.side === 'buy')
      .reduce((sum, t) => sum + t.notional, 0);

    const whaleSellVolume = recentWhales
      .filter(t => t.side === 'sell')
      .reduce((sum, t) => sum + t.notional, 0);

    const lastWhale = this.trades.find(t => t.isWhale) || null;

    return {
      recentTrades: this.trades.slice(0, 20), // Last 20 for display
      whaleCount5m: recentWhales.length,
      whaleBuyVolume,
      whaleSellVolume,
      buyIntensity: this.calculateIntensity('buy'),
      sellIntensity: this.calculateIntensity('sell'),
      lastWhale,
    };
  }

  reset(): void {
    this.trades = [];
  }
}

export const tapeTracker = new TapeTracker();
