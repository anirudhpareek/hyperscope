═══════════════════════════════════════════════════════════════════════════════
DATA ARCHITECTURE PLAN: HyperScope Extension
═══════════════════════════════════════════════════════════════════════════════

## Current Architecture Analysis

### How Data is Currently Stored

**ALL DATA IS IN-MEMORY ONLY** - Nothing persists to disk.

| Component | Data Stored | Retention | Memory Usage |
|-----------|------------|-----------|--------------|
| StateManager | Candles, Snapshots, Orderbook | 24 hours | ~500KB/coin |
| CVDCalculator | Trades, Price history | 2 hours | ~100KB/coin |
| TapeTracker | Recent trades (100 max) | Session only | ~20KB/coin |
| OIDivergence | OI/Price snapshots | 1 hour | ~10KB/coin |

**Total per coin:** ~630KB in RAM
**When data is lost:** Browser close, tab close, coin switch, extension reload

### Current Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     HYPERLIQUID API                             │
│  wss://api.hyperliquid.xyz/ws  |  api.hyperliquid.xyz/info     │
└─────────────────────────────────────────────────────────────────┘
                              │
                    WebSocket + REST Polling
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXTENSION BACKGROUND                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ StateManager │  │ CVDCalculator│  │ TapeTracker  │  (RAM)   │
│  │  (24h data)  │  │   (2h data)  │  │ (100 trades) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                        chrome.runtime
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SIDEPANEL UI                               │
│                    (Receives state updates)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Problems

1. **No Persistence** - History lost on browser close
2. **Limited Windows** - Only 2h CVD, 24h candles
3. **Per-User Fetching** - 1000 users = 1000x same API calls
4. **No Cross-Session Analysis** - Can't detect multi-day patterns
5. **Coin Switch Reset** - Lose all accumulated data when changing coins

───────────────────────────────────────────────────────────────────────────────
## Architecture Options
───────────────────────────────────────────────────────────────────────────────

### Option A: Client-Side IndexedDB (Simple)

Store historical data locally in browser's IndexedDB.

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                     EXTENSION                          │    │
│  │  ┌──────────────┐        ┌─────────────────────────┐  │    │
│  │  │   RAM Cache  │ ←────→ │      IndexedDB          │  │    │
│  │  │ (hot data)   │        │  - CVD history (7 days) │  │    │
│  │  └──────────────┘        │  - Trade tape (7 days)  │  │    │
│  │                          │  - OI snapshots (30 days)│  │    │
│  │                          │  - Candles (30 days)    │  │    │
│  │                          └─────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Pros:**
- Simple to implement
- No server costs
- Works offline
- Data stays with user

**Cons:**
- Each user stores redundant data
- Device-specific (no sync across devices)
- Storage limits (~50MB default, can request more)
- Still fetching same data independently

**Implementation:**
- ~1-2 days of work
- Use idb library for IndexedDB
- Add data pruning (delete data older than X days)

---

### Option B: Centralized Server (Recommended for Scale)

Run a backend that streams all tickers 24/7 and serves historical data.

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR BACKEND SERVER                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Data Collector Service                    │    │
│  │  - Connects to Hyperliquid WS for ALL tickers         │    │
│  │  - Stores trades, CVD, OI, candles                    │    │
│  │  - Runs 24/7                                          │    │
│  └────────────────────────────────────────────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    Database                            │    │
│  │  TimescaleDB / ClickHouse / InfluxDB                  │    │
│  │  - Trades: 90 days                                    │    │
│  │  - CVD snapshots: 1 year                              │    │
│  │  - Candles: Forever                                   │    │
│  │  - OI history: 1 year                                 │    │
│  └────────────────────────────────────────────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   API Gateway                          │    │
│  │  - REST: GET /history/:coin                           │    │
│  │  - WebSocket: Real-time aggregated data               │    │
│  │  - Auth: API keys for rate limiting                   │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                   Your WebSocket / REST API
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTENSION (All Users)                        │
│  - Connects to YOUR server instead of direct Hyperliquid       │
│  - Gets instant historical data                                 │
│  - Lower latency (pre-aggregated)                              │
│  - No redundant processing                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Pros:**
- Single source of truth
- Historical data available instantly for all users
- Better for ML/pattern detection (centralized data)
- Reduced Hyperliquid API load
- Can add premium features (longer history, alerts, etc.)
- Server-side analytics possible

**Cons:**
- Infrastructure costs (~$50-200/mo for VPS + DB)
- More complex to build and maintain
- Single point of failure
- Need monitoring/ops

**Tech Stack Recommendation:**
```
- Runtime: Node.js / Bun
- Database: TimescaleDB (PostgreSQL extension for time-series)
- Cache: Redis (for real-time state)
- Hosting: Railway / Fly.io / AWS
- WebSocket: Socket.io or ws
```

**Implementation:**
- ~1-2 weeks of work
- Separate repo for backend
- Extension becomes thin client

---

### Option C: Hybrid (Best of Both Worlds)

Server stores long-term history, client caches recent data locally.

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER                               │
│  - Stores all historical data (months/years)                   │
│  - Serves aggregated data via API                              │
│  - Handles heavy computation                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTENSION                                    │
│  ┌───────────────┐      ┌────────────────────┐                 │
│  │   RAM Cache   │ ←──→ │    IndexedDB       │                 │
│  │  (real-time)  │      │  (7 days local)    │                 │
│  └───────────────┘      └────────────────────┘                 │
│          │                                                      │
│          │ Fetches historical data on first load               │
│          ▼                                                      │
│  ┌───────────────────────────────────────────┐                 │
│  │  Syncs with server for older history      │                 │
│  │  Falls back to local if server down       │                 │
│  └───────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

───────────────────────────────────────────────────────────────────────────────
## Recommendation
───────────────────────────────────────────────────────────────────────────────

### Phase 1: Quick Win (IndexedDB) - Ship Now

Add client-side persistence to avoid data loss. Ship the extension.

**Changes:**
1. Add IndexedDB storage for:
   - CVD history (7 days per coin)
   - OI snapshots (30 days per coin)
   - Trade tape summary (7 days per coin)

2. Add data pruning to prevent bloat

3. Add storage usage indicator in settings

**Storage estimates per coin:**
- CVD snapshots (1/min): ~10KB/day × 7 days = 70KB
- OI snapshots (1/hr): ~1KB/day × 30 days = 30KB
- Trade summaries: ~50KB/day × 7 days = 350KB
- **Total: ~450KB per coin tracked**

**For 10 actively traded coins: ~4.5MB** (well under limits)

---

### Phase 2: Centralized Backend (For Growth)

Once you have users and want premium features:

1. Build data collector service
2. Store historical data for all tickers
3. Extension connects to your server
4. Enable features like:
   - Multi-day pattern detection
   - Cross-coin correlation
   - Liquidation heatmaps
   - Historical backtesting
   - Alerts/notifications

---

## Data Retention Strategy

| Data Type | Client (IndexedDB) | Server (Future) |
|-----------|-------------------|-----------------|
| Raw trades | Don't store | 90 days |
| CVD snapshots | 7 days | 1 year |
| OI snapshots | 30 days | 1 year |
| Candle data | Don't store (use API) | 5 years |
| Whale trades | 7 days | 1 year |
| Orderbook | Don't store | Don't store |

───────────────────────────────────────────────────────────────────────────────
## Implementation Plan (Phase 1 - IndexedDB)
───────────────────────────────────────────────────────────────────────────────

### Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| CREATE | src/storage/db.ts | IndexedDB wrapper |
| CREATE | src/storage/schema.ts | Database schema definitions |
| MODIFY | src/background/state.ts | Add persistence hooks |
| MODIFY | src/calculations/cvd.ts | Persist CVD history |
| MODIFY | src/sidepanel/index.tsx | Add storage stats to settings |

### Database Schema

```typescript
// IndexedDB Schema
interface HLAnalyticsDB {
  cvdSnapshots: {
    key: [coin: string, timestamp: number];
    value: {
      coin: string;
      timestamp: number;
      cumulative: number;
      delta5m: number;
      delta15m: number;
      delta1h: number;
    };
    indexes: { byCoin: string };
  };

  oiSnapshots: {
    key: [coin: string, timestamp: number];
    value: {
      coin: string;
      timestamp: number;
      openInterest: number;
      price: number;
      funding: number;
    };
    indexes: { byCoin: string };
  };

  whaleTrades: {
    key: number; // auto-increment
    value: {
      coin: string;
      timestamp: number;
      price: number;
      size: number;
      side: 'buy' | 'sell';
      notional: number;
    };
    indexes: { byCoin: string; byTimestamp: number };
  };
}
```

### Pruning Strategy

```typescript
// Run daily or on extension startup
async function pruneOldData() {
  const db = await openDB();

  // Delete CVD older than 7 days
  const cvdCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await db.delete('cvdSnapshots', IDBKeyRange.upperBound(cvdCutoff));

  // Delete OI older than 30 days
  const oiCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  await db.delete('oiSnapshots', IDBKeyRange.upperBound(oiCutoff));

  // Delete whale trades older than 7 days
  const whaleCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await db.delete('whaleTrades', IDBKeyRange.upperBound(whaleCutoff));
}
```

═══════════════════════════════════════════════════════════════════════════════
## Decision Required
═══════════════════════════════════════════════════════════════════════════════

**Option A: Ship Now (No Persistence)**
- Publish extension as-is
- Data resets on browser close
- Simple, but limited

**Option B: Add IndexedDB First (1-2 days)**
- Add local persistence
- Better UX for users
- Ship after

**Option C: Build Backend First (1-2 weeks)**
- Full solution from day 1
- Best long-term
- Delays launch

**Recommended: Option B → then C**
Add IndexedDB for quick persistence, ship extension, then build backend for v2.

═══════════════════════════════════════════════════════════════════════════════
