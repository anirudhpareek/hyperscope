import type {
  L2BookResponse,
  Candle,
  FundingHistoryEntry,
  AssetContext,
} from '@/types/api';

const API_URL = 'https://api.hyperliquid.xyz/info';

async function fetchInfo<T>(body: object): Promise<T> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function getMetaAndAssetCtxs(): Promise<{
  universe: string[];
  contexts: Map<string, AssetContext>;
}> {
  const data = await fetchInfo<[{ universe: Array<{ name: string }> }, AssetContext[]]>({
    type: 'metaAndAssetCtxs',
  });

  const [meta, ctxs] = data;
  const universe = meta.universe.map((a) => a.name);
  const contexts = new Map<string, AssetContext>();

  universe.forEach((name, i) => {
    if (ctxs[i]) {
      contexts.set(name, ctxs[i]);
    }
  });

  return { universe, contexts };
}

export async function getL2Book(coin: string, nLevels = 100): Promise<L2BookResponse> {
  return fetchInfo<L2BookResponse>({
    type: 'l2Book',
    coin,
    nSigFigs: 5,
    nLevels,
  });
}

export async function getCandles(
  coin: string,
  interval: string,
  startTime: number,
  endTime?: number
): Promise<Candle[]> {
  return fetchInfo<Candle[]>({
    type: 'candleSnapshot',
    req: {
      coin,
      interval,
      startTime,
      ...(endTime && { endTime }),
    },
  });
}

export async function getFundingHistory(
  coin: string,
  startTime: number,
  endTime?: number
): Promise<FundingHistoryEntry[]> {
  return fetchInfo<FundingHistoryEntry[]>({
    type: 'fundingHistory',
    coin,
    startTime,
    ...(endTime && { endTime }),
  });
}

export async function getAllMids(): Promise<Record<string, string>> {
  return fetchInfo<Record<string, string>>({ type: 'allMids' });
}
