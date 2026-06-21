import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { Notice } from '../lib/types';
import { formatDateTime, timeAgo } from '../lib/utils';
import { RADIUS, FONT, SPACING } from '../lib/theme';

export default function NoticesScreen() {
  const { authState } = useAuth();
  const { theme, isDark } = useTheme();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const c = authState?.primaryColor || '#16a34a';
  const isAdmin = authState?.role === 'admin';

  const load = useCallback(async (refresh = false) => {
    if (!authState) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    const { data, error } = await supabase
      .from('notices')
      .select('id,organisation_id,title,body,created_by,pinned,created_at')
      .eq('organisation_id', authState.orgId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error) setNotices(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [authState?.orgId]);

  useEffect(() => { load(); }, [load]);

  async function handlePost() {
    if (!title.trim() || !body.trim() || !authState) return;
    setPosting(true);
    const { error } = await supabase.from('notices').insert({
      organisation_id: authState.orgId,
      title: title.trim(),
      body: body.trim(),
      created_by: authState.userId,
      pinned: false,
    });
    setPosting(false);
    if (!error) {
      setTitle('');
      setBody('');
      setComposerOpen(false);
      load(true);
    } else {
      Alert.alert('Could not post notice', error.message);
    }
  }

  async function togglePin(notice: Notice) {
    await supabase.from('notices').update({ pinned: !notice.pinned }).eq('id', notice.id);
    setNotices(prev =>
      prev
        .map(n => (n.id === notice.id ? { ...n, pinned: !n.pinned } : n))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.created_at > a.created_at ? 1 : -1))
    );
  }

  function confirmDelete(notice: Notice) {
    Alert.alert('Delete Notice?', `"${notice.title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(notice.id);
          await supabase.from('notices').delete().eq('id', notice.id);
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
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
            {item.pinned && (
              <View style={[styles.pinBadge, { backgroundColor: theme.warnBg }]}>
                <Ionicons name="pin" size={11} color={theme.warn} />
                <Text style={[styles.pinBadgeText, { color: theme.warn }]}>Pinned</Text>
              </View>
            )}
            <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.body, { color: theme.textSub }]}>{item.body}</Text>
            <View style={styles.footerRow}>
              <Text style={[styles.time, { color: theme.textMuted }]}>{timeAgo(item.created_at)}</Text>
              {isAdmin && (
                <View style={styles.adminActions}>
                  <TouchableOpacity onPress={() => togglePin(item)} style={styles.iconBtn}>
                    <Ionicons
                      name={item.pinned ? 'pin' : 'pin-outline'}
                      size={16}
                      color={item.pinned ? theme.warn : theme.textMuted}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.iconBtn} disabled={deletingId === item.id}>
                    {deletingId === item.id
                      ? <ActivityIndicator size={14} color={theme.danger} />
                      : <Ionicons name="trash-outline" size={16} color={theme.danger} />}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
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
  pinBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  pinBadgeText: { fontSize: FONT.xs, fontWeight: '700' },
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
  postBtn: { height: 52, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xl },
  postBtnText: { color: 'white', fontWeight: '700', fontSize: FONT.md },
});
