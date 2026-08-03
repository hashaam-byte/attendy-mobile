// src/lib/notifications.ts — ATTENDY-EDU
// Handles Expo push token registration, permission requests,
// and local notification display for the mobile app.
// SERVER-SIDE sending is done via the Supabase edge function / API route.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { registerParentPushTokenWithServer } from './webApi';

// ── Configure how notifications appear when app is foregrounded ──
// SDK 53+: use shouldShowBanner + shouldShowList instead of the
// deprecated shouldShowAlert (which was split in iOS 14).
// shouldShowBanner = top-of-screen banner
// shouldShowList   = Notification Center / lock screen entry
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner:  true,
    shouldShowList:    true,
    shouldPlaySound:   true,
    shouldSetBadge:    true,
  }),
});

// ── Register for push notifications ──────────────────────────────
// Call this once after the user logs in.
// Saves the Expo push token to Supabase so the server can send pushes.
export async function registerForPushNotifications(
  userId:  string,
  orgId:   string,
  role:    string,
): Promise<string | null> {
  // Push only works on physical devices
  if (!Device.isDevice) {
    console.log('[PUSH] Skipping — not a physical device');
    return null;
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[PUSH] Permission denied');
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('attendy-default', {
      name:               'Attendy Alerts',
      importance:         Notifications.AndroidImportance.HIGH,
      vibrationPattern:   [0, 250, 250, 250],
      lightColor:         '#16a34a',
      sound:              'default',
      enableVibrate:      true,
      showBadge:          true,
    });
    await Notifications.setNotificationChannelAsync('attendy-attendance', {
      name:               'Attendance Alerts',
      importance:         Notifications.AndroidImportance.HIGH,
      vibrationPattern:   [0, 250, 250, 250],
      lightColor:         '#16a34a',
      sound:              'default',
      showBadge:          true,
    });
    await Notifications.setNotificationChannelAsync('attendy-excuse', {
      name:               'Excuse Requests',
      importance:         Notifications.AndroidImportance.DEFAULT,
      lightColor:         '#f59e0b',
      showBadge:          true,
    });
  }

  // Get the Expo push token
  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: '29fe69a3-75df-407a-a4d7-b548cf35b573', // from app.json extra.eas.projectId
    });
    token = result.data;
  } catch (err) {
    console.error('[PUSH] Failed to get token:', err);
    return null;
  }

  console.log('[PUSH] Token:', token);

  // Save to org_users table (for teachers/admins)
  const { error } = await supabase
    .from('org_users')
    .update({
      expo_push_token: token,
      push_enabled:    true,
      last_seen_at:    new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('organisation_id', orgId);

  if (error) {
    console.error('[PUSH] Failed to save token to org_users:', error.message);
  }

  return token;
}

// ── Register parent push token ────────────────────────────────────
// Called from the parent portal mobile view after they log in with
// phone + child's name. Requires the signed parentSessionToken from
// that login (verifyParentLogin's response) — the server only accepts
// a memberId that was actually part of that verified session, so a
// device can't be registered to receive notifications about a student
// it has no relationship to.
export async function registerParentPushToken(
  memberId:          string,
  parentSessionToken: string,
): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('attendy-attendance', {
      name:      'Attendance Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound:     'default',
      showBadge: true,
    });
  }

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: '29fe69a3-75df-407a-a4d7-b548cf35b573',
    });
    token = result.data;
  } catch (err) {
    console.error('[PUSH] Parent token failed:', err);
    return null;
  }

  const result = await registerParentPushTokenWithServer(parentSessionToken, memberId, token);
  if (!result.ok) {
    console.warn('[PUSH] Parent token registration failed:', result.error);
    return null;
  }

  return token;
}

// ── Unregister (on logout) ────────────────────────────────────────
export async function unregisterPushToken(
  userId: string,
  orgId:  string,
): Promise<void> {
  await supabase
    .from('org_users')
    .update({ expo_push_token: null, push_enabled: false })
    .eq('user_id', userId)
    .eq('organisation_id', orgId);
}

// ── Schedule a local notification (used for reminders) ───────────

export async function scheduleLocalNotification(opts: {
  title:    string;
  body:     string;
  data?:    Record<string, unknown>;
  seconds?: number;  // delay in seconds, default 1
  channel?: string;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title:   opts.title,
      body:    opts.body,
      data:    opts.data ?? {},
      sound:   'default',
      ...(Platform.OS === 'android' ? { channelId: opts.channel ?? 'attendy-default' } : {}),
    },
    trigger: opts.seconds
      ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: opts.seconds, repeats: false }
      : null,
  });
}

// ── Parse notification and return navigation target ──────────────
// Called from the notification tap handler in AppNavigator.
export function getNavigationFromNotification(
  data: Record<string, unknown>
): { screen: string; params?: Record<string, unknown> } | null {
  const type = data?.type as string | undefined;
  switch (type) {
    case 'excuse_request':
      return { screen: 'Notices' };
    case 'attendance':
      return { screen: 'Dashboard' };
    case 'notice':
      return { screen: 'Notices' };
    case 'absent':
      return { screen: 'Absent' };
    default:
      return null;
  }
}