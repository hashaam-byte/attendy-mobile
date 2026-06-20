// src/lib/theme.ts — Attendy Mobile Design System

export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const RADIUS = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 999,
};

export const FONT = {
  xs: 10, sm: 12, base: 14, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 30,
};

// Semantic accent — pulled from org primaryColor at runtime
export const ACCENT = '#16a34a';

// ─── Light theme ────────────────────────────────────────────
export const LIGHT = {
  bg:           '#F5F7F5',      // warm off-white with hint of green
  bgCard:       '#FFFFFF',
  bgCardAlt:    '#EEF5EE',      // very subtle green tint for alt cards
  bgInput:      '#F0F4F0',
  bgTabBar:     '#FFFFFF',
  bgHeader:     '#FFFFFF',

  border:       '#D6E8D6',
  borderStrong: '#B0D4B0',

  text:         '#0F1A0F',      // near-black with green tint
  textSub:      '#4A6A4A',      // muted green-grey
  textMuted:    '#7A9A7A',      // lighter muted
  textOnAccent: '#FFFFFF',

  shadow: 'rgba(22,163,74,0.10)',

  // Status
  success:      '#16a34a',
  successBg:    '#DCFCE7',
  successText:  '#166534',
  warn:         '#d97706',
  warnBg:       '#FEF3C7',
  warnText:     '#92400E',
  danger:       '#dc2626',
  dangerBg:     '#FEE2E2',
  dangerText:   '#991B1B',
  info:         '#2563eb',
  infoBg:       '#DBEAFE',
  infoText:     '#1E40AF',
  purple:       '#7c3aed',
  purpleBg:     '#EDE9FE',
  purpleText:   '#5B21B6',
};

// ─── Dark theme ──────────────────────────────────────────────
export const DARK = {
  bg:           '#070F08',      // deep forest black
  bgCard:       '#0D1F0E',      // dark card
  bgCardAlt:    '#112614',      // slightly lighter card
  bgInput:      '#0A1A0B',
  bgTabBar:     '#0A1A0B',
  bgHeader:     '#080F09',

  border:       'rgba(34,197,94,0.12)',
  borderStrong: 'rgba(34,197,94,0.22)',

  text:         '#E8F5E8',      // warm white with green cast
  textSub:      '#7ABF7A',      // muted green
  textMuted:    '#4A7A4A',      // dim green
  textOnAccent: '#FFFFFF',

  shadow: 'rgba(0,0,0,0.4)',

  // Status
  success:      '#22c55e',
  successBg:    'rgba(34,197,94,0.12)',
  successText:  '#4ade80',
  warn:         '#f59e0b',
  warnBg:       'rgba(245,158,11,0.12)',
  warnText:     '#fbbf24',
  danger:       '#ef4444',
  dangerBg:     'rgba(239,68,68,0.12)',
  dangerText:   '#f87171',
  info:         '#3b82f6',
  infoBg:       'rgba(59,130,246,0.12)',
  infoText:     '#60a5fa',
  purple:       '#a855f7',
  purpleBg:     'rgba(168,85,247,0.12)',
  purpleText:   '#c084fc',
};

export type Theme = typeof LIGHT;
export type ThemeMode = 'light' | 'dark' | 'system';
