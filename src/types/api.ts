// Hyperliquid API Response Types

export interface AssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
  isDelisted?: boolean;
}

export interface AssetContext {
  dayNtlVlm: string;
  funding: string;
  impactPxs: [string, string];
  markPx: string;
  midPx: string;
  openInterest: string;
  oraclePx: string;
  premium: string;
  prevDayPx: string;
}

export interface MetaAndAssetCtxsResponse {
  meta: {
    universe: AssetMeta[];
  };
  assetCtxs: AssetContext[];
}

export interface L2Level {
  px: string;
  sz: string;
  n: number;
}

export interface L2BookResponse {
  coin: string;
  time: number;
  levels: [L2Level[], L2Level[]]; // [bids, asks]
}

export interface Candle {
  t: number;      // Open time
  T: number;      // Close time
  s: string;      // Symbol
  i: string;      // Interval
  o: string;      // Open
  h: string;      // High
  l: string;      // Low
  c: string;      // Close
  v: string;      // Volume
  n: number;      // Trade count
}

export interface FundingHistoryEntry {
  coin: string;
  fundingRate: string;
  premium: string;
  time: number;
}

export interface WsTrade {
  coin: string;
  side: 'A' | 'B';  // A = Ask (sell), B = Bid (buy)
  px: string;
  sz: string;
  hash: string;
  time: number;
  tid: number;
}

export interface WsBookUpdate {
  coin: string;
  time: number;
  levels: [L2Level[], L2Level[]];
}

export interface WsActiveAssetCtx {
  coin: string;
  ctx: AssetContext;
}

// WebSocket message types
export type WsChannel =
  | 'l2Book'
  | 'trades'
  | 'allMids'
  | 'activeAssetCtx';

export interface WsSubscription {
  type: WsChannel;
  coin?: string;
}

export interface WsMessage {
  channel: WsChannel;
  data: unknown;
}

// API request types
export interface InfoRequest {
  type: string;
  [key: string]: unknown;
}

export interface CandleSnapshotRequest {
  type: 'candleSnapshot';
  req: {
    coin: string;
    interval: string;
    startTime: number;
    endTime?: number;
  };
}

export interface FundingHistoryRequest {
  type: 'fundingHistory';
  coin: string;
  startTime: number;
  endTime?: number;
}

export interface L2BookRequest {
  type: 'l2Book';
  coin: string;
  nSigFigs?: 2 | 3 | 4 | 5;
  nLevels?: number;
}
