// src/lib/webApi.ts — ATTENDY-MOBILE
// Talks to the attendy (Next.js) web app's API routes — used wherever
// the mobile app previously queried Supabase tables directly with the
// anon key for data that RLS was never actually meant to expose to an
// unauthenticated client (org lookup by slug, parent portal data).

export const WEB_APP_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '') || 'https://attendy-edu.vercel.app';

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export interface OrgLookupResult {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  suspended: boolean;
  expired: boolean;
}

export async function lookupOrgBySlug(slug: string): Promise<{ ok: true; org: OrgLookupResult } | { ok: false; error: string }> {
  try {
    // NOTE: this is the same endpoint the web app's landing page, portal,
    // and staff login screen already use — /api/check-org. There is no
    // separate /api/org/lookup route; an earlier version of this file
    // called that non-existent path, which is why school lookup was
    // failing with "School not found" on mobile even though the web app
    // (correctly calling /api/check-org) worked fine.
    const res = await fetch(`${WEB_APP_URL}/api/check-org?slug=${encodeURIComponent(slug)}`);
    const data = await parseJson(res);
    if (!res.ok || !data?.exists) {
      return { ok: false, error: 'School not found. Check your school ID.' };
    }
    return {
      ok: true,
      org: {
        name: data.name,
        logoUrl: data.logoUrl ?? null,
        primaryColor: data.primaryColor || '#16a34a',
        suspended: !!data.suspended,
        expired: !!data.expired,
      },
    };
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' };
  }
}

export interface ParentStudent {
  id: string;
  full_name: string;
  class_name: string | null;
  organisation_id: string;
  parent_phone: string | null;
}

export async function verifyParentLogin(
  phone: string,
  childName: string
): Promise<{ ok: true; token: string; students: ParentStudent[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${WEB_APP_URL}/api/portal/verify-parent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, childName }),
    });
    const data = await parseJson(res);
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error ?? 'Something went wrong. Please try again.' };
    return { ok: true, token: data.token, students: data.students };
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' };
  }
}

export async function fetchParentAttendance(
  token: string,
  studentId: string
): Promise<{ ok: true; logs: any[]; org: any } | { ok: false; error: string; expired?: boolean }> {
  try {
    const res = await fetch(`${WEB_APP_URL}/api/portal/attendance?studentId=${encodeURIComponent(studentId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseJson(res);
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error ?? 'Failed to load attendance.', expired: res.status === 401 };
    }
    return { ok: true, logs: data.logs ?? [], org: data.org ?? null };
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' };
  }
}

export async function submitParentExcuse(
  token: string,
  args: { studentId: string; startDate: string; endDate: string; reason: string }
): Promise<{ ok: true } | { ok: false; error: string; expired?: boolean }> {
  try {
    const res = await fetch(`${WEB_APP_URL}/api/portal/excuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(args),
    });
    const data = await parseJson(res);
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error ?? 'Failed to submit. Please try again.', expired: res.status === 401 };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' };
  }
}