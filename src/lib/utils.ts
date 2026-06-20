import { format, formatDistanceToNow } from 'date-fns';

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

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1);
  return digits;
}

export function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getCutoffDisplay(settings: Record<string, unknown>): string {
  const startTime = (settings.start_time as string) || '07:30';
  const grace = (settings.grace_period_minutes as number) ?? 15;
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = h * 60 + m + grace;
  const ch = Math.floor(totalMins / 60);
  const cm = totalMins % 60;
  const period = ch >= 12 ? 'PM' : 'AM';
  const displayH = ch > 12 ? ch - 12 : ch;
  return `${displayH}:${String(cm).padStart(2, '0')} ${period}`;
}
