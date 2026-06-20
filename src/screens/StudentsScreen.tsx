import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { getInitials } from '../lib/utils';
import { SearchInput } from '../components/ui';
import { RADIUS, FONT, SPACING } from '../lib/theme';

type Student = { id:string; full_name:string; class_name:string|null; parent_phone:string|null; employee_id:string|null; is_active:boolean };

export default function StudentsScreen({ navigation }: any) {
  const { authState } = useAuth();
  const { theme } = useTheme();
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const c = authState?.primaryColor || '#16a34a';

  const load = useCallback(async (refresh = false) => {
    if (!authState) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    const { data } = await supabase.from('members')
      .select('id,full_name,class_name,parent_phone,employee_id,is_active')
      .eq('organisation_id', authState.orgId).eq('member_type','student')
      .order('class_name',{nullsFirst:false}).order('full_name');
    const list = data ?? [];
    setStudents(list); setFiltered(list);
    setClasses([...new Set(list.map(s=>s.class_name).filter(Boolean) as string[])].sort());
    setLoading(false); setRefreshing(false);
  }, [authState?.orgId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let r = students;
    if (classFilter !== 'all') r = r.filter(s => s.class_name === classFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(s => s.full_name.toLowerCase().includes(q) || (s.class_name??'').toLowerCase().includes(q) || (s.employee_id??'').toLowerCase().includes(q));
    }
    setFiltered(r);
  }, [search, classFilter, students]);

  if (loading) return <View style={{flex:1,backgroundColor:theme.bg,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={c} size="large"/></View>;

  return (
    <View style={{flex:1,backgroundColor:theme.bg}}>
      {/* Search + Add */}
      <View style={[styles.topBar,{backgroundColor:theme.bgCard,borderBottomColor:theme.border}]}>
        <View style={{flex:1}}>
          <SearchInput value={search} onChangeText={setSearch} placeholder="Search name, class, ID…"/>
        </View>
        {authState?.role === 'admin' && (
          <TouchableOpacity style={[styles.addBtn,{backgroundColor:c}]} onPress={() => navigation.navigate('RegisterStudent')}>
            <Ionicons name="add" size={22} color="white"/>
          </TouchableOpacity>
        )}
      </View>

      {/* Class chips */}
      <FlatList horizontal showsHorizontalScrollIndicator={false}
        data={['all',...classes]} keyExtractor={i=>i}
        style={[styles.chipList,{borderBottomColor:theme.border}]}
        contentContainerStyle={{paddingHorizontal:SPACING.lg,gap:8,paddingVertical:10}}
        renderItem={({item}) => (
          <TouchableOpacity onPress={() => setClassFilter(item)}
            style={[styles.chip,{
              backgroundColor: classFilter===item ? c : theme.bgCard,
              borderColor: classFilter===item ? c : theme.border,
            }]}
          >
            <Text style={[styles.chipText,{color:classFilter===item?'white':theme.textSub}]}>
              {item==='all'?'All Classes':item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Text style={[styles.countText,{color:theme.textMuted}]}>{filtered.length} of {students.length} students</Text>

      <FlatList data={filtered} keyExtractor={i=>i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} tintColor={c}/>}
        contentContainerStyle={{paddingBottom:32}}
        ItemSeparatorComponent={() => <View style={{height:1,backgroundColor:theme.border,marginLeft:72}}/>}
        renderItem={({item}) => {
          const initBg = item.is_active ? `${c}18` : theme.bgCardAlt;
          const initColor = item.is_active ? c : theme.textMuted;
          return (
            <TouchableOpacity style={[styles.row,{backgroundColor:theme.bgCard}]}
              onPress={() => navigation.navigate('StudentProfile',{studentId:item.id})} activeOpacity={0.6}>
              <View style={[styles.avatar,{backgroundColor:initBg,borderColor:item.is_active?`${c}30`:theme.border}]}>
                <Text style={[styles.avatarText,{color:initColor}]}>{getInitials(item.full_name)}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={[styles.name,{color:theme.text}]}>{item.full_name}</Text>
                <View style={styles.meta}>
                  {item.class_name && (
                    <View style={[styles.classBadge,{backgroundColor:`${c}12`}]}>
                      <Text style={[styles.classBadgeText,{color:c}]}>{item.class_name}</Text>
                    </View>
                  )}
                  {item.employee_id && <Text style={[styles.empId,{color:theme.textMuted}]}>{item.employee_id}</Text>}
                </View>
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.statusDot,{backgroundColor:item.is_active?theme.success:theme.danger}]}/>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted}/>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{alignItems:'center',padding:56,gap:12}}>
            <View style={[styles.emptyIcon,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
              <Ionicons name="people-outline" size={32} color={theme.textMuted}/>
            </View>
            <Text style={[styles.emptyTitle,{color:theme.text}]}>{search||classFilter!=='all'?'No students match':'No students yet'}</Text>
            {authState?.role==='admin'&&!search&&classFilter==='all'&&(
              <TouchableOpacity style={[styles.addFirstBtn,{backgroundColor:c}]} onPress={() => navigation.navigate('RegisterStudent')}>
                <Ionicons name="person-add-outline" size={16} color="white"/>
                <Text style={styles.addFirstText}>Add First Student</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  topBar:{flexDirection:'row',alignItems:'center',gap:10,padding:SPACING.md,paddingHorizontal:SPACING.lg,borderBottomWidth:1},
  addBtn:{width:44,height:44,borderRadius:RADIUS.lg,alignItems:'center',justifyContent:'center'},
  chipList:{flexGrow:0,borderBottomWidth:1},
  chip:{paddingHorizontal:14,paddingVertical:7,borderRadius:RADIUS.full,borderWidth:1.5},
  chipText:{fontSize:FONT.sm,fontWeight:'600'},
  countText:{fontSize:FONT.xs,paddingHorizontal:SPACING.lg,paddingVertical:8},
  row:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:SPACING.lg},
  avatar:{width:42,height:42,borderRadius:21,borderWidth:1.5,alignItems:'center',justifyContent:'center'},
  avatarText:{fontSize:FONT.base,fontWeight:'800'},
  name:{fontSize:FONT.base,fontWeight:'600'},
  meta:{flexDirection:'row',alignItems:'center',gap:8,marginTop:3},
  classBadge:{paddingHorizontal:8,paddingVertical:2,borderRadius:RADIUS.sm},
  classBadgeText:{fontSize:FONT.xs,fontWeight:'700'},
  empId:{fontSize:FONT.xs},
  rowRight:{flexDirection:'row',alignItems:'center',gap:6},
  statusDot:{width:7,height:7,borderRadius:4},
  emptyIcon:{width:72,height:72,borderRadius:RADIUS.xl,alignItems:'center',justifyContent:'center',borderWidth:1},
  emptyTitle:{fontSize:FONT.lg,fontWeight:'700',textAlign:'center'},
  addFirstBtn:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:20,paddingVertical:12,borderRadius:RADIUS.xl,marginTop:4},
  addFirstText:{color:'white',fontWeight:'700',fontSize:FONT.base},
});
