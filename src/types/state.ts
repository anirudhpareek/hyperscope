// Internal state types

export interface MarketState {
  coin: string;
  price: number;
  markPrice: number;
  oraclePrice: number;
  openInterest: number;
  fundingRate: number;
  fundingAnnualized: number;
  premium: number;
  dayVolume: number;
  lastUpdate: number;
}

export interface OrderbookState {
  coin: string;
  bids: Array<{ price: number; size: number; count: number }>;
  asks: Array<{ price: number; size: number; count: number }>;
  bidDepthPct: number[];   // Cumulative depth at 1%, 2%, 3%, 4%, 5%
  askDepthPct: number[];
  imbalance: number;       // -1 to 1
  spreadPct: number;
  lastUpdate: number;
}

export interface VolatilityState {
  atr14: number;
  range24h: number;
  bbWidth: number;
  bbWidthPercentile: number;
  historicalVolatility: number;
}

export interface VolumeState {
  recent15m: number;
  avg15m: number;
  ratio: number;
  declining: boolean;
}

export interface PressureScenario {
  liqEstimate: number;
  fundingImpact: 'positive' | 'negative' | 'neutral';
  oiImplication: string;
  structuralBeneficiary: 'longs' | 'shorts' | 'neutral';
}

export interface PressureMap {
  upside: PressureScenario & {
    vacuumZones: number[];
  };
  downside: PressureScenario & {
    trapRisk: 'longs' | 'shorts' | 'neutral';
  };
}

export type GravityScore = 'HIGH_ABOVE' | 'HIGH_BELOW' | 'BALANCED';

export interface LiquidationGravity {
  score: GravityScore;
  nearestAbove: number | null;
  nearestBelow: number | null;
  densityAbove: number;
  densityBelow: number;
}

export interface CompressionSignals {
  rangeNarrowing: boolean;
  oiRising: boolean;
  fundingExtreme: boolean;
  volumeDeclining: boolean;
}

export interface CompressionState {
  isCompressed: boolean;
  signals: CompressionSignals;
  score: number;
}

export interface TrapRisk {
  elevated: boolean;
  oiDelta: number;
  fundingDeviation: number;
  priceMovement: number;
  direction: 'long' | 'short' | null;
}

export interface AnalyticsState {
  coin: string;
  market: MarketState;
  orderbook: OrderbookState;
  volatility: VolatilityState;
  volume: VolumeState;
  pressure: PressureMap;
  gravity: LiquidationGravity;
  compression: CompressionState;
  trap: TrapRisk;
  cvd: CVDState;
  tape: TapeState;
  oiDivergence: OIDivergenceState;
  lastUpdate: number;
}

// Message passing types
export type MessageType =
  | 'SUBSCRIBE'
  | 'UNSUBSCRIBE'
  | 'STATE_UPDATE'
  | 'GET_STATE';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface SubscribeMessage extends ExtensionMessage {
  type: 'SUBSCRIBE';
  payload: { coin: string };
}

export interface StateUpdateMessage extends ExtensionMessage {
  type: 'STATE_UPDATE';
  payload: AnalyticsState;
}

// Historical state for trap detection
export interface HistoricalSnapshot {
  timestamp: number;
  openInterest: number;
  fundingRate: number;
  price: number;
}

// CVD (Cumulative Volume Delta) state
export interface CVDState {
  cumulative: number;
  delta5m: number;
  delta15m: number;
  delta1h: number;
  momentum: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  divergence: 'bullish' | 'bearish' | null;
  lastUpdate: number;
}

// Trade tape entry
export interface TapeEntry {
  timestamp: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  notional: number;
  isWhale: boolean;
}

// Tape state
export interface TapeState {
  recentTrades: TapeEntry[];
  whaleCount5m: number;
  whaleBuyVolume: number;
  whaleSellVolume: number;
  buyIntensity: number;  // 0-100
  sellIntensity: number; // 0-100
  lastWhale: TapeEntry | null;
}

// OI x Price Divergence
export type OIDivergencePattern =
  | 'short_covering'    // Price up + OI down = weak rally
  | 'new_shorts'        // Price down + OI up = trend continuation down
  | 'new_longs'         // Price up + OI up = strong rally
  | 'long_liquidation'  // Price down + OI down = capitulation
  | null;

export interface OIDivergenceState {
  score: number;  // -100 to +100
  pattern: OIDivergencePattern;
  strength: 'weak' | 'moderate' | 'strong';
  priceChange: number;
  oiChange: number;
}
