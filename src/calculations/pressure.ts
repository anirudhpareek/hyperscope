import type { MarketState, OrderbookState, PressureMap, PressureScenario } from '@/types/state';

const AVG_LEVERAGE = 10;
const RISK_FRACTION = 0.3;

type FundingImpact = 'positive' | 'negative' | 'neutral';

function getFundingRegime(annualizedRate: number): 'extreme_positive' | 'positive' | 'extreme_negative' | 'negative' | 'neutral' {
  if (annualizedRate > 0.5) return 'extreme_positive';
  if (annualizedRate > 0.2) return 'positive';
  if (annualizedRate < -0.5) return 'extreme_negative';
  if (annualizedRate < -0.2) return 'negative';
  return 'neutral';
}

function estimateLiquidations(
  openInterest: number,
  price: number,
  isLongs: boolean
): number {
  const oiNotional = openInterest * price;
  const positionFraction = 0.5; // Assume 50% longs, 50% shorts
  const marginAtRisk = oiNotional * positionFraction * (1 / AVG_LEVERAGE) * RISK_FRACTION;
  return marginAtRisk;
}

function getUpsideFundingImpact(regime: ReturnType<typeof getFundingRegime>): FundingImpact {
  if (regime === 'extreme_positive') return 'positive'; // Shorts crushed by funding + price
  if (regime === 'extreme_negative') return 'negative'; // Shorts relieved
  return 'neutral';
}

function getDownsideFundingImpact(regime: ReturnType<typeof getFundingRegime>): FundingImpact {
  if (regime === 'extreme_negative') return 'positive'; // Longs crushed by funding + price
  if (regime === 'extreme_positive') return 'negative'; // Longs relieved
  return 'neutral';
}

function getUpsideOiImplication(fundingRate: number): string {
  if (fundingRate > 0.0001) return 'Short squeeze → OI likely drops';
  if (fundingRate < -0.0001) return 'Counter-trend rally → OI may rise';
  return 'Breakout → OI direction unclear';
}

function getDownsideOiImplication(fundingRate: number): string {
  if (fundingRate < -0.0001) return 'Long squeeze → OI likely drops';
  if (fundingRate > 0.0001) return 'Counter-trend drop → OI may rise';
  return 'Breakdown → OI direction unclear';
}

function getBeneficiary(fundingRate: number, isUpside: boolean): 'longs' | 'shorts' | 'neutral' {
  const threshold = 0.0001; // 0.01%
  if (isUpside) {
    if (fundingRate > threshold) return 'longs';
    if (fundingRate < -threshold) return 'shorts';
  } else {
    if (fundingRate < -threshold) return 'shorts';
    if (fundingRate > threshold) return 'longs';
  }
  return 'neutral';
}

function findVacuumZones(orderbook: OrderbookState, price: number): number[] {
  const zones: number[] = [];
  const avgSize = orderbook.bids.reduce((sum, b) => sum + b.size, 0) / orderbook.bids.length;

  // Find thin levels in the bid side (vacuum zones below)
  for (const bid of orderbook.bids) {
    if (bid.size < avgSize * 0.3) {
      const pctBelow = (price - bid.price) / price;
      if (pctBelow > 0.01 && pctBelow < 0.05) {
        zones.push(bid.price);
      }
    }
  }

  return zones.slice(0, 3); // Top 3 vacuum zones
}

export function calculatePressureMap(
  market: MarketState,
  orderbook: OrderbookState
): PressureMap {
  const { price, openInterest, fundingRate, fundingAnnualized } = market;
  const regime = getFundingRegime(fundingAnnualized);

  const upside: PressureScenario & { vacuumZones: number[] } = {
    liqEstimate: estimateLiquidations(openInterest, price * 1.05, false),
    fundingImpact: getUpsideFundingImpact(regime),
    oiImplication: getUpsideOiImplication(fundingRate),
    structuralBeneficiary: getBeneficiary(fundingRate, true),
    vacuumZones: [], // Not applicable for upside
  };

  const downside: PressureScenario & { trapRisk: 'longs' | 'shorts' | 'neutral' } = {
    liqEstimate: estimateLiquidations(openInterest, price * 0.95, true),
    fundingImpact: getDownsideFundingImpact(regime),
    oiImplication: getDownsideOiImplication(fundingRate),
    structuralBeneficiary: getBeneficiary(fundingRate, false),
    trapRisk: fundingRate > 0.0005 ? 'longs' : fundingRate < -0.0005 ? 'shorts' : 'neutral',
  };

  // Find vacuum zones below current price
  const vacuumZones = findVacuumZones(orderbook, price);

  return {
    upside: { ...upside, vacuumZones },
    downside,
  };
}
