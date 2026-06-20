import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/utils';
import { RADIUS, FONT, SPACING } from '../lib/theme';

type NotifLog = { id:string; sent_at:string; recipient:string; message:string; status:string; channel:string; members:{full_name:string}|null };

export default function NotificationsScreen() {
  const { authState } = useAuth();
  const { theme } = useTheme();
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const c = authState?.primaryColor || '#16a34a';
  const todayStart = new Date().toISOString().split('T')[0];

  const load = useCallback(async (refresh=false) => {
    if (!authState) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    const [{data},{count:tc},{count:fc}] = await Promise.all([
      supabase.from('notifications_log').select('id,sent_at,recipient,message,status,channel,members(full_name)').eq('organisation_id',authState.orgId).order('sent_at',{ascending:false}).limit(80),
      supabase.from('notifications_log').select('*',{count:'exact',head:true}).eq('organisation_id',authState.orgId).gte('sent_at',`${todayStart}T00:00:00`),
      supabase.from('notifications_log').select('*',{count:'exact',head:true}).eq('organisation_id',authState.orgId).eq('status','failed').gte('sent_at',new Date(Date.now()-86400000).toISOString()),
    ]);
    setLogs((data??[]).map((l:any)=>({...l,members:Array.isArray(l.members)?l.members[0]??null:l.members})));
    setTodayCount(tc??0); setFailedCount(fc??0); setLoading(false); setRefreshing(false);
  }, [authState?.orgId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={{flex:1,backgroundColor:theme.bg,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={c} size="large"/></View>;

  return (
    <View style={{flex:1,backgroundColor:theme.bg}}>
      <View style={[styles.statsRow,{backgroundColor:theme.bgCard,borderBottomColor:theme.border}]}>
        <View style={[styles.statCard,{backgroundColor:theme.bg,borderColor:theme.border}]}>
          <Ionicons name="notifications-outline" size={18} color={c}/>
          <Text style={[styles.statVal,{color:c}]}>{todayCount}</Text>
          <Text style={[styles.statLbl,{color:theme.textMuted}]}>Sent Today</Text>
        </View>
        <View style={[styles.statCard,{backgroundColor:theme.bg,borderColor:theme.border}]}>
          <Ionicons name="close-circle-outline" size={18} color={failedCount>0?theme.danger:theme.textMuted}/>
          <Text style={[styles.statVal,{color:failedCount>0?theme.danger:theme.textSub}]}>{failedCount}</Text>
          <Text style={[styles.statLbl,{color:theme.textMuted}]}>Failed (24h)</Text>
        </View>
        <View style={[styles.statCard,{backgroundColor:theme.bg,borderColor:theme.border}]}>
          <Ionicons name="list-outline" size={18} color={theme.textSub}/>
          <Text style={[styles.statVal,{color:theme.text}]}>{logs.length}</Text>
          <Text style={[styles.statLbl,{color:theme.textMuted}]}>Total Logged</Text>
        </View>
      </View>
      {failedCount>0&&(
        <View style={[styles.alertBar,{backgroundColor:theme.dangerBg,borderBottomColor:`${theme.danger}30`}]}>
          <Ionicons name="warning-outline" size={14} color={theme.danger}/>
          <Text style={[styles.alertText,{color:theme.dangerText}]}>{failedCount} SMS failed in the last 24 hours.</Text>
        </View>
      )}
      <FlatList data={logs} keyExtractor={i=>i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} tintColor={c}/>}
        contentContainerStyle={{paddingBottom:32}}
        ItemSeparatorComponent={()=><View style={{height:1,backgroundColor:theme.border,marginLeft:64}}/>}
        renderItem={({item}) => {
          const ok = item.status==='sent'||item.status==='delivered';
          const sc = ok?theme.success:item.status==='failed'?theme.danger:theme.textMuted;
          return (
            <View style={[styles.row,{backgroundColor:theme.bgCard}]}>
              <View style={[styles.icon,{backgroundColor:`${sc}15`}]}>
                <Ionicons name={item.channel==='whatsapp'?'logo-whatsapp':'chatbubble-outline'} size={16} color={sc}/>
              </View>
              <View style={{flex:1}}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name,{color:theme.text}]}>{item.members?.full_name??'—'}</Text>
                  <View style={[styles.statusBadge,{backgroundColor:`${sc}15`}]}><Text style={[styles.statusText,{color:sc}]}>{item.status}</Text></View>
                </View>
                <Text style={[styles.recipient,{color:theme.textMuted}]} numberOfLines={1}>{item.recipient}</Text>
                <Text style={[styles.message,{color:theme.textSub}]} numberOfLines={2}>{item.message}</Text>
                <Text style={[styles.time,{color:theme.textMuted}]}>{formatDateTime(item.sent_at)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{alignItems:'center',padding:56,gap:12}}>
            <Ionicons name="chatbubble-outline" size={40} color={theme.textMuted}/>
            <Text style={[{fontSize:FONT.lg,fontWeight:'700',color:theme.text}]}>No SMS sent yet</Text>
            <Text style={[{fontSize:FONT.sm,color:theme.textMuted,textAlign:'center'}]}>Notifications fire automatically when students scan in.</Text>
          </View>
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  statsRow:{flexDirection:'row',gap:8,padding:SPACING.lg,borderBottomWidth:1},
  statCard:{flex:1,borderWidth:1,borderRadius:RADIUS.lg,padding:10,alignItems:'center',gap:4},
  statVal:{fontSize:20,fontWeight:'800'},
  statLbl:{fontSize:FONT.xs},
  alertBar:{flexDirection:'row',alignItems:'flex-start',gap:8,paddingHorizontal:SPACING.lg,paddingVertical:10,borderBottomWidth:1},
  alertText:{flex:1,fontSize:FONT.sm,lineHeight:18},
  row:{flexDirection:'row',gap:12,padding:SPACING.md,paddingHorizontal:SPACING.lg},
  icon:{width:36,height:36,borderRadius:RADIUS.md,alignItems:'center',justifyContent:'center',flexShrink:0},
  rowTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:3},
  name:{fontSize:FONT.sm,fontWeight:'600'},
  statusBadge:{paddingHorizontal:7,paddingVertical:2,borderRadius:RADIUS.sm},
  statusText:{fontSize:FONT.xs,fontWeight:'700'},
  recipient:{fontSize:FONT.xs,fontFamily:Platform.OS==='ios'?'Menlo':'monospace',marginBottom:3},
  message:{fontSize:FONT.sm,lineHeight:17,marginBottom:4},
  time:{fontSize:FONT.xs},
});
