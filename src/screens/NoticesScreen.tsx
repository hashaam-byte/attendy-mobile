import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { Notice, NoticePriority } from '../lib/types';
import { formatDateTime, timeAgo } from '../lib/utils';
import { RADIUS, FONT, SPACING,  } from '../lib/theme';

const PRIORITY_CONFIG: Record<NoticePriority, { label: string; color: string }> = {
  low:    { label: 'Low',    color: '#94A3B8' },
  normal: { label: 'Normal', color: '#3B82F6' },
  high:   { label: 'High',   color: '#F59E0B' },
  urgent: { label: 'Urgent', color: '#EF4444' },
};

export default function NoticesScreen() {
  const { authState } = useAuth();
  const { theme, isDark } = useTheme();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<NoticePriority>('normal');
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const c = authState?.primaryColor || '#16a34a';
  const isAdmin = authState?.role === 'admin';

  const load = useCallback(async (refresh = false) => {
    if (!authState) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    // Mirrors the web query exactly: same columns, same "not expired" filter,
    // same ordering (newest first — the web app has no pin/priority sort).
    const { data, error } = await supabase
      .from('school_notices')
      .select('id,organisation_id,title,body,priority,target_classes,expires_at,created_by,created_at')
      .eq('organisation_id', authState.orgId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });
    if (!error) setNotices(data ?? []);
    else console.warn('[Notices] load failed:', error.message);
    setLoading(false);
    setRefreshing(false);
  }, [authState?.orgId]);

  useEffect(() => { load(); }, [load]);

  async function handlePost() {
    if (!title.trim() || !body.trim() || !authState) return;
    setPosting(true);
    const { error } = await supabase.from('school_notices').insert({
      organisation_id: authState.orgId,
      title: title.trim(),
      body: body.trim(),
      priority,
      created_by: authState.userId,
    });
    setPosting(false);
    if (!error) {
      setTitle('');
      setBody('');
      setPriority('normal');
      setComposerOpen(false);
      load(true);
    } else {
      Alert.alert('Could not post notice', error.message);
    }
  }

  function confirmDelete(notice: Notice) {
    Alert.alert('Delete Notice?', `"${notice.title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(notice.id);
          await supabase.from('school_notices').delete().eq('id', notice.id);
          setNotices(prev => prev.filter(n => n.id !== notice.id));
          setDeletingId(null);
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={notices}
        keyExtractor={i => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c} />}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 96, gap: SPACING.md }}
        renderItem={({ item }) => {
          const cfg = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.normal;
          const isUrgent = item.priority === 'urgent';
          return (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.bgCard, borderColor: isUrgent ? theme.danger : theme.border },
              ]}
            >
              <View style={styles.badgeRow}>
                <View style={[styles.priorityBadge, { backgroundColor: cfg.color + '22' }]}>
                  <Text style={[styles.priorityBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                {item.target_classes && item.target_classes.length > 0 && (
                  <View style={styles.classRow}>
                    <Ionicons name="people-outline" size={11} color={theme.textMuted} />
                    <Text style={[styles.classText, { color: theme.textMuted }]}>
                      {item.target_classes.join(', ')}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.body, { color: theme.textSub }]}>{item.body}</Text>
              <View style={styles.footerRow}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={[styles.time, { color: theme.textMuted }]}>{timeAgo(item.created_at)}</Text>
                  {item.expires_at && (
                    <Text style={[styles.time, { color: theme.textMuted }]}>
                      Expires {formatDateTime(item.expires_at)}
                    </Text>
                  )}
                </View>
                {isAdmin && (
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.iconBtn} disabled={deletingId === item.id}>
                    {deletingId === item.id
                      ? <ActivityIndicator size={14} color={theme.danger} />
                      : <Ionicons name="trash-outline" size={16} color={theme.danger} />}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 56, gap: 12 }}>
            <Ionicons name="megaphone-outline" size={40} color={theme.textMuted} />
            <Text style={[{ fontSize: FONT.lg, fontWeight: '700', color: theme.text }]}>No notices yet</Text>
            <Text style={[{ fontSize: FONT.sm, color: theme.textMuted, textAlign: 'center' }]}>
              {isAdmin ? 'Post an announcement for your school using the button below.' : 'Check back later for school announcements.'}
            </Text>
          </View>
        }
      />

      {isAdmin && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: c }]}
          onPress={() => setComposerOpen(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color="white" />
        </TouchableOpacity>
      )}

      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalWrap}
        >
          <View style={[styles.modalCard, { backgroundColor: theme.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>New Notice</Text>
              <TouchableOpacity onPress={() => setComposerOpen(false)}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.textMuted }]}>TITLE</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bgInput, borderColor: theme.border, color: theme.text }]}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Mid-term break schedule"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.textMuted }]}>MESSAGE</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.bgInput, borderColor: theme.border, color: theme.text }]}
              value={body}
              onChangeText={setBody}
              placeholder="Write the announcement…"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <Text style={[styles.label, { color: theme.textMuted }]}>PRIORITY</Text>
            <View style={styles.priorityRow}>
              {(Object.keys(PRIORITY_CONFIG) as NoticePriority[]).map((p) => {
                const active = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[
                      styles.priorityOption,
                      {
                        backgroundColor: active ? PRIORITY_CONFIG[p].color : 'transparent',
                        borderColor: active ? PRIORITY_CONFIG[p].color : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : theme.textMuted, fontSize: FONT.xs, fontWeight: '600' }}>
                      {PRIORITY_CONFIG[p].label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.postBtn, { backgroundColor: !title.trim() || !body.trim() || posting ? (isDark ? 'rgba(255,255,255,0.06)' : '#E5E7E5') : c }]}
              onPress={handlePost}
              disabled={!title.trim() || !body.trim() || posting}
              activeOpacity={0.8}
            >
              {posting
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.postBtnText}>Post Notice</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  priorityBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  priorityBadgeText: { fontSize: FONT.xs, fontWeight: '700' },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  classText: { fontSize: FONT.xs },
  title: { fontSize: FONT.lg, fontWeight: '700' },
  body: { fontSize: FONT.base, lineHeight: 20 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  time: { fontSize: FONT.xs },
  adminActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 6 },
  fab: {
    position: 'absolute', right: SPACING.lg, bottom: SPACING.xl,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, padding: SPACING.xl, gap: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONT.xl, fontWeight: '800' },
  label: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8, marginTop: SPACING.md },
  input: { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: 14, height: 48, fontSize: FONT.base },
  textArea: { height: 120, paddingTop: 12 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityOption: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, paddingVertical: 8, alignItems: 'center' },
  postBtn: { height: 52, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xl },
  postBtnText: { color: 'white', fontWeight: '700', fontSize: FONT.md },
});