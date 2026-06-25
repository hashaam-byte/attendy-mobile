// src/lib/utils.ts — Attendy Mobile
// Kept in sync with the web repo's src/lib/utils.ts.

import { format, formatDistanceToNow } from 'date-fns';
import type { SchoolSettings } from './types';

// ── Date / time ───────────────────────────────────────────────────────────────

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return format(new Date(date), 'dd MMM yyyy');
}

export function formatDateTime(date: string | null): string {
  if (!date) return '—';
  return format(new Date(date), 'dd MMM yyyy, HH:mm');
}

export function formatTime(date: string | null): string {
  if (!date) return '—';
  return format(new Date(date), 'hh:mm a');
}

export function timeAgo(date: string | null): string {
  if (!date) return 'Never';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

// ── Number formatting ─────────────────────────────────────────────────────────

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-NG').format(n);
}

// ── Text helpers ──────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

// ── Phone ─────────────────────────────────────────────────────────────────────

export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1);
  return digits;
}

// ── Attendance helpers ────────────────────────────────────────────────────────

/**
 * Returns true if `scannedAt` is after the late cutoff derived from
 * `startTime` + `gracePeriodMinutes`.
 *
 * Mirrors the web's isLate() in src/lib/utils.ts and isLateScan() in
 * src/context/org-context.tsx so that the mobile app and web dashboard
 * always agree on what counts as "late".
 */
export function isLate(
  scannedAt: string,
  startTime: string,
  gracePeriodMinutes: number,
): boolean {
  const scanned = new Date(scannedAt);
  const [hours, minutes] = startTime.split(':').map(Number);
  const cutoff = new Date(scanned);
  cutoff.setHours(hours, minutes + gracePeriodMinutes, 0, 0);
  return scanned > cutoff;
}

export function getAttendancePct(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
}

// ── Settings display helpers ──────────────────────────────────────────────────

/**
 * Returns the human-readable late cutoff time, e.g. "7:45 AM".
 *
 * Accepts the raw settings object stored in AuthState so callers don't
 * need to pull individual keys.
 */
export function getCutoffDisplay(settings: Partial<SchoolSettings>): string {
  const startTime = settings.start_time ?? '07:30';
  const grace = settings.grace_period_minutes ?? 15;
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = h * 60 + m + grace;
  const ch = Math.floor(totalMins / 60);
  const cm = totalMins % 60;
  const period = ch >= 12 ? 'PM' : 'AM';
  const displayH = ch > 12 ? ch - 12 : ch;
  return `${displayH}:${String(cm).padStart(2, '0')} ${period}`;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

export function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}