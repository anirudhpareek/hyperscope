// Math utility functions

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

export function percentileRank(value: number, values: number[]): number {
  if (values.length === 0) return 0.5;
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex((v) => v >= value);
  if (index === -1) return 1;
  return index / sorted.length;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function atr(candles: Array<{ h: number; l: number; c: number }>, period = 14): number {
  if (candles.length < period + 1) return 0;

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(curr.h - curr.l, Math.abs(curr.h - prev.c), Math.abs(curr.l - prev.c));
    trueRanges.push(tr);
  }

  // Simple average of last N true ranges
  const recent = trueRanges.slice(-period);
  return mean(recent);
}

export function bollingerWidth(closes: number[], period = 20): number {
  if (closes.length < period) return 0;
  const recent = closes.slice(-period);
  const sma = mean(recent);
  const std = stdDev(recent);
  return (2 * std) / sma;
}

export function historicalBollingerWidths(closes: number[], period = 20, lookback = 100): number[] {
  const widths: number[] = [];
  for (let i = period; i <= closes.length && widths.length < lookback; i++) {
    const slice = closes.slice(i - period, i);
    const sma = mean(slice);
    const std = stdDev(slice);
    if (sma > 0) {
      widths.push((2 * std) / sma);
    }
  }
  return widths;
}

export function formatNumber(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
  return n.toFixed(decimals);
}

export function formatPct(n: number, decimals = 2): string {
  return (n * 100).toFixed(decimals) + '%';
}
