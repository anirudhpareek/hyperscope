import type { MarketState, VolatilityState, VolumeState, CompressionState } from '@/types/state';
import type { Candle } from '@/types/api';
import { mean, stdDev, bollingerWidth, historicalBollingerWidths, percentileRank } from './utils';

export interface CompressionInput {
  candles: Candle[];
  currentOI: number;
  priorOI: number;
  fundingRate: number;
  recentVolume: number;
  avgVolume: number;
}

export function calculateVolatilityState(candles: Candle[]): VolatilityState {
  if (candles.length < 20) {
    return {
      atr14: 0,
      range24h: 0,
      bbWidth: 0,
      bbWidthPercentile: 0.5,
      historicalVolatility: 0,
    };
  }

  const closes = candles.map((c) => parseFloat(c.c));
  const highs = candles.map((c) => parseFloat(c.h));
  const lows = candles.map((c) => parseFloat(c.l));

  // ATR calculation
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const prevC = closes[i - 1];
    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trueRanges.push(tr);
  }
  const atr14 = mean(trueRanges.slice(-14));

  // 24h range (assuming 15m candles = 96 candles per day)
  const last96 = candles.slice(-96);
  const high24h = Math.max(...last96.map((c) => parseFloat(c.h)));
  const low24h = Math.min(...last96.map((c) => parseFloat(c.l)));
  const mid24h = (high24h + low24h) / 2;
  const range24h = mid24h > 0 ? (high24h - low24h) / mid24h : 0;

  // Bollinger width
  const bbWidth = bollingerWidth(closes, 20);
  const historicalWidths = historicalBollingerWidths(closes, 20, 100);
  const bbWidthPercentile = percentileRank(bbWidth, historicalWidths);

  // Historical volatility (annualized std dev of returns)
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }
  }
  const dailyVol = stdDev(returns);
  const historicalVolatility = dailyVol * Math.sqrt(365 * 96); // Annualized for 15m

  return {
    atr14,
    range24h,
    bbWidth,
    bbWidthPercentile,
    historicalVolatility,
  };
}

export function calculateVolumeState(
  recentVolume: number,
  avgVolume: number
): VolumeState {
  const ratio = avgVolume > 0 ? recentVolume / avgVolume : 1;
  return {
    recent15m: recentVolume,
    avg15m: avgVolume,
    ratio,
    declining: ratio < 0.7,
  };
}

export function detectCompression(input: CompressionInput): CompressionState {
  const { candles, currentOI, priorOI, fundingRate, recentVolume, avgVolume } = input;

  // 1. Range narrowing: BB width in bottom 20%
  const volatility = calculateVolatilityState(candles);
  const rangeNarrowing = volatility.bbWidthPercentile < 0.2;

  // 2. OI rising: 5%+ increase
  const oiChange = priorOI > 0 ? (currentOI - priorOI) / priorOI : 0;
  const oiRising = oiChange > 0.05;

  // 3. Funding extreme or stable
  const fundingAnnualized = Math.abs(fundingRate * 24 * 365);
  const fundingExtreme = fundingAnnualized > 0.5 || fundingAnnualized < 0.05;

  // 4. Volume declining: 30%+ drop
  const volumeRatio = avgVolume > 0 ? recentVolume / avgVolume : 1;
  const volumeDeclining = volumeRatio < 0.7;

  const signals = {
    rangeNarrowing,
    oiRising,
    fundingExtreme,
    volumeDeclining,
  };

  const score = Object.values(signals).filter(Boolean).length;

  return {
    isCompressed: score >= 3,
    signals,
    score,
  };
}
