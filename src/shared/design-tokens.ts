// Hyperliquid Design System - Color Tokens
// Extracted from app.hyperliquid.xyz

export const colors = {
  // Primary accent - signature Hyperliquid cyan
  accent: '#23F7DD',
  accentHover: '#4DFAE6',
  accentMuted: 'rgba(35, 247, 221, 0.15)',
  accentBorder: 'rgba(35, 247, 221, 0.3)',

  // Semantic colors
  long: '#0ECB81', // Green for longs/bids/positive
  longMuted: 'rgba(14, 203, 129, 0.15)',
  short: '#F6465D', // Red for shorts/asks/negative
  shortMuted: 'rgba(246, 70, 93, 0.15)',
  warning: '#F0B90B', // Amber for warnings
  warningMuted: 'rgba(240, 185, 11, 0.15)',

  // Backgrounds (darkest to lightest)
  bgBase: '#0d0e10', // Main background
  bgSurface: '#141519', // Cards, panels
  bgElevated: '#1a1d21', // Elevated elements
  bgHover: '#1f2228', // Hover states
  bgActive: '#252930', // Active/pressed states

  // Text colors
  textPrimary: '#EAECEF', // Primary text
  textSecondary: '#848E9C', // Secondary text
  textMuted: '#5E6673', // Muted/disabled text
  textDisabled: '#3C4149', // Disabled text

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderHover: 'rgba(255, 255, 255, 0.1)',
  borderActive: 'rgba(255, 255, 255, 0.15)',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
} as const;

export const typography = {
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  sizes: {
    xs: '10px',
    sm: '11px',
    base: '12px',
    md: '13px',
    lg: '14px',
    xl: '16px',
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
  },
} as const;

export const borderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
} as const;

export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
} as const;
