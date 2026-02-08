import { render, h } from 'preact';
import { Panel } from '@/panel/Panel';
import type { AnalyticsState } from '@/types/state';

const PANEL_ID = 'hl-analytics-panel';

export class PanelInjector {
  private container: HTMLDivElement | null = null;
  private currentState: AnalyticsState | null = null;

  inject(): void {
    if (this.container) return;

    // Create container
    this.container = document.createElement('div');
    this.container.id = PANEL_ID;
    document.body.appendChild(this.container);

    console.log('[HL] Panel injected');

    // Render empty panel
    this.render();
  }

  updateState(state: AnalyticsState): void {
    this.currentState = state;
    this.render();
  }

  private render(): void {
    if (!this.container) return;

    try {
      render(
        h(Panel, { state: this.currentState }),
        this.container
      );
    } catch (e) {
      console.error('[Injector] Render error:', e);
    }
  }

  remove(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  isInjected(): boolean {
    return this.container !== null;
  }
}

export const panelInjector = new PanelInjector();
