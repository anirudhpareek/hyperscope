import type { OIDivergenceState, OIDivergencePattern } from '@/types/state';

interface OISnapshot {
  timestamp: number;
  openInterest: number;
  price: number;
}

export class OIDivergenceDetector {
  private snapshots: OISnapshot[] = [];
  private readonly WINDOW_1H = 60 * 60 * 1000;
  private readonly WINDOW_4H = 4 * 60 * 60 * 1000;
  private readonly MAX_HISTORY = 8 * 60 * 60 * 1000; // 8 hours

  addSnapshot(oi: number, price: number): void {
    this.snapshots.push({
      timestamp: Date.now(),
      openInterest: oi,
      price,
    });
    this.cleanup();
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.MAX_HISTORY;
    this.snapshots = this.snapshots.filter(s => s.timestamp > cutoff);
  }

  private getPattern(priceChange: number, oiChange: number): OIDivergencePattern {
    const priceUp = priceChange > 0.005;   // > 0.5%
    const priceDown = priceChange < -0.005; // < -0.5%
    const oiUp = oiChange > 0.02;           // > 2%
    const oiDown = oiChange < -0.02;        // < -2%

    if (priceUp && oiDown) return 'short_covering';
    if (priceDown && oiUp) return 'new_shorts';
    if (priceUp && oiUp) return 'new_longs';
    if (priceDown && oiDown) return 'long_liquidation';

    return null;
  }

  private getStrength(priceChange: number, oiChange: number): OIDivergenceState['strength'] {
    const magnitude = Math.abs(priceChange) + Math.abs(oiChange);

    if (magnitude > 0.15) return 'strong';
    if (magnitude > 0.08) return 'moderate';
    return 'weak';
  }

  private calculateScore(priceChange: number, oiChange: number, pattern: OIDivergencePattern): number {
    // Score from -100 to +100
    // Positive = bullish setup, Negative = bearish setup

    if (!pattern) return 0;

    const magnitude = Math.min(Math.abs(priceChange) + Math.abs(oiChange), 0.3);
    const normalizedMagnitude = magnitude / 0.3 * 100;

    switch (pattern) {
      case 'new_longs':
        return Math.round(normalizedMagnitude); // Bullish
      case 'short_covering':
        return Math.round(normalizedMagnitude * 0.5); // Weak bullish
      case 'new_shorts':
        return Math.round(-normalizedMagnitude); // Bearish
      case 'long_liquidation':
        return Math.round(-normalizedMagnitude * 0.7); // Bearish but may be capitulation
      default:
        return 0;
    }
  }

  getState(): OIDivergenceState {
    if (this.snapshots.length < 2) {
      return {
        score: 0,
        pattern: null,
        strength: 'weak',
        priceChange: 0,
        oiChange: 0,
      };
    }

    // Compare current to 1 hour ago
    const cutoff1h = Date.now() - this.WINDOW_1H;
    const oldSnapshots = this.snapshots.filter(s => s.timestamp < cutoff1h);

    if (oldSnapshots.length === 0) {
      // Not enough history, use oldest available
      const oldest = this.snapshots[0];
      const newest = this.snapshots[this.snapshots.length - 1];

      const priceChange = (newest.price - oldest.price) / oldest.price;
      const oiChange = (newest.openInterest - oldest.openInterest) / oldest.openInterest;
      const pattern = this.getPattern(priceChange, oiChange);

      return {
        score: this.calculateScore(priceChange, oiChange, pattern),
        pattern,
        strength: this.getStrength(priceChange, oiChange),
        priceChange: priceChange * 100,
        oiChange: oiChange * 100,
      };
    }

    const baseline = oldSnapshots[oldSnapshots.length - 1];
    const current = this.snapshots[this.snapshots.length - 1];

    const priceChange = (current.price - baseline.price) / baseline.price;
    const oiChange = (current.openInterest - baseline.openInterest) / baseline.openInterest;
    const pattern = this.getPattern(priceChange, oiChange);

    return {
      score: this.calculateScore(priceChange, oiChange, pattern),
      pattern,
      strength: this.getStrength(priceChange, oiChange),
      priceChange: priceChange * 100,
      oiChange: oiChange * 100,
    };
  }

  reset(): void {
    this.snapshots = [];
  }
}

export const oiDivergenceDetector = new OIDivergenceDetector();
