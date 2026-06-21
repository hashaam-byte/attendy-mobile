export type MemberRole = 'admin' | 'teacher' | 'gateman' | 'scanner' | 'hr' | 'receptionist' | 'steward' | 'viewer';
export type MemberType = 'student' | 'staff' | 'employee' | 'contractor' | 'guest' | 'visitor';
export type AttendanceStatus = 'present' | 'late' | 'early_exit' | 'excused';
export type PlanType = 'trial' | 'basic' | 'standard' | 'premium' | 'enterprise';
export type Industry = 'education' | 'banking' | 'office' | 'business' | 'events';

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
  max_members: number;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface OrgUser {
  id: string;
  user_id: string;
  organisation_id: string;
  role: MemberRole;
  is_active: boolean;
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
  class_name: string | null;
  parent_phone: string | null;
  is_active: boolean;
  photo_url: string | null;
  notes: string | null;
}

export interface AttendanceLog {
  id: string;
  organisation_id: string;
  member_id: string;
  scan_type: 'entry' | 'exit' | 'class' | 'zone';
  status: AttendanceStatus;
  late_reason: string | null;
  scanned_at: string;
  members?: {
    full_name: string;
    class_name: string | null;
    employee_id: string | null;
  };
}

export interface NotificationLog {
  id: string;
  organisation_id: string;
  member_id: string | null;
  channel: 'sms' | 'whatsapp' | 'email';
  recipient: string;
  message: string;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
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
  settings: Record<string, unknown>;
  maxMembers: number;
}
