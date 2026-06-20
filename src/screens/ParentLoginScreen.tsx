import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { RADIUS, FONT, SPACING } from '../lib/theme';

export default function ParentLoginScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const c = '#16a34a';

  async function handleLogin() {
    const cleaned = phone.replace(/\D/g,'');
    if (cleaned.length<10) { setError('Enter a valid Nigerian phone number'); return; }
    setLoading(true); setError(null);
    const variants = [cleaned];
    if (cleaned.startsWith('0')&&cleaned.length===11) variants.push('234'+cleaned.slice(1));
    if (cleaned.startsWith('234')) variants.push('0'+cleaned.slice(3));
    const { data: students, error: fetchErr } = await supabase.from('members')
      .select('id,full_name,class_name,organisation_id,parent_phone,organisations(name,primary_color)')
      .in('parent_phone',variants).eq('member_type','student').eq('is_active',true);
    if (fetchErr) { setError('Connection error. Try again.'); setLoading(false); return; }
    if (!students||students.length===0) { setError('No students found for this number.'); setLoading(false); return; }
    navigation.navigate('ParentDashboard',{students,phone});
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={{flex:1,backgroundColor:theme.bg}} behavior={Platform.OS==='ios'?'padding':'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={()=>navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={theme.textSub}/>
          <Text style={[styles.backText,{color:theme.textSub}]}>Back</Text>
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <View style={[styles.icon,{backgroundColor:theme.successBg,borderColor:`${theme.success}30`}]}>
            <Ionicons name="phone-portrait-outline" size={28} color={theme.success}/>
          </View>
        </View>

        <Text style={[styles.title,{color:theme.text}]}>Parent Portal</Text>
        <Text style={[styles.sub,{color:theme.textSub}]}>View your child's attendance record.{'\n'}Enter the phone number registered with the school.</Text>

        <View style={[styles.card,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
          <View style={[styles.accent,{backgroundColor:theme.success}]}/>
          <View style={styles.cardInner}>
            <Text style={[styles.label,{color:theme.textMuted}]}>YOUR PHONE NUMBER</Text>
            <View style={[styles.inputWrap,{backgroundColor:theme.bgInput,borderColor:theme.border}]}>
              <Ionicons name="call-outline" size={16} color={theme.textMuted}/>
              <TextInput style={[styles.input,{color:theme.text}]} value={phone} onChangeText={t=>{setPhone(t);setError(null);}}
                placeholder="08012345678" placeholderTextColor={theme.textMuted} keyboardType="phone-pad" returnKeyType="go" onSubmitEditing={handleLogin}/>
            </View>
            <Text style={[styles.hint,{color:theme.textMuted}]}>As registered by your school admin</Text>

            {error&&(
              <View style={[styles.errorBox,{backgroundColor:theme.dangerBg,borderColor:`${theme.danger}25`}]}>
                <Ionicons name="alert-circle-outline" size={14} color={theme.danger}/>
                <Text style={[styles.errorText,{color:theme.dangerText}]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.btn,{backgroundColor:(!phone.trim()||loading)?(isDark?'rgba(255,255,255,0.06)':'#E5E7E5'):c}]} onPress={handleLogin} disabled={!phone.trim()||loading} activeOpacity={0.8}>
              {loading?<ActivityIndicator color="white" size="small"/>:(
                <><Text style={styles.btnText}>View My Child's Attendance</Text><Ionicons name="chevron-forward" size={16} color="white"/></>
              )}
            </TouchableOpacity>

            <View style={styles.securityRow}>
              {[{icon:'lock-closed-outline',text:'No account needed'},{icon:'flash-outline',text:'Instant access'}].map(({icon,text})=>(
                <View key={text} style={styles.securityItem}><Ionicons name={icon as any} size={11} color={theme.textMuted}/><Text style={[styles.securityText,{color:theme.textMuted}]}>{text}</Text></View>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.staffLink} onPress={()=>navigation.navigate('SlugEntry')}>
          <Text style={[styles.staffLinkText,{color:theme.textMuted}]}>Staff / Teacher? <Text style={{color:theme.success,fontWeight:'700'}}>Use Staff Login →</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  scroll:{flexGrow:1,padding:SPACING.xl,paddingTop:56},
  backBtn:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:32},
  backText:{fontSize:FONT.sm},
  iconWrap:{alignItems:'center',marginBottom:24},
  icon:{width:72,height:72,borderRadius:RADIUS.xxl,borderWidth:1,alignItems:'center',justifyContent:'center'},
  title:{fontSize:24,fontWeight:'800',textAlign:'center',marginBottom:8},
  sub:{fontSize:FONT.base,textAlign:'center',lineHeight:20,marginBottom:28},
  card:{borderWidth:1,borderRadius:RADIUS.xxl,overflow:'hidden',marginBottom:24},
  accent:{height:3},
  cardInner:{padding:SPACING.xl},
  label:{fontSize:FONT.xs,fontWeight:'700',letterSpacing:1.1,marginBottom:8},
  inputWrap:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1.5,borderRadius:RADIUS.lg,paddingHorizontal:14,height:50,marginBottom:6},
  input:{flex:1,fontSize:FONT.md},
  hint:{fontSize:FONT.xs,marginBottom:14},
  errorBox:{flexDirection:'row',alignItems:'flex-start',gap:8,borderWidth:1,borderRadius:RADIUS.md,padding:10,marginBottom:14},
  errorText:{flex:1,fontSize:FONT.sm,lineHeight:17},
  btn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,height:50,borderRadius:RADIUS.lg,marginTop:4},
  btnText:{fontSize:FONT.base,fontWeight:'700',color:'white'},
  securityRow:{flexDirection:'row',justifyContent:'center',gap:20,marginTop:16},
  securityItem:{flexDirection:'row',alignItems:'center',gap:4},
  securityText:{fontSize:FONT.xs},
  staffLink:{alignItems:'center'},
  staffLinkText:{fontSize:FONT.sm},
});
