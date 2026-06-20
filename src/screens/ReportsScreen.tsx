import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Share, FlatList, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { formatTime, formatDate } from '../lib/utils';
import { RADIUS, FONT, SPACING } from '../lib/theme';
import { subDays, format } from 'date-fns';

type Log = { id:string; scanned_at:string; status:string; members:{full_name:string;class_name:string|null}|null };
type Day = { date:string; label:string; present:number; late:number };

export default function ReportsScreen() {
  const { authState } = useAuth();
  const { theme } = useTheme();
  const [tab, setTab] = useState<'daily'|'weekly'>('daily');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [chart, setChart] = useState<Day[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState('all');
  const c = authState?.primaryColor || '#16a34a';
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async (refresh = false) => {
    if (!authState) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    const ago = format(subDays(new Date(), 6), 'yyyy-MM-dd');
    const [{ data: todayData }, { data: weekData }, { data: memberData }] = await Promise.all([
      supabase.from('attendance_logs').select('id,scanned_at,status,members(full_name,class_name)').eq('organisation_id',authState.orgId).eq('scan_type','entry').gte('scanned_at',`${today}T00:00:00`).order('scanned_at',{ascending:false}),
      supabase.from('attendance_logs').select('scanned_at,status').eq('organisation_id',authState.orgId).eq('scan_type','entry').gte('scanned_at',`${ago}T00:00:00`),
      supabase.from('members').select('class_name').eq('organisation_id',authState.orgId).eq('member_type','student').eq('is_active',true),
    ]);
    const norm = (todayData??[]).map((l:any)=>({...l,members:Array.isArray(l.members)?l.members[0]??null:l.members}));
    setLogs(norm);
    const dayMap: Record<string, {present:number;late:number}> = {};
    (weekData??[]).forEach((l:any)=>{ const d=l.scanned_at.split('T')[0]; if(!dayMap[d]) dayMap[d]={present:0,late:0}; if(l.status==='present') dayMap[d].present++; if(l.status==='late') dayMap[d].late++; });
    setChart(Array.from({length:7},(_,i)=>{ const d=format(subDays(new Date(),6-i),'yyyy-MM-dd'); return {date:d,label:format(subDays(new Date(),6-i),'EEE'),...(dayMap[d]??{present:0,late:0})}; }));
    setClasses([...new Set((memberData??[]).map((m:any)=>m.class_name).filter(Boolean))].sort() as string[]);
    setLoading(false); setRefreshing(false);
  }, [authState?.orgId, today]);

  useEffect(() => { load(); }, [load]);

  const filtered = classFilter==='all' ? logs : logs.filter(l=>l.members?.class_name===classFilter);
  const present = filtered.filter(l=>l.status==='present').length;
  const late = filtered.filter(l=>l.status==='late').length;
  const weekAvg = Math.round(chart.reduce((a,d)=>a+d.present+d.late,0)/7);
  const maxDay = Math.max(...chart.map(d=>d.present+d.late),1);

  async function exportCSV() {
    const rows = [['Student','Class','Time','Status'],...filtered.map(l=>[l.members?.full_name??'',l.members?.class_name??'',formatTime(l.scanned_at),l.status])];
    await Share.share({ title:`Attendance ${today}`, message: rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n') });
  }

  const statusColor = (s:string) => s==='present'?theme.success:s==='late'?theme.warn:s==='excused'?theme.info:theme.textMuted;
  const statusBg = (s:string) => s==='present'?theme.successBg:s==='late'?theme.warnBg:s==='excused'?theme.infoBg:theme.bgCardAlt;

  if (loading) return <View style={{flex:1,backgroundColor:theme.bg,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={c} size="large"/></View>;

  return (
    <View style={{flex:1,backgroundColor:theme.bg}}>
      {/* Tabs */}
      <View style={[styles.tabRow,{backgroundColor:theme.bgCard,borderBottomColor:theme.border}]}>
        {(['daily','weekly'] as const).map(t=>(
          <TouchableOpacity key={t} onPress={()=>setTab(t)} style={[styles.tab,{backgroundColor:tab===t?c:'transparent',borderColor:tab===t?c:theme.border}]}>
            <Text style={[styles.tabText,{color:tab===t?'white':theme.textSub}]}>{t==='daily'?'Today':'7-Day'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} tintColor={c}/>}>
        {tab==='daily' && <>
          {/* Stats */}
          <View style={styles.statsGrid}>
            {[{l:'Scanned',v:filtered.length,c:theme.info,bg:theme.infoBg,i:'scan-outline'},{l:'On Time',v:present,c:theme.success,bg:theme.successBg,i:'checkmark-circle-outline'},{l:'Late',v:late,c:theme.warn,bg:theme.warnBg,i:'time-outline'},{l:'7d Avg',v:weekAvg,c:theme.purple,bg:theme.purpleBg,i:'bar-chart-outline'}].map(({l,v,c:col,bg,i})=>(
              <View key={l} style={[styles.statCard,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
                <View style={[styles.statIcon,{backgroundColor:bg}]}><Ionicons name={i as any} size={16} color={col}/></View>
                <Text style={[styles.statVal,{color:col}]}>{v}</Text>
                <Text style={[styles.statLbl,{color:theme.textMuted}]}>{l}</Text>
              </View>
            ))}
          </View>

          {/* Filter + Export */}
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6}}>
              {['all',...classes].map(cls=>(
                <TouchableOpacity key={cls} onPress={()=>setClassFilter(cls)}
                  style={[styles.chip,{backgroundColor:classFilter===cls?c:theme.bgCard,borderColor:classFilter===cls?c:theme.border}]}>
                  <Text style={[styles.chipText,{color:classFilter===cls?'white':theme.textSub}]}>{cls==='all'?'All':cls}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={exportCSV} style={[styles.exportBtn,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
              <Ionicons name="download-outline" size={16} color={c}/>
              <Text style={[styles.exportText,{color:c}]}>CSV</Text>
            </TouchableOpacity>
          </View>

          {/* Log list */}
          <View style={[styles.card,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
            <Text style={[styles.cardTitle,{color:theme.text}]}>Today's Scans ({filtered.length})</Text>
            {filtered.length===0 ? (
              <View style={styles.empty}><Ionicons name="scan-outline" size={32} color={theme.textMuted}/><Text style={[{fontSize:FONT.sm,color:theme.textMuted}]}>No scans today</Text></View>
            ) : filtered.map((log,i)=>(
              <View key={log.id} style={[styles.logRow,i<filtered.length-1&&{borderBottomWidth:1,borderBottomColor:theme.border}]}>
                <View style={[styles.logDot,{backgroundColor:statusColor(log.status)}]}/>
                <View style={{flex:1}}>
                  <Text style={[styles.logName,{color:theme.text}]}>{log.members?.full_name??'—'}</Text>
                  <Text style={[styles.logClass,{color:theme.textMuted}]}>{log.members?.class_name??'—'}</Text>
                </View>
                <View style={[styles.logBadge,{backgroundColor:statusBg(log.status)}]}>
                  <Text style={[styles.logBadgeText,{color:statusColor(log.status)}]}>{log.status==='present'?'On time':log.status}</Text>
                </View>
                <Text style={[styles.logTime,{color:theme.textMuted}]}>{formatTime(log.scanned_at)}</Text>
              </View>
            ))}
          </View>
        </>}

        {tab==='weekly' && <>
          {/* Bar chart */}
          <View style={[styles.card,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
            <Text style={[styles.cardTitle,{color:theme.text}]}>Last 7 Days</Text>
            <View style={styles.chartWrap}>
              {chart.map(day=>{
                const tot=day.present+day.late;
                const pct=Math.round((tot/maxDay)*100);
                const lpct=tot>0?Math.round((day.late/tot)*100):0;
                const isToday=day.date===today;
                return (
                  <View key={day.date} style={styles.barCol}>
                    <Text style={[styles.barCount,{color:theme.textMuted}]}>{tot>0?tot:''}</Text>
                    <View style={styles.barContainer}>
                      <View style={[styles.barStack,{height:`${Math.max(pct,tot>0?4:0)}%` as any}]}>
                        {day.late>0&&<View style={[styles.barLate,{height:`${lpct}%` as any,backgroundColor:theme.warn}]}/>}
                        <View style={[styles.barPresent,{backgroundColor:isToday?c:`${c}70`}]}/>
                      </View>
                    </View>
                    <Text style={[styles.barLabel,{color:isToday?c:theme.textMuted,fontWeight:isToday?'800':'400'}]}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:c}]}/><Text style={[styles.legendText,{color:theme.textMuted}]}>On time</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:theme.warn}]}/><Text style={[styles.legendText,{color:theme.textMuted}]}>Late</Text></View>
            </View>
          </View>

          {/* Week rows */}
          <View style={[styles.card,{backgroundColor:theme.bgCard,borderColor:theme.border,marginBottom:32}]}>
            <Text style={[styles.cardTitle,{color:theme.text}]}>Daily Breakdown</Text>
            {chart.map((day,i)=>(
              <View key={day.date} style={[styles.weekRow,i<chart.length-1&&{borderBottomWidth:1,borderBottomColor:theme.border}]}>
                <Text style={[styles.weekDay,{color:day.date===today?c:theme.textSub,fontWeight:day.date===today?'700':'400'}]}>{day.label}</Text>
                <Text style={[styles.weekDate,{color:theme.textMuted}]}>{formatDate(day.date)}</Text>
                <View style={[styles.weekBar,{backgroundColor:theme.bgCardAlt}]}>
                  {day.present+day.late>0&&<View style={[styles.weekFill,{width:`${((day.present+day.late)/maxDay)*100}%` as any,backgroundColor:`${c}60`}]}/>}
                </View>
                <Text style={[styles.weekCount,{color:theme.text,fontWeight:'700'}]}>{day.present+day.late}</Text>
              </View>
            ))}
          </View>
        </>}
        <View style={{height:32}}/>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  tabRow:{flexDirection:'row',gap:8,padding:SPACING.md,borderBottomWidth:1},
  tab:{paddingHorizontal:18,paddingVertical:8,borderRadius:RADIUS.lg,borderWidth:1.5},
  tabText:{fontSize:FONT.sm,fontWeight:'700'},
  statsGrid:{flexDirection:'row',gap:8,padding:SPACING.lg,paddingBottom:0},
  statCard:{flex:1,borderWidth:1,borderRadius:RADIUS.lg,padding:10,alignItems:'center',gap:4},
  statIcon:{width:32,height:32,borderRadius:RADIUS.md,alignItems:'center',justifyContent:'center'},
  statVal:{fontSize:20,fontWeight:'800'},
  statLbl:{fontSize:FONT.xs,fontWeight:'600'},
  filterRow:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:SPACING.lg,paddingVertical:10},
  chip:{paddingHorizontal:12,paddingVertical:6,borderRadius:RADIUS.full,borderWidth:1.5},
  chipText:{fontSize:FONT.sm,fontWeight:'600'},
  exportBtn:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:12,paddingVertical:8,borderRadius:RADIUS.lg,borderWidth:1},
  exportText:{fontSize:FONT.sm,fontWeight:'700'},
  card:{borderWidth:1,borderRadius:RADIUS.xl,marginHorizontal:SPACING.lg,marginTop:SPACING.md,overflow:'hidden'},
  cardTitle:{fontSize:FONT.base,fontWeight:'700',padding:SPACING.md,paddingBottom:8},
  logRow:{flexDirection:'row',alignItems:'center',gap:10,padding:10,paddingHorizontal:SPACING.md},
  logDot:{width:8,height:8,borderRadius:4},
  logName:{fontSize:FONT.sm,fontWeight:'600'},
  logClass:{fontSize:FONT.xs,marginTop:1},
  logBadge:{paddingHorizontal:8,paddingVertical:2,borderRadius:RADIUS.sm},
  logBadgeText:{fontSize:FONT.xs,fontWeight:'700'},
  logTime:{fontSize:FONT.xs,fontFamily:Platform.OS==='ios'?'Menlo':'monospace',minWidth:44,textAlign:'right'},
  empty:{padding:32,alignItems:'center',gap:8},
  chartWrap:{flexDirection:'row',height:120,alignItems:'flex-end',paddingHorizontal:SPACING.md,gap:4,paddingBottom:4},
  barCol:{flex:1,alignItems:'center',gap:2},
  barCount:{fontSize:FONT.xs,height:14,textAlign:'center'},
  barContainer:{flex:1,width:'100%',justifyContent:'flex-end'},
  barStack:{width:'100%',overflow:'hidden',borderRadius:3},
  barLate:{width:'100%'},
  barPresent:{flex:1,width:'100%'},
  barLabel:{fontSize:FONT.xs,marginTop:4},
  legend:{flexDirection:'row',gap:16,padding:SPACING.md,paddingTop:6},
  legendItem:{flexDirection:'row',alignItems:'center',gap:5},
  legendDot:{width:8,height:8,borderRadius:2},
  legendText:{fontSize:FONT.xs},
  weekRow:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:SPACING.md,paddingVertical:10},
  weekDay:{fontSize:FONT.sm,width:32},
  weekDate:{fontSize:FONT.xs,flex:1},
  weekBar:{height:6,width:80,borderRadius:3,overflow:'hidden'},
  weekFill:{height:'100%',borderRadius:3},
  weekCount:{fontSize:FONT.sm,width:24,textAlign:'right'},
});
