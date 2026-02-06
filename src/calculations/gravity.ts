import type { OrderbookState, LiquidationGravity, GravityScore } from '@/types/state';

interface DepthAnalysis {
  thinZoneDistance: number | null;
  cumulativeDepth: number;
  avgLevelSize: number;
}

function analyzeDepth(
  levels: Array<{ price: number; size: number }>,
  currentPrice: number,
  isAbove: boolean
): DepthAnalysis {
  if (levels.length === 0) {
    return { thinZoneDistance: null, cumulativeDepth: 0, avgLevelSize: 0 };
  }

  const avgSize = levels.reduce((sum, l) => sum + l.size, 0) / levels.length;
  let cumulativeDepth = 0;
  let thinZoneDistance: number | null = null;

  for (const level of levels) {
    const distance = Math.abs(level.price - currentPrice) / currentPrice;

    if (distance > 0.05) break; // Only look within 5%

    cumulativeDepth += level.size;

    // Thin zone = level with < 30% of average size
    if (level.size < avgSize * 0.3 && thinZoneDistance === null && distance > 0.005) {
      thinZoneDistance = distance;
    }
  }

  return {
    thinZoneDistance,
    cumulativeDepth,
    avgLevelSize: avgSize,
  };
}

export function calculateLiquidationGravity(
  orderbook: OrderbookState,
  currentPrice: number
): LiquidationGravity {
  // Analyze ask side (above current price)
  const askAnalysis = analyzeDepth(orderbook.asks, currentPrice, true);

  // Analyze bid side (below current price)
  const bidAnalysis = analyzeDepth(orderbook.bids, currentPrice, false);

  const totalDepth = askAnalysis.cumulativeDepth + bidAnalysis.cumulativeDepth;

  // Calculate density as ratio of depth to one side vs total
  const densityAbove = totalDepth > 0 ? askAnalysis.cumulativeDepth / totalDepth : 0.5;
  const densityBelow = totalDepth > 0 ? bidAnalysis.cumulativeDepth / totalDepth : 0.5;

  // Calculate imbalance
  const imbalance = densityAbove - densityBelow; // Positive = more liquidity above

  // Determine gravity score
  let score: GravityScore = 'BALANCED';

  // High gravity above: thin zone above AND significant imbalance toward bids
  if (askAnalysis.thinZoneDistance !== null &&
      askAnalysis.thinZoneDistance < 0.03 &&
      imbalance < -0.2) {
    score = 'HIGH_ABOVE';
  }
  // High gravity below: thin zone below AND significant imbalance toward asks
  else if (bidAnalysis.thinZoneDistance !== null &&
           bidAnalysis.thinZoneDistance < 0.03 &&
           imbalance > 0.2) {
    score = 'HIGH_BELOW';
  }

  return {
    score,
    nearestAbove: askAnalysis.thinZoneDistance,
    nearestBelow: bidAnalysis.thinZoneDistance,
    densityAbove,
    densityBelow,
  };
}
