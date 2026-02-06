// Detects the currently selected trading pair from Hyperliquid's UI

type CoinChangeCallback = (coin: string | null) => void;

export class SymbolDetector {
  private currentCoin: string | null = null;
  private observer: MutationObserver | null = null;
  private callbacks: Set<CoinChangeCallback> = new Set();
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.start();
  }

  onCoinChange(callback: CoinChangeCallback): () => void {
    this.callbacks.add(callback);
    // Immediately notify with current coin
    if (this.currentCoin) {
      callback(this.currentCoin);
    }
    return () => this.callbacks.delete(callback);
  }

  private notify(coin: string | null): void {
    if (coin !== this.currentCoin) {
      this.currentCoin = coin;
      this.callbacks.forEach((cb) => cb(coin));
    }
  }

  private detectCoin(): string | null {
    // Strategy 1: Check URL hash for trading pair
    // Hyperliquid uses URLs like https://app.hyperliquid.xyz/trade/BTC
    const pathMatch = window.location.pathname.match(/\/trade\/([A-Z0-9]+)/i);
    if (pathMatch) {
      return pathMatch[1].toUpperCase();
    }

    // Strategy 2: Look for the coin selector/header element
    // The trading UI typically shows the selected pair prominently
    const selectors = [
      '[data-testid="market-selector"]',
      '.market-selector',
      '.trading-pair',
      'h1',
      'h2',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim() || '';
        // Match patterns like "BTC-PERP", "ETH/USD", "BTC", etc.
        const match = text.match(/^([A-Z]{2,10})(?:[-\/](?:PERP|USD|USDC))?$/i);
        if (match) {
          return match[1].toUpperCase();
        }
      }
    }

    // Strategy 3: Check for coin in any visible chart title
    const chartElements = document.querySelectorAll('[class*="chart"], [class*="Chart"]');
    for (const el of chartElements) {
      const text = el.textContent?.slice(0, 50) || '';
      const match = text.match(/([A-Z]{2,10})(?:[-\/]PERP)?/i);
      if (match) {
        return match[1].toUpperCase();
      }
    }

    return null;
  }

  private start(): void {
    // Initial detection
    const coin = this.detectCoin();
    if (coin) {
      this.notify(coin);
    }

    // Watch for URL changes (SPA navigation)
    this.setupUrlWatcher();

    // Watch for DOM changes
    this.setupMutationObserver();

    // Periodic fallback check
    this.checkInterval = setInterval(() => {
      const coin = this.detectCoin();
      if (coin) {
        this.notify(coin);
      }
    }, 2000);
  }

  private setupUrlWatcher(): void {
    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', () => {
      const coin = this.detectCoin();
      this.notify(coin);
    });

    // Override pushState/replaceState to catch SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => {
        const coin = this.detectCoin();
        this.notify(coin);
      }, 100);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => {
        const coin = this.detectCoin();
        this.notify(coin);
      }, 100);
    };
  }

  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      // Debounce - only check if significant changes
      const hasRelevantChanges = mutations.some((m) => {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          return true;
        }
        if (m.type === 'characterData') {
          return true;
        }
        return false;
      });

      if (hasRelevantChanges) {
        const coin = this.detectCoin();
        if (coin) {
          this.notify(coin);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  getCurrentCoin(): string | null {
    return this.currentCoin;
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.callbacks.clear();
  }
}

export const symbolDetector = new SymbolDetector();
