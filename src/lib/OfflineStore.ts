// src/lib/OfflineStore.ts — ATTENDY-EDU MOBILE
// Encrypted local database for offline scanning.
// Safe for Expo Go + bare workflow + EAS builds.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────
export type CachedMember = {
  id:           string;
  qr_code:      string;
  full_name:    string;
  class_name:   string | null;
  parent_phone: string | null;
  is_active:    boolean;
};

export type QueuedScan = {
  id:              string;
  organisation_id: string;
  member_id:       string;
  scan_type:       'entry' | 'exit';
  status:          'present' | 'late' | 'early_exit';
  late_reason:     string | null;
  scanned_at:      string;
  queued_at:       string;
};

export type ScanLedgerEntry = {
  scanned_at: string;
  status:     string;
  mode:       string;
};

// ── Key derivation (no external crypto needed) ─────────────────
// Derives a repeatable key from orgId using djb2 hash.
// No expo-crypto dependency — works in Expo Go and bare workflow.
function deriveKey(orgId: string): string {
  let h = 5381;
  for (let i = 0; i < orgId.length; i++) {
    h = ((h << 5) + h) ^ orgId.charCodeAt(i);
    h = h & 0xffffffff; // keep 32-bit
  }
  const hash = Math.abs(h).toString(16).padStart(8, '0');
  return `attendy:${hash}:${orgId.slice(-6)}:v2`;
}

// ── Pure JS base64 (no Buffer polyfill needed) ────────────────
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function toBase64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i+1] ?? 0, c = bytes[i+2] ?? 0;
    out += CHARS[a >> 2];
    out += CHARS[((a & 3) << 4) | (b >> 4)];
    out += i+1 < bytes.length ? CHARS[((b & 15) << 2) | (c >> 6)] : '=';
    out += i+2 < bytes.length ? CHARS[c & 63] : '=';
  }
  return out;
}

function fromBase64(str: string): number[] {
  const bytes: number[] = [];
  str = str.replace(/[^A-Za-z0-9+/]/g, '');
  for (let i = 0; i < str.length; i += 4) {
    const a = CHARS.indexOf(str[i]);
    const b = CHARS.indexOf(str[i+1]);
    const c = CHARS.indexOf(str[i+2]);
    const d = CHARS.indexOf(str[i+3]);
    bytes.push((a << 2) | (b >> 4));
    if (c !== 64) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d !== 64) bytes.push(((c & 3) << 6) | d);
  }
  return bytes;
}

// ── XOR cipher ────────────────────────────────────────────────
function encrypt(data: string, key: string): string {
  const k: number[] = [];
  for (let i = 0; i < key.length; i++) k.push(key.charCodeAt(i));
  const out: number[] = [];
  for (let i = 0; i < data.length; i++) {
    out.push(data.charCodeAt(i) ^ k[i % k.length]);
  }
  return toBase64(out);
}

function decrypt(enc: string, key: string): string {
  try {
    const k: number[] = [];
    for (let i = 0; i < key.length; i++) k.push(key.charCodeAt(i));
    const bytes = fromBase64(enc);
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      out += String.fromCharCode(bytes[i] ^ k[i % k.length]);
    }
    return out;
  } catch { return '{}'; }
}

// ── Storage helpers ────────────────────────────────────────────
async function setEncrypted(storageKey: string, data: unknown, orgId: string): Promise<void> {
  try {
    const key       = deriveKey(orgId);
    const json      = JSON.stringify(data);
    const encrypted = encrypt(json, key);
    await AsyncStorage.setItem(storageKey, encrypted);
  } catch (e) {
    console.warn('[OfflineStore] setEncrypted failed:', e);
  }
}

async function getEncrypted<T>(storageKey: string, orgId: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const key       = deriveKey(orgId);
    const decrypted = decrypt(raw, key);
    return JSON.parse(decrypted) as T;
  } catch { return null; }
}

// ── Storage key builders ───────────────────────────────────────
const K = {
  members:  (orgId: string) => `@att:members:${orgId}`,
  scanned:  (orgId: string, date: string) => `@att:scanned:${orgId}:${date}`,
  queue:    (orgId: string) => `@att:queue:${orgId}`,
  syncedAt: (orgId: string) => `@att:synced:${orgId}`,
};

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

// ── Sync members from Supabase to local encrypted store ─────────
export async function syncMembersToLocal(orgId: string): Promise<{ memberCount: number; scannedCount: number }> {
  const [{ data: members }, { data: logs }] = await Promise.all([
    supabase
      .from('members')
      .select('id, qr_code, full_name, class_name, parent_phone, is_active')
      .eq('organisation_id', orgId)
      .eq('member_type', 'student'),
    supabase
      .from('attendance_logs')
      .select('member_id, scan_type, status, scanned_at')
      .eq('organisation_id', orgId)
      .gte('scanned_at', `${todayStr()}T00:00:00`),
  ]);

  if (members) {
    await setEncrypted(K.members(orgId), members, orgId);
  }

  const ledger: Record<string, ScanLedgerEntry> = {};
  for (const log of logs ?? []) {
    ledger[`${log.member_id}:${log.scan_type}`] = {
      scanned_at: log.scanned_at,
      status:     log.status,
      mode:       log.scan_type,
    };
  }
  await setEncrypted(K.scanned(orgId, todayStr()), ledger, orgId);
  await AsyncStorage.setItem(K.syncedAt(orgId), new Date().toISOString());

  return {
    memberCount:  members?.length ?? 0,
    scannedCount: Object.keys(ledger).length,
  };
}

// ── Find member by QR code ─────────────────────────────────────
export async function findMemberByQR(orgId: string, qrCode: string): Promise<CachedMember | null> {
  const members = await getEncrypted<CachedMember[]>(K.members(orgId), orgId);
  if (!members) return null;
  return members.find(m => m.qr_code === qrCode) ?? null;
}

// ── Check if member already scanned today ─────────────────────
export async function checkLocalLedger(
  orgId: string,
  memberId: string,
  scanType: 'entry' | 'exit'
): Promise<ScanLedgerEntry | null> {
  const ledger = await getEncrypted<Record<string, ScanLedgerEntry>>(
    K.scanned(orgId, todayStr()), orgId
  );
  return ledger?.[`${memberId}:${scanType}`] ?? null;
}

// ── Mark member as scanned in local ledger ─────────────────────
export async function markScannedLocally(
  orgId: string,
  memberId: string,
  scanType: 'entry' | 'exit',
  entry: ScanLedgerEntry
): Promise<void> {
  const storeKey = K.scanned(orgId, todayStr());
  const ledger   = (await getEncrypted<Record<string, ScanLedgerEntry>>(storeKey, orgId)) ?? {};
  ledger[`${memberId}:${scanType}`] = entry;
  await setEncrypted(storeKey, ledger, orgId);
}

// ── Add scan to offline queue ─────────────────────────────────
export async function queueScan(scan: QueuedScan): Promise<void> {
  const queue = (await getEncrypted<QueuedScan[]>(K.queue(scan.organisation_id), scan.organisation_id)) ?? [];
  if (!queue.find(q => q.id === scan.id)) {
    queue.push(scan);
    await setEncrypted(K.queue(scan.organisation_id), queue, scan.organisation_id);
  }
}

// ── Upload queued scans when back online ─────────────────────
export async function syncQueueToServer(orgId: string): Promise<{ uploaded: number; failed: number }> {
  const queue = (await getEncrypted<QueuedScan[]>(K.queue(orgId), orgId)) ?? [];
  if (queue.length === 0) return { uploaded: 0, failed: 0 };

  let uploaded  = 0;
  let failed    = 0;
  const remaining: QueuedScan[] = [];

  for (const scan of queue) {
    const { error } = await supabase.from('attendance_logs').insert({
      organisation_id: scan.organisation_id,
      member_id:       scan.member_id,
      scan_type:       scan.scan_type,
      status:          scan.status,
      late_reason:     scan.late_reason,
      device_id:       'mobile-offline',
      scanned_at:      scan.scanned_at,
    });

    if (!error || error.code === '23505') {
      uploaded++;
    } else {
      failed++;
      remaining.push(scan);
    }
  }

  await setEncrypted(K.queue(orgId), remaining, orgId);
  return { uploaded, failed };
}

// ── Queue count ───────────────────────────────────────────────
export async function getQueueCount(orgId: string): Promise<number> {
  const queue = (await getEncrypted<QueuedScan[]>(K.queue(orgId), orgId)) ?? [];
  return queue.length;
}

// ── Last sync timestamp ───────────────────────────────────────
export async function getLastSyncTime(orgId: string): Promise<string | null> {
  return AsyncStorage.getItem(K.syncedAt(orgId));
}

// ── Cached member count ───────────────────────────────────────
export async function getLocalMemberCount(orgId: string): Promise<number> {
  const members = await getEncrypted<CachedMember[]>(K.members(orgId), orgId);
  return members?.length ?? 0;
}

// ── Purge old day ledgers (call on app launch) ─────────────────
export async function purgeOldLedgers(orgId: string): Promise<void> {
  try {
    const allKeys  = await AsyncStorage.getAllKeys();
    const today    = todayStr();
    const toRemove = allKeys.filter(
      k => k.startsWith(`@att:scanned:${orgId}:`) && !k.endsWith(today)
    );
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  } catch {}
}

// ── Clear all local data for org (on logout) ──────────────────
export async function clearLocalStore(orgId: string): Promise<void> {
  try {
    const allKeys  = await AsyncStorage.getAllKeys();
    const toRemove = allKeys.filter(k => k.includes(orgId));
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  } catch {}
}