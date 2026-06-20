import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { RADIUS, FONT, SPACING } from '../lib/theme';

const CLASSES = ['Nursery 1','Nursery 2','Nursery 3','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6','JSS 1','JSS 2','JSS 3','SSS 1','SSS 2','SSS 3'];

function generateStudentId(orgName:string, count:number): string {
  const words = orgName.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0]?.toUpperCase() ?? 'X';
  const last = words.length>1 ? words[words.length-1][0].toUpperCase() : first;
  const seq = String(count+1).padStart(4,'0');
  const rand = Math.floor(Math.random()*100).toString().padStart(2,'0');
  return `${first}${last}-${seq}-${rand}`;
}

export default function RegisterStudentScreen({ navigation }: any) {
  const { authState } = useAuth();
  const { theme, isDark } = useTheme();
  const [form, setForm] = useState({ full_name:'', class_name:'', parent_phone:'', employee_id:'', notes:'' });
  const [loading, setLoading] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [error, setError] = useState<string|null>(null);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const c = authState?.primaryColor || '#16a34a';

  useEffect(() => {
    if (!authState) return;
    supabase.from('members').select('*',{count:'exact',head:true}).eq('organisation_id',authState.orgId).eq('member_type','student').eq('is_active',true)
      .then(({count}) => { const n=count??0; setStudentCount(n); setForm(f=>({...f,employee_id:generateStudentId(authState.orgName,n)})); });
  }, [authState?.orgId]);

  function update(field:string, value:string) { setForm(p=>({...p,[field]:value})); setError(null); }

  async function handleSubmit() {
    if (!form.full_name.trim()) { setError('Full name is required.'); return; }
    if (!form.class_name) { setError('Please select a class.'); return; }
    if (!form.parent_phone.trim()) { setError('Parent phone number is required.'); return; }
    if (!authState) return;
    setLoading(true); setError(null);
    const { count: currentCount } = await supabase.from('members').select('*',{count:'exact',head:true}).eq('organisation_id',authState.orgId).eq('member_type','student').eq('is_active',true);
    if ((currentCount??0)>=authState.maxMembers) { setError(`Plan limit reached (${authState.maxMembers} students).`); setLoading(false); return; }
    const finalId = form.employee_id.trim() || generateStudentId(authState.orgName, currentCount??studentCount);
    const { data: member, error: insertErr } = await supabase.from('members').insert({
      organisation_id:authState.orgId, full_name:form.full_name.trim(), class_name:form.class_name,
      parent_phone:form.parent_phone.trim(), member_type:'student', role:'viewer', employee_id:finalId,
      notes:form.notes.trim()||null, is_active:true,
    }).select().single();
    if (insertErr) { setError(insertErr.message); setLoading(false); return; }
    setLoading(false);
    Alert.alert('Student Registered! ✓', `${form.full_name} added to ${form.class_name}.\n\nID: ${finalId}\n\nParent gets SMS when scanned in.`, [
      { text:'Register Another', onPress:()=>{
        const nextCount=(currentCount??studentCount)+1;
        setForm({ full_name:'', class_name:'', parent_phone:'', employee_id:generateStudentId(authState.orgName,nextCount), notes:'' });
        setStudentCount(nextCount);
      }},
      { text:'View Students', onPress:()=>navigation.navigate('Students') },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{flex:1,backgroundColor:theme.bg}} behavior={Platform.OS==='ios'?'padding':'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.usageBar,{backgroundColor:`${c}08`,borderColor:`${c}20`}]}>
          <Text style={[styles.usageText,{color:theme.textSub}]}>{studentCount} / {authState?.maxMembers??50} students used</Text>
          <View style={[styles.usageTrack,{backgroundColor:theme.bgCardAlt}]}>
            <View style={[styles.usageFill,{width:`${Math.min((studentCount/(authState?.maxMembers??50))*100,100)}%` as any,backgroundColor:c}]}/>
          </View>
        </View>

        <View style={[styles.card,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
          <View style={styles.field}>
            <Text style={[styles.label,{color:theme.textMuted}]}>FULL NAME *</Text>
            <TextInput style={[styles.input,{backgroundColor:theme.bgInput,borderColor:theme.border,color:theme.text}]} value={form.full_name} onChangeText={t=>update('full_name',t)} placeholder="e.g. Adaeze Okonkwo" placeholderTextColor={theme.textMuted} autoCapitalize="words"/>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label,{color:theme.textMuted}]}>CLASS *</Text>
            <TouchableOpacity style={[styles.input,styles.selectInput,{backgroundColor:theme.bgInput,borderColor:theme.border}]} onPress={()=>setShowClassPicker(!showClassPicker)}>
              <Text style={[styles.selectText,{color:form.class_name?theme.text:theme.textMuted}]}>{form.class_name||'Select class…'}</Text>
              <Ionicons name={showClassPicker?'chevron-up':'chevron-down'} size={16} color={theme.textMuted}/>
            </TouchableOpacity>
            {showClassPicker&&(
              <View style={[styles.classPicker,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
                <ScrollView nestedScrollEnabled style={{maxHeight:240}}>
                  {CLASSES.map(cls=>(
                    <TouchableOpacity key={cls} style={[styles.classOption,{borderBottomColor:theme.border},form.class_name===cls&&{backgroundColor:`${c}12`}]} onPress={()=>{update('class_name',cls);setShowClassPicker(false);}}>
                      <Text style={[styles.classOptionText,{color:form.class_name===cls?c:theme.textSub}]}>{cls}</Text>
                      {form.class_name===cls&&<Ionicons name="checkmark" size={16} color={c}/>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label,{color:theme.textMuted}]}>STUDENT ID (auto-generated)</Text>
            <View style={styles.idRow}>
              <TextInput style={[styles.input,{flex:1,backgroundColor:theme.bgInput,borderColor:theme.border,color:theme.text}]} value={form.employee_id} onChangeText={t=>update('employee_id',t)} placeholder="Auto-generated" placeholderTextColor={theme.textMuted} autoCapitalize="characters"/>
              <TouchableOpacity style={[styles.regenBtn,{borderColor:`${c}40`,backgroundColor:theme.bgInput}]} onPress={()=>update('employee_id',generateStudentId(authState?.orgName??'SC',studentCount))}>
                <Ionicons name="refresh-outline" size={16} color={c}/>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label,{color:theme.textMuted}]}>PARENT / GUARDIAN PHONE *</Text>
            <TextInput style={[styles.input,{backgroundColor:theme.bgInput,borderColor:theme.border,color:theme.text}]} value={form.parent_phone} onChangeText={t=>update('parent_phone',t)} placeholder="08012345678" placeholderTextColor={theme.textMuted} keyboardType="phone-pad"/>
            <Text style={[styles.hint,{color:theme.textMuted}]}>Parent receives SMS on arrival, late and absence alerts.</Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label,{color:theme.textMuted}]}>NOTES (optional)</Text>
            <TextInput style={[styles.input,styles.textArea,{backgroundColor:theme.bgInput,borderColor:theme.border,color:theme.text}]} value={form.notes} onChangeText={t=>update('notes',t)} placeholder="Any special notes…" placeholderTextColor={theme.textMuted} multiline numberOfLines={3} textAlignVertical="top"/>
          </View>

          {error&&(
            <View style={[styles.errorBox,{backgroundColor:theme.dangerBg,borderColor:`${theme.danger}25`}]}>
              <Ionicons name="warning-outline" size={14} color={theme.danger}/><Text style={[styles.errorText,{color:theme.dangerText}]}>{error}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={[styles.submitBtn,{backgroundColor:(!form.full_name||!form.class_name||!form.parent_phone||loading)?(isDark?'rgba(255,255,255,0.06)':'#E5E7E5'):c}]} onPress={handleSubmit} disabled={!form.full_name||!form.class_name||!form.parent_phone||loading} activeOpacity={0.8}>
          {loading?<ActivityIndicator color="white" size="small"/>:(<><Ionicons name="person-add-outline" size={18} color="white"/><Text style={styles.submitBtnText}>Register Student</Text></>)}
        </TouchableOpacity>

        <Text style={[styles.footer,{color:theme.textMuted}]}>QR card is auto-generated. Print it from the web dashboard.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  scroll:{padding:SPACING.lg,paddingBottom:40},
  usageBar:{borderWidth:1,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.lg,gap:8},
  usageText:{fontSize:FONT.sm},
  usageTrack:{height:4,borderRadius:2,overflow:'hidden'},
  usageFill:{height:'100%',borderRadius:2},
  card:{borderWidth:1,borderRadius:RADIUS.xl,padding:SPACING.lg,marginBottom:SPACING.lg,gap:4},
  field:{marginBottom:SPACING.lg},
  label:{fontSize:FONT.xs,fontWeight:'700',letterSpacing:1.1,marginBottom:8},
  input:{borderWidth:1,borderRadius:RADIUS.lg,paddingHorizontal:12,height:48,fontSize:FONT.base},
  selectInput:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingRight:12},
  selectText:{fontSize:FONT.base},
  classPicker:{borderWidth:1,borderRadius:RADIUS.lg,marginTop:4,overflow:'hidden'},
  classOption:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,paddingVertical:12,borderBottomWidth:1},
  classOptionText:{fontSize:FONT.base},
  idRow:{flexDirection:'row',gap:8},
  regenBtn:{width:48,height:48,borderRadius:RADIUS.lg,borderWidth:1,alignItems:'center',justifyContent:'center'},
  textArea:{height:80,paddingTop:12},
  hint:{fontSize:FONT.xs,marginTop:6,lineHeight:16},
  errorBox:{flexDirection:'row',alignItems:'flex-start',gap:8,borderWidth:1,borderRadius:RADIUS.md,padding:10},
  errorText:{flex:1,fontSize:FONT.sm,lineHeight:17},
  submitBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderRadius:RADIUS.xl,height:52,marginBottom:SPACING.lg},
  submitBtnText:{fontSize:FONT.md,fontWeight:'700',color:'white'},
  footer:{fontSize:FONT.xs,textAlign:'center',lineHeight:16},
});
