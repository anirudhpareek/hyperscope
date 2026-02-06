import type { TrapRisk, HistoricalSnapshot } from '@/types/state';
import { mean, stdDev } from './utils';

export interface TrapInput {
  currentOI: number;
  currentFunding: number;
  currentPrice: number;
  priorSnapshot: HistoricalSnapshot; // 1-4 hours ago
  fundingHistory: number[]; // Recent funding rates for std dev calc
}

export function calculateTrapRisk(input: TrapInput): TrapRisk {
  const {
    currentOI,
    currentFunding,
    currentPrice,
    priorSnapshot,
    fundingHistory,
  } = input;

  // 1. OI rising aggressively (10%+ increase)
  const oiDelta = priorSnapshot.openInterest > 0
    ? (currentOI - priorSnapshot.openInterest) / priorSnapshot.openInterest
    : 0;
  const oiRisingAggressively = oiDelta > 0.1;

  // 2. Funding extreme (2+ std devs from mean)
  const fundingMean = mean(fundingHistory);
  const fundingStd = stdDev(fundingHistory);
  const fundingDeviation = fundingStd > 0
    ? (currentFunding - fundingMean) / fundingStd
    : 0;
  const fundingExtreme = Math.abs(fundingDeviation) > 2;

  // 3. Price not moving proportionally (< 2% move)
  const priceMove = priorSnapshot.price > 0
    ? (currentPrice - priorSnapshot.price) / priorSnapshot.price
    : 0;
  const priceMoveSmall = Math.abs(priceMove) < 0.02;

  // Trap detection
  const elevated = oiRisingAggressively && fundingExtreme && priceMoveSmall;

  // Determine trap direction
  // Positive funding = longs paying shorts = longs crowded
  // Negative funding = shorts paying longs = shorts crowded
  let direction: 'long' | 'short' | null = null;
  if (elevated) {
    direction = currentFunding > 0 ? 'long' : 'short';
  }

  return {
    elevated,
    oiDelta: oiDelta * 100, // As percentage
    fundingDeviation,
    priceMovement: priceMove * 100, // As percentage
    direction,
  };
}

export function createSnapshot(
  openInterest: number,
  fundingRate: number,
  price: number
): HistoricalSnapshot {
  return {
    timestamp: Date.now(),
    openInterest,
    fundingRate,
    price,
  };
}
