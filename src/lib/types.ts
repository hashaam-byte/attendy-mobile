// src/lib/types.ts — Attendy Mobile
// Kept in sync with the web repo's src/lib/types.ts.

export type MemberRole =
  | 'admin'
  | 'teacher'
  | 'gateman'
  | 'scanner'
  | 'hr'
  | 'receptionist'
  | 'steward'
  | 'viewer';

export type MemberType =
  | 'student'
  | 'staff'
  | 'employee'
  | 'contractor'
  | 'guest'
  | 'visitor';

export type AttendanceStatus = 'present' | 'late' | 'early_exit' | 'excused';
export type PlanType = 'trial' | 'basic' | 'standard' | 'premium' | 'enterprise';
export type Industry = 'education' | 'banking' | 'office' | 'business' | 'events';
export type NotificationStatus = 'sent' | 'delivered' | 'failed' | 'pending';

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  industry: Industry;
  plan: PlanType;
  is_active: boolean;
  plan_expires_at: string | null;
  logo_url: string | null;
  primary_color: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  max_members: number;
  sms_sender_id: string | null;
  whatsapp_enabled: boolean;
  timezone: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgUser {
  id: string;
  user_id: string;
  organisation_id: string;
  role: MemberRole;
  is_active: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  organisation_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: MemberRole;
  member_type: MemberType;
  qr_code: string;
  employee_id: string | null;
  department: string | null;
  class_name: string | null;
  parent_phone: string | null;
  is_active: boolean;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceLog {
  id: string;
  organisation_id: string;
  member_id: string;
  scanned_by: string | null;
  scan_type: 'entry' | 'exit' | 'class' | 'zone';
  status: AttendanceStatus;
  late_reason: string | null;
  device_id: string | null;
  scanned_at: string;
  members?: {
    id?: string;
    full_name: string;
    class_name: string | null;
    employee_id?: string | null;
    parent_phone?: string | null;
    photo_url?: string | null;
  };
}

export interface NotificationLog {
  id: string;
  organisation_id: string;
  member_id: string | null;
  channel: 'sms' | 'whatsapp' | 'email';
  recipient: string;
  message: string;
  status: NotificationStatus;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string;
  members?: { full_name: string } | null;
}

export interface Notice {
  id: string;
  organisation_id: string;
  title: string;
  body: string;
  created_by: string | null;
  pinned: boolean;
  created_at: string;
}

// ── School settings ───────────────────────────────────────────────────────────
// The key `grace_period_minutes` (not `grace_period`) matches the actual DB
// column name used by the web dashboard and the Supabase functions.
export interface SchoolSettings {
  start_time: string;            // e.g. "07:30"
  grace_period_minutes: number;  // minutes after start_time before a scan is "late"
  school_days: number[];         // [1,2,3,4,5] — 0=Sun … 6=Sat
  sms_on_arrival: boolean;
  sms_on_absence: boolean;
  absence_alert_time: string;    // e.g. "09:00"
  welfare_alert_days: number;
  whatsapp_notifications: boolean;
}

export const DEFAULT_SETTINGS: SchoolSettings = {
  start_time: '07:30',
  grace_period_minutes: 15,
  school_days: [1, 2, 3, 4, 5],
  sms_on_arrival: true,
  sms_on_absence: true,
  absence_alert_time: '09:00',
  welfare_alert_days: 3,
  whatsapp_notifications: false,
};

// ── Plan limits ───────────────────────────────────────────────────────────────
export const PLAN_LIMITS: Record<PlanType, { members: number; sms: number }> = {
  trial:      { members: 30,    sms: 100    },
  basic:      { members: 100,   sms: 500    },
  standard:   { members: 300,   sms: 2000   },
  premium:    { members: 1000,  sms: 10000  },
  enterprise: { members: 99999, sms: 999999 },
};

// ── Auth state passed through AuthContext ─────────────────────────────────────
export interface AuthState {
  slug: string;
  orgId: string;
  orgName: string;
  primaryColor: string;
  logoUrl: string | null;
  plan: PlanType;
  industry: Industry;
  role: MemberRole;
  userId: string;
  email: string;
  settings: Partial<SchoolSettings>;
  maxMembers: number;
}