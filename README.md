# Hyperliquid Structural Analytics

Chrome extension that overlays high-signal structural analytics on Hyperliquid's trading interface.

## Features

### Pressure Map
Displays structural implications for ±5% price moves:
- Estimated liquidations (long/short)
- Funding regime impact
- OI shift implications
- Structural beneficiary analysis

### Liquidation Gravity Score
Analyzes orderbook depth to identify:
- Thin liquidity zones (potential liquidation clusters)
- Directional gravity bias
- Depth imbalances

### Volatility Compression Detector
Detects regime compression based on:
- Range narrowing (Bollinger Band width percentile)
- OI rising
- Funding extreme/stable
- Volume declining

Triggers "Expansion probability elevated" when 3+ signals active.

### Trap Risk Indicator
Monitors for crowded positioning:
- OI rising aggressively (>10%)
- Funding extreme (>2σ from mean)
- Price stagnant (<2% move)

## Installation

### Development Build

```bash
cd ~/hyperliquid-analytics
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

## Architecture

```
src/
├── background/     # Service worker, API, WebSocket, state management
├── content/        # DOM detection, panel injection
├── panel/          # Preact UI components
├── calculations/   # All metric computations
└── types/          # TypeScript definitions
```

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `metaAndAssetCtxs` | OI, funding, mark price |
| `l2Book` | Orderbook depth (100 levels) |
| `candleSnapshot` | Historical OHLCV |
| `fundingHistory` | Historical funding rates |

## WebSocket Subscriptions

- `l2Book` - Real-time orderbook updates
- `activeAssetCtx` - Real-time funding/OI updates

## Notes

- Panel is draggable and minimizable
- Auto-detects currently selected trading pair
- Updates every 5 seconds (polling) + real-time (WebSocket)
- Dark mode compatible
