/** 颜色、字体与动效 token；组件内不得出现像素或色值常量。 */
export const TOKENS = {
  color: {
    bg: '#FFFFFF',
    panel: '#F7F9FC',
    line: '#C9D2DC',
    linePassed: '#4A5568',
    text: '#1F2937',
    textMuted: '#667085',
    vpn: '#2E6BE6',
    offset: '#1E9E6A',
    hit: '#12A594',
    error: '#D93F3F',
    focus: '#FFB020',
    tableTag: '#8B6CEF',
  },
  font: {
    mono: '13px/1.4 "JetBrains Mono", ui-monospace, monospace',
    ui: '14px/1.5 system-ui, "PingFang SC", sans-serif',
    title: '600 16px/1.4 system-ui, "PingFang SC", sans-serif',
  },
  motion: {
    base: '240ms cubic-bezier(0.2, 0, 0, 1)',
    probe: '320ms cubic-bezier(0.2, 0, 0, 1)',
    fade: '200ms linear',
  },
  focusRing: {
    width: 2,
    glow: '0 0 0 3px rgba(255, 176, 32, 0.25)',
  },
} as const;

export type Tokens = typeof TOKENS;
