import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { getInitials } from '../lib/utils';
import { RADIUS, FONT, SPACING } from '../lib/theme';

type Student = { id:string; full_name:string; class_name:string|null; parent_phone:string|null };

export default function AbsentScreen() {
  const { authState } = useAuth();
  const { theme } = useTheme();
  const [absent, setAbsent] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [excusing, setExcusing] = useState<string|null>(null);
  const c = authState?.primaryColor || '#16a34a';
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async (refresh = false) => {
    if (!authState) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    const [{ data: all }, { data: scanned }] = await Promise.all([
      supabase.from('members').select('id,full_name,class_name,parent_phone')
        .eq('organisation_id',authState.orgId).eq('member_type','student').eq('is_active',true).order('class_name',{nullsFirst:false}).order('full_name'),
      supabase.from('attendance_logs').select('member_id')
        .eq('organisation_id',authState.orgId).eq('scan_type','entry').gte('scanned_at',`${today}T00:00:00`),
    ]);
    const ids = new Set((scanned??[]).map((s:any)=>s.member_id));
    setTotal(all?.length??0);
    setAbsent((all??[]).filter(s=>!ids.has(s.id)));
    setLoading(false); setRefreshing(false);
  }, [authState?.orgId, today]);

  useEffect(() => { load(); }, [load]);

  async function excuse(student: Student) {
    setExcusing(student.id);
    await supabase.from('attendance_logs').insert({ organisation_id:authState!.orgId, member_id:student.id, scan_type:'entry', status:'excused', late_reason:'Excused by admin', scanned_at:new Date().toISOString() });
    setAbsent(p => p.filter(s=>s.id!==student.id));
    setExcusing(null);
  }

  const present = total - absent.length;
  const pct = total > 0 ? Math.round((present/total)*100) : 0;

  if (loading) return <View style={{flex:1,backgroundColor:theme.bg,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={c} size="large"/></View>;

  return (
    <View style={{flex:1,backgroundColor:theme.bg}}>
      {/* Summary */}
      <View style={[styles.summary,{backgroundColor:theme.bgCard,borderBottomColor:theme.border}]}>
        <View style={styles.summaryNums}>
          <Text style={[styles.summaryNum,{color:theme.success}]}>{present} present</Text>
          <Text style={[styles.summaryPct,{color:pct>=75?theme.success:theme.danger}]}>{pct}%</Text>
          <Text style={[styles.summaryNum,{color:theme.danger}]}>{absent.length} absent</Text>
        </View>
        <View style={[styles.bar,{backgroundColor:theme.dangerBg}]}>
          <View style={[styles.barFill,{width:`${pct}%` as any,backgroundColor:pct>=75?c:theme.danger}]}/>
        </View>
        {absent.length===0 && (
          <View style={styles.allGood}>
            <Ionicons name="checkmark-circle" size={16} color={theme.success}/>
            <Text style={[styles.allGoodText,{color:theme.success}]}>All students accounted for!</Text>
          </View>
        )}
      </View>

      {absent.length > 0 && (
        <View style={[styles.alertBar,{backgroundColor:theme.dangerBg,borderBottomColor:theme.danger+'30'}]}>
          <Ionicons name="warning-outline" size={14} color={theme.danger}/>
          <Text style={[styles.alertText,{color:theme.dangerText}]}>{absent.length} student{absent.length!==1?'s':''} not scanned today</Text>
        </View>
      )}

      <FlatList data={absent} keyExtractor={i=>i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} tintColor={c}/>}
        contentContainerStyle={{paddingBottom:32}}
        ItemSeparatorComponent={()=><View style={{height:1,backgroundColor:theme.border,marginLeft:70}}/>}
        renderItem={({item}) => (
          <View style={[styles.row,{backgroundColor:theme.bgCard}]}>
            <View style={[styles.avatar,{backgroundColor:theme.dangerBg,borderColor:theme.danger+'30'}]}>
              <Text style={[styles.initials,{color:theme.danger}]}>{getInitials(item.full_name)}</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={[styles.name,{color:theme.text}]}>{item.full_name}</Text>
              <View style={styles.meta}>
                {item.class_name&&<View style={[styles.classBadge,{backgroundColor:`${c}12`}]}><Text style={[styles.classBadgeText,{color:c}]}>{item.class_name}</Text></View>}
                {item.parent_phone&&(
                  <TouchableOpacity onPress={()=>Linking.openURL(`tel:${item.parent_phone}`)} style={styles.phoneRow}>
                    <Ionicons name="call-outline" size={10} color={theme.textMuted}/>
                    <Text style={[styles.phone,{color:theme.textMuted}]}>{item.parent_phone}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.actions}>
              {item.parent_phone&&(
                <TouchableOpacity
                  style={[styles.waBtn,{backgroundColor:theme.successBg}]}
                  onPress={()=>Linking.openURL(`https://wa.me/${item.parent_phone!.replace(/\D/g,'')}?text=${encodeURIComponent(`Hello, ${item.full_name} has not been scanned at school today.`)}`)}>
                  <Ionicons name="logo-whatsapp" size={15} color={theme.success}/>
                </TouchableOpacity>
              )}
              {authState?.role==='admin'&&(
                <TouchableOpacity
                  style={[styles.excuseBtn,{borderColor:`${c}40`}]}
                  onPress={()=>Alert.alert('Mark as Excused?',`Mark ${item.full_name} as excused today?`,[{text:'Cancel',style:'cancel'},{text:'Excuse',onPress:()=>excuse(item)}])}
                  disabled={excusing===item.id}
                >
                  {excusing===item.id
                    ? <ActivityIndicator size={12} color={c}/>
                    : <Text style={[styles.excuseText,{color:c}]}>Excuse</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{alignItems:'center',padding:56,gap:12}}>
            <Ionicons name="checkmark-circle-outline" size={56} color={theme.success} style={{opacity:0.4}}/>
            <Text style={[{fontSize:FONT.lg,fontWeight:'700',color:theme.text}]}>Everyone accounted for!</Text>
            <Text style={[{fontSize:FONT.base,color:theme.textMuted,textAlign:'center'}]}>All students have been scanned or excused today.</Text>
          </View>
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  summary:{padding:SPACING.lg,borderBottomWidth:1,gap:10},
  summaryNums:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  summaryNum:{fontSize:FONT.sm,fontWeight:'600'},
  summaryPct:{fontSize:FONT.lg,fontWeight:'800'},
  bar:{height:8,borderRadius:4,overflow:'hidden'},
  barFill:{height:'100%',borderRadius:4},
  allGood:{flexDirection:'row',alignItems:'center',gap:6,marginTop:2},
  allGoodText:{fontSize:FONT.sm,fontWeight:'600'},
  alertBar:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:SPACING.lg,paddingVertical:10,borderBottomWidth:1},
  alertText:{fontSize:FONT.sm,fontWeight:'600'},
  row:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:SPACING.lg},
  avatar:{width:42,height:42,borderRadius:21,borderWidth:1,alignItems:'center',justifyContent:'center'},
  initials:{fontSize:FONT.sm,fontWeight:'800'},
  name:{fontSize:FONT.base,fontWeight:'600'},
  meta:{flexDirection:'row',alignItems:'center',gap:8,marginTop:3,flexWrap:'wrap'},
  classBadge:{paddingHorizontal:8,paddingVertical:2,borderRadius:RADIUS.sm},
  classBadgeText:{fontSize:FONT.xs,fontWeight:'700'},
  phoneRow:{flexDirection:'row',alignItems:'center',gap:3},
  phone:{fontSize:FONT.xs},
  actions:{flexDirection:'row',alignItems:'center',gap:8},
  waBtn:{width:34,height:34,borderRadius:RADIUS.md,alignItems:'center',justifyContent:'center'},
  excuseBtn:{paddingHorizontal:10,paddingVertical:6,borderRadius:RADIUS.md,borderWidth:1,minWidth:54,alignItems:'center'},
  excuseText:{fontSize:FONT.sm,fontWeight:'700'},
});
