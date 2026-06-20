import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, FONT, SPACING } from '../lib/theme';

export default function SettingsScreen() {
  const { authState, signOut } = useAuth();
  const { theme, mode, setMode, isDark } = useTheme();
  const c = authState?.primaryColor || '#16a34a';
  const settings = authState?.settings ?? {};
  const isAdmin = authState?.role === 'admin';

  function handleSignOut() {
    Alert.alert('Sign Out','Are you sure you want to sign out?',[{text:'Cancel',style:'cancel'},{text:'Sign Out',style:'destructive',onPress:signOut}]);
  }

  const THEME_OPTIONS = [
    { m:'light' as const, icon:'sunny-outline', label:'Light' },
    { m:'dark'  as const, icon:'moon-outline',  label:'Dark' },
    { m:'system'as const, icon:'phone-portrait-outline', label:'System' },
  ];

  return (
    <ScrollView style={{flex:1,backgroundColor:theme.bg}} contentContainerStyle={{paddingBottom:40}}>
      {/* Profile */}
      <View style={[styles.profileCard,{backgroundColor:`${c}10`,borderColor:`${c}25`}]}>
        <View style={[styles.avatar,{backgroundColor:c}]}><Ionicons name="person" size={24} color="white"/></View>
        <View style={{flex:1}}>
          <Text style={[styles.email,{color:theme.text}]}>{authState?.email}</Text>
          <View style={styles.profileMeta}>
            <View style={[styles.roleBadge,{backgroundColor:`${c}18`}]}><Text style={[styles.roleBadgeText,{color:c}]}>{authState?.role}</Text></View>
            <Text style={[styles.org,{color:theme.textMuted}]}>{authState?.orgName}</Text>
          </View>
        </View>
      </View>

      {/* Appearance — Theme toggle */}
      <Text style={[styles.section,{color:theme.textMuted}]}>APPEARANCE</Text>
      <View style={[styles.card,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map(({m,icon,label}) => {
            const active = mode === m;
            return (
              <TouchableOpacity key={m} onPress={()=>setMode(m)}
                style={[styles.themeOption,{
                  backgroundColor: active ? `${c}12` : 'transparent',
                  borderColor: active ? c : theme.border,
                }]}
                activeOpacity={0.7}
              >
                <View style={[styles.themeIconWrap,{backgroundColor: active ? c : theme.bgCardAlt}]}>
                  <Ionicons name={icon as any} size={18} color={active?'white':theme.textMuted}/>
                </View>
                <Text style={[styles.themeLabel,{color: active ? c : theme.textSub, fontWeight: active?'700':'500'}]}>{label}</Text>
                {active && <View style={[styles.checkDot,{backgroundColor:c}]}><Ionicons name="checkmark" size={10} color="white"/></View>}
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.themeHint,{color:theme.textMuted}]}>
          {mode==='system' ? `Following device setting (currently ${isDark?'dark':'light'})` : `${mode==='dark'?'Dark':'Light'} mode active`}
        </Text>
      </View>

      {/* School info */}
      <Text style={[styles.section,{color:theme.textMuted}]}>SCHOOL DETAILS</Text>
      <View style={[styles.card,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
        {[
          {label:'School Name',value:authState?.orgName},
          {label:'School ID',value:authState?.slug},
          {label:'Plan',value:authState?.plan},
          {label:'Max Students',value:String(authState?.maxMembers??50)},
        ].map(({label,value},i,arr)=>(
          <View key={label} style={[styles.infoRow,i<arr.length-1&&{borderBottomWidth:1,borderBottomColor:theme.border}]}>
            <Text style={[styles.infoLabel,{color:theme.textMuted}]}>{label}</Text>
            <Text style={[styles.infoValue,{color:theme.text}]}>{value??'—'}</Text>
          </View>
        ))}
      </View>

      {/* Attendance rules */}
      <Text style={[styles.section,{color:theme.textMuted}]}>ATTENDANCE RULES</Text>
      <View style={[styles.card,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
        {[
          {label:'Start Time',value:(settings.start_time as string)??'07:30'},
          {label:'Grace Period',value:`${(settings.grace_period_minutes as number)??15} min`},
          {label:'Absence Alert',value:(settings.absence_alert_time as string)??'09:00'},
        ].map(({label,value},i,arr)=>(
          <View key={label} style={[styles.infoRow,i<arr.length-1&&{borderBottomWidth:1,borderBottomColor:theme.border}]}>
            <Text style={[styles.infoLabel,{color:theme.textMuted}]}>{label}</Text>
            <Text style={[styles.infoValue,{color:theme.text}]}>{value}</Text>
          </View>
        ))}
        {isAdmin && <Text style={[styles.note,{color:theme.textMuted}]}>Edit full settings on the web dashboard.</Text>}
      </View>

      {/* Support */}
      <Text style={[styles.section,{color:theme.textMuted}]}>SUPPORT</Text>
      <View style={[styles.card,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
        {[
          {icon:'logo-whatsapp',label:'WhatsApp Support',sub:'+234 807 729 1745',color:theme.success,bg:theme.successBg,url:'https://wa.me/2348077291745'},
          {icon:'globe-outline',label:'Web Dashboard',sub:'Full settings & reports',color:theme.info,bg:theme.infoBg,url:'https://attendy-edu.vercel.app'},
          {icon:'mail-outline',label:'Email Support',sub:'attendyofficial@gmail.com',color:theme.purple,bg:theme.purpleBg,url:'mailto:attendyofficial@gmail.com'},
        ].map(({icon,label,sub,color,bg,url},i,arr)=>(
          <TouchableOpacity key={label} style={[styles.linkRow,i<arr.length-1&&{borderBottomWidth:1,borderBottomColor:theme.border}]} onPress={()=>Linking.openURL(url)} activeOpacity={0.6}>
            <View style={[styles.linkIcon,{backgroundColor:bg}]}><Ionicons name={icon as any} size={18} color={color}/></View>
            <View style={{flex:1}}>
              <Text style={[styles.linkLabel,{color:theme.text}]}>{label}</Text>
              <Text style={[styles.linkSub,{color:theme.textMuted}]}>{sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted}/>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={[styles.signOut,{backgroundColor:theme.dangerBg,borderColor:`${theme.danger}30`}]} onPress={handleSignOut} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={18} color={theme.danger}/>
        <Text style={[styles.signOutText,{color:theme.danger}]}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={[styles.footer,{color:theme.textMuted}]}>Attendy Edu · v1.0.0 · 🇳🇬</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  profileCard:{flexDirection:'row',alignItems:'center',gap:14,margin:SPACING.lg,borderWidth:1,borderRadius:RADIUS.xl,padding:SPACING.lg},
  avatar:{width:52,height:52,borderRadius:26,alignItems:'center',justifyContent:'center'},
  email:{fontSize:FONT.base,fontWeight:'700',marginBottom:6},
  profileMeta:{flexDirection:'row',alignItems:'center',gap:8},
  roleBadge:{paddingHorizontal:8,paddingVertical:3,borderRadius:RADIUS.sm},
  roleBadgeText:{fontSize:FONT.xs,fontWeight:'700',textTransform:'capitalize'},
  org:{fontSize:FONT.sm},
  section:{fontSize:FONT.xs,fontWeight:'700',letterSpacing:1,paddingHorizontal:SPACING.lg,paddingTop:SPACING.xl,paddingBottom:8},
  card:{borderWidth:1,borderRadius:RADIUS.xl,marginHorizontal:SPACING.lg,overflow:'hidden'},
  themeRow:{flexDirection:'row',gap:8,padding:SPACING.md},
  themeOption:{flex:1,alignItems:'center',gap:8,paddingVertical:14,borderRadius:RADIUS.lg,borderWidth:1.5,position:'relative'},
  themeIconWrap:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
  themeLabel:{fontSize:FONT.sm},
  checkDot:{position:'absolute',top:6,right:6,width:16,height:16,borderRadius:8,alignItems:'center',justifyContent:'center'},
  themeHint:{fontSize:FONT.xs,paddingHorizontal:SPACING.md,paddingBottom:SPACING.md,lineHeight:16},
  infoRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:SPACING.md,paddingVertical:12},
  infoLabel:{fontSize:FONT.sm},
  infoValue:{fontSize:FONT.sm,fontWeight:'600',maxWidth:180,textAlign:'right'},
  note:{fontSize:FONT.xs,paddingHorizontal:SPACING.md,paddingVertical:10,lineHeight:16},
  linkRow:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:SPACING.md,paddingVertical:12},
  linkIcon:{width:36,height:36,borderRadius:RADIUS.md,alignItems:'center',justifyContent:'center'},
  linkLabel:{fontSize:FONT.base,fontWeight:'600'},
  linkSub:{fontSize:FONT.xs,marginTop:1},
  signOut:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,margin:SPACING.lg,marginTop:SPACING.xxl,borderWidth:1,borderRadius:RADIUS.xl,paddingVertical:14},
  signOutText:{fontSize:FONT.md,fontWeight:'700'},
  footer:{textAlign:'center',fontSize:FONT.xs,paddingBottom:16},
});
