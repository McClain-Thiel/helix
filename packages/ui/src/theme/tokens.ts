/** Design tokens extracted from the Helix mockup - dark theme */
export const tokens = {
  bg: {
    app: '#0e0f11',
    panel: '#141518',
    surface: '#1a1b1f',
    elevated: '#1f2024',
    hover: '#25262b',
    active: '#2c2d33',
    overlay: 'rgba(0,0,0,0.6)',
  },
  border: {
    subtle: '#1e1f25',
    default: '#2a2b32',
    strong: '#3a3b42',
  },
  text: {
    primary: '#e8e9ed',
    secondary: '#9a9ba3',
    tertiary: '#6b6c74',
    inverse: '#0e0f11',
  },
  accent: {
    teal: '#2dd4a8',
    tealMuted: '#1a8c6e',
    tealBg: 'rgba(45,212,168,0.08)',
    tealBorder: 'rgba(45,212,168,0.15)',
    amber: '#f0b429',
    amberBg: 'rgba(240,180,41,0.08)',
    red: '#ef6b6b',
    redBg: 'rgba(239,107,107,0.08)',
    blue: '#5b9cf5',
    blueBg: 'rgba(91,156,245,0.08)',
    violet: '#a78bfa',
    violetBg: 'rgba(167,139,250,0.08)',
  },
  feature: {
    promoter: '#2dd4a8',
    cds: '#5b9cf5',
    terminator: '#ef6b6b',
    ori: '#f0b429',
    resistance: '#a78bfa',
    tag: '#f472b6',
    rbs: '#67e8f9',
    misc: '#9a9ba3',
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },
  font: {
    sans: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    display: "'DM Sans', -apple-system, sans-serif",
  },
} as const;

/** Base colors for DNA bases */
export const baseColors: Record<string, string> = {
  A: '#2dd4a8', // teal
  T: '#ef6b6b', // red
  G: '#f0b429', // amber
  C: '#5b9cf5', // blue
};

export type Tokens = typeof tokens;
