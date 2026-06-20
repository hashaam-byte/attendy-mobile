import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Vibration, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { formatTime, getCutoffDisplay } from '../lib/utils';
import { RADIUS, FONT, SPACING } from '../lib/theme';

type ScanMode = 'entry' | 'exit';
type ResultType = 'success'|'late'|'exit'|'duplicate'|'unknown'|'suspended'|'error';
type ScanResult = { type: ResultType; name: string; className?: string; time: string; message?: string };

const RESULT = {
  success:   { icon: 'checkmark-circle', label: '✓ On Time' },
  late:      { icon: 'time',             label: 'Late Arrival' },
  exit:      { icon: 'log-out',          label: '✓ Exit Recorded' },
  duplicate: { icon: 'alert-circle',     label: 'Already Scanned' },
  suspended: { icon: 'shield-off',       label: '⚠ Suspended' },
  error:     { icon: 'close-circle',     label: 'Error' },
  unknown:   { icon: 'help-circle',      label: 'Not Found' },
};

export default function ScannerScreen() {
  const { authState } = useAuth();
  const { theme, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('entry');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [counts, setCounts] = useState({ entry: 0, exit: 0 });
  const [recent, setRecent] = useState<{name:string;status:string;time:string;mode:ScanMode}[]>([]);
  const lastRef = useRef(''); const lastTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const c = authState?.primaryColor || '#16a34a';
  const mc = mode === 'entry' ? c : theme.purple;

  function getResultColors(type: ResultType) {
    switch(type) {
      case 'success':   return { color: theme.success,  bg: theme.successBg };
      case 'late':      return { color: theme.warn,     bg: theme.warnBg };
      case 'exit':      return { color: theme.purple,   bg: theme.purpleBg };
      case 'duplicate': return { color: theme.info,     bg: theme.infoBg };
      case 'suspended': return { color: theme.warn,     bg: theme.warnBg };
      default:          return { color: theme.danger,   bg: theme.dangerBg };
    }
  }

  function clearResult() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setResult(null), 5000);
  }

  const handleScan = useCallback(async (data: string) => {
    if (processing || !authState) return;
    const now = Date.now();
    if (data === lastRef.current && now - lastTimeRef.current < 3000) return;
    lastRef.current = data; lastTimeRef.current = now;
    if (timerRef.current) clearTimeout(timerRef.current);
    setProcessing(true); setResult(null);
    try {
      const { data: member } = await supabase.from('members')
        .select('id,full_name,class_name,is_active')
        .eq('qr_code', data).eq('organisation_id', authState.orgId).maybeSingle();
      if (!member) {
        Vibration.vibrate(400);
        setResult({ type:'unknown', name:'Not Found', time: new Date().toLocaleTimeString(), message:'QR not registered in this school.' });
        setProcessing(false); clearResult(); return;
      }
      if (!member.is_active) {
        Vibration.vibrate([100,100,100]);
        setResult({ type:'suspended', name:member.full_name, className:member.class_name??undefined, time:new Date().toLocaleTimeString(), message:'Student is suspended.' });
        setProcessing(false); clearResult(); return;
      }
      const todayStart = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase.from('attendance_logs').select('id,scanned_at')
        .eq('member_id',member.id).eq('organisation_id',authState.orgId).eq('scan_type',mode)
        .gte('scanned_at',`${todayStart}T00:00:00`).limit(1);
      if (existing && existing.length > 0) {
        Vibration.vibrate(200);
        setResult({ type:'duplicate', name:member.full_name, className:member.class_name??undefined, time:new Date().toLocaleTimeString(), message:`Already ${mode==='exit'?'exited':'scanned'} at ${formatTime(existing[0].scanned_at)}` });
        setProcessing(false); clearResult(); return;
      }
      let status: 'present'|'late'|'early_exit' = mode==='exit'?'early_exit':'present';
      if (mode==='entry') {
        const st=(authState.settings.start_time as string)||'07:30';
        const grace=(authState.settings.grace_period_minutes as number)??15;
        const [sh,sm]=st.split(':').map(Number);
        const cut=new Date(); cut.setHours(sh,sm+grace,0,0);
        if (new Date()>cut) status='late';
      }
      const { error: insErr } = await supabase.from('attendance_logs').insert({
        organisation_id:authState.orgId, member_id:member.id,
        scan_type:mode, status, device_id:'mobile-app', scanned_at:new Date().toISOString(),
      });
      if (insErr) {
        Vibration.vibrate(500);
        setResult({ type:'error', name:member.full_name, time:new Date().toLocaleTimeString(), message:insErr.message });
        setProcessing(false); clearResult(); return;
      }
      const t = new Date().toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit'});
      const rt: ResultType = mode==='exit'?'exit':status==='present'?'success':'late';
      Vibration.vibrate(rt==='success'?[50]:rt==='late'?[100,50,100]:rt==='exit'?[50,50,50]:[200,100,200]);
      setCounts(p => ({ ...p, [mode]: p[mode]+1 }));
      setResult({ type:rt, name:member.full_name, className:member.class_name??undefined, time:t });
      setRecent(p => [{ name:member.full_name, status:mode==='exit'?'exit':status, time:t, mode }, ...p.slice(0,3)]);
      clearResult();
    } catch {
      setResult({ type:'error', name:'Error', time:new Date().toLocaleTimeString(), message:'Something went wrong.' });
      clearResult();
    } finally { setProcessing(false); }
  }, [processing, authState, mode, theme]);

  const cutoff = authState ? getCutoffDisplay(authState.settings) : '8:15 AM';

  if (!permission) return <View style={{flex:1,backgroundColor:theme.bg,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={c}/></View>;
  if (!permission.granted) return (
    <View style={{flex:1,backgroundColor:theme.bg,alignItems:'center',justifyContent:'center',gap:16,padding:32}}>
      <View style={[styles.permIcon,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
        <Ionicons name="camera-outline" size={36} color={theme.textMuted}/>
      </View>
      <Text style={[styles.permTitle,{color:theme.text}]}>Camera Access Required</Text>
      <Text style={[styles.permSub,{color:theme.textSub}]}>Attendy needs camera access to scan QR codes at the gate.</Text>
      <TouchableOpacity style={[styles.permBtn,{backgroundColor:c}]} onPress={requestPermission}>
        <Text style={styles.permBtnText}>Grant Camera Access</Text>
      </TouchableOpacity>
    </View>
  );

  const rc = result ? getResultColors(result.type) : null;
  const ri = result ? RESULT[result.type] : null;

  return (
    <View style={[styles.container,{backgroundColor:theme.bg}]}>
      {/* Header */}
      <View style={[styles.header,{backgroundColor:theme.bgCard,borderBottomColor:theme.border}]}>
        <View>
          <Text style={[styles.headerOrg,{color:theme.text}]}>{authState?.orgName}</Text>
          <Text style={[styles.headerMode,{color:mc}]}>{mode==='entry'?'↑ ENTRY MODE':'↓ EXIT MODE'}</Text>
        </View>
        <View style={styles.counters}>
          <View style={[styles.counterChip,{backgroundColor:theme.successBg}]}>
            <Text style={[styles.counterText,{color:theme.success}]}>↑ {counts.entry}</Text>
          </View>
          <View style={[styles.counterChip,{backgroundColor:theme.purpleBg}]}>
            <Text style={[styles.counterText,{color:theme.purple}]}>↓ {counts.exit}</Text>
          </View>
        </View>
      </View>

      {/* Mode toggle */}
      <View style={[styles.modeRow,{backgroundColor:theme.bgCard,borderBottomColor:theme.border}]}>
        {(['entry','exit'] as ScanMode[]).map(m => (
          <TouchableOpacity key={m}
            onPress={() => { setMode(m); setResult(null); }}
            style={[styles.modeBtn,{
              backgroundColor: mode===m ? (m==='entry'?`${c}18`:theme.purpleBg) : 'transparent',
              borderColor: mode===m ? (m==='entry'?`${c}50`:theme.purpleBg) : theme.border,
            }]}
            activeOpacity={0.7}
          >
            <Ionicons name={m==='entry'?'enter-outline':'exit-outline'} size={16} color={mode===m?(m==='entry'?c:theme.purple):theme.textMuted}/>
            <Text style={[styles.modeBtnText,{color:mode===m?(m==='entry'?c:theme.purple):theme.textMuted}]}>{m.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Camera */}
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={processing ? undefined : ({data}) => handleScan(data)}
          barcodeScannerSettings={{barcodeTypes:['qr']}}
        />
        {/* Corner frame */}
        {(['tl','tr','bl','br'] as const).map(pos => (
          <View key={pos} style={[styles.corner, styles[`c_${pos}`],{borderColor:mc}]}/>
        ))}
        {/* Scan line */}
        {!processing && <View style={[styles.scanLine,{backgroundColor:mc,shadowColor:mc}]}/>}
        {/* Processing overlay */}
        {processing && (
          <View style={[styles.procOverlay,{backgroundColor:isDark?'rgba(0,0,0,0.65)':'rgba(255,255,255,0.7)'}]}>
            <View style={[styles.procCircle,{borderColor:mc,backgroundColor:`${mc}15`}]}>
              <ActivityIndicator size="large" color={mc}/>
            </View>
            <Text style={[styles.procText,{color:mc}]}>PROCESSING…</Text>
          </View>
        )}
        {/* Info overlay bottom */}
        <View style={[styles.cameraInfo,{backgroundColor:isDark?'rgba(0,0,0,0.55)':'rgba(255,255,255,0.75)'}]}>
          <View style={[styles.statusDot,{backgroundColor:processing?theme.warn:mc}]}/>
          <Text style={[styles.statusText,{color:processing?theme.warn:mc}]}>
            {processing?'Processing…':mode==='entry'?`Entry · Late after ${cutoff}`:'Exit mode active'}
          </Text>
        </View>
      </View>

      {/* Result card */}
      {result && rc && ri && (
        <View style={[styles.resultCard,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
          <View style={[styles.resultLeft,{backgroundColor:rc.bg,borderColor:`${rc.color}30`}]}>
            <Ionicons name={ri.icon as any} size={26} color={rc.color}/>
          </View>
          <View style={{flex:1}}>
            <Text style={[styles.resultLabel,{color:rc.color}]}>{ri.label}</Text>
            <Text style={[styles.resultName,{color:theme.text}]}>{result.name}</Text>
            {result.className&&<Text style={[styles.resultClass,{color:theme.textSub}]}>{result.className}</Text>}
            {result.message&&<Text style={[styles.resultMsg,{color:theme.textMuted}]}>{result.message}</Text>}
          </View>
          <Text style={[styles.resultTime,{color:rc.color}]}>{result.time}</Text>
        </View>
      )}

      {/* Recent scans */}
      {recent.length > 0 && !result && (
        <View style={[styles.recentWrap,{backgroundColor:theme.bgCard,borderColor:theme.border}]}>
          {recent.map((s,i) => {
            const sc = s.mode==='exit'?theme.purple:s.status==='present'?theme.success:theme.warn;
            return (
              <View key={i} style={[styles.recentRow, i<recent.length-1&&{borderBottomWidth:1,borderBottomColor:theme.border}]}>
                <View style={[styles.recentDot,{backgroundColor:sc}]}/>
                <Text style={[styles.recentName,{color:theme.text}]}>{s.name}</Text>
                <Text style={[styles.recentStatus,{color:sc}]}>{s.mode==='exit'?'Exit':s.status==='present'?'On time':'Late'}</Text>
                <Text style={[styles.recentTime,{color:theme.textMuted}]}>{s.time}</Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={[styles.footer,{color:theme.textMuted}]}>
        {counts.entry + counts.exit} scans this session
      </Text>
    </View>
  );
}

const C = 22;
const styles = StyleSheet.create({
  container:{flex:1},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:SPACING.lg,paddingVertical:SPACING.md,borderBottomWidth:1},
  headerOrg:{fontSize:FONT.base,fontWeight:'700'},
  headerMode:{fontSize:FONT.xs,fontWeight:'800',letterSpacing:1,marginTop:2},
  counters:{flexDirection:'row',gap:6},
  counterChip:{paddingHorizontal:10,paddingVertical:5,borderRadius:RADIUS.full},
  counterText:{fontSize:FONT.sm,fontWeight:'700'},
  modeRow:{flexDirection:'row',gap:8,padding:10,borderBottomWidth:1},
  modeBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:10,borderRadius:RADIUS.lg,borderWidth:1.5},
  modeBtnText:{fontSize:FONT.sm,fontWeight:'800',letterSpacing:0.5},
  cameraWrap:{flex:1,overflow:'hidden',position:'relative'},
  corner:{position:'absolute',width:C,height:C,borderWidth:2.5},
  c_tl:{top:14,left:14,borderRightWidth:0,borderBottomWidth:0,borderTopLeftRadius:4},
  c_tr:{top:14,right:14,borderLeftWidth:0,borderBottomWidth:0,borderTopRightRadius:4},
  c_bl:{bottom:50,left:14,borderRightWidth:0,borderTopWidth:0,borderBottomLeftRadius:4},
  c_br:{bottom:50,right:14,borderLeftWidth:0,borderTopWidth:0,borderBottomRightRadius:4},
  scanLine:{position:'absolute',top:'45%',left:16,right:16,height:2,borderRadius:1,shadowOffset:{width:0,height:0},shadowOpacity:0.8,shadowRadius:6,elevation:4},
  procOverlay:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',gap:12},
  procCircle:{width:64,height:64,borderRadius:32,borderWidth:2,alignItems:'center',justifyContent:'center'},
  procText:{fontSize:FONT.sm,fontWeight:'800',letterSpacing:1.5},
  cameraInfo:{position:'absolute',bottom:0,left:0,right:0,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,paddingVertical:10},
  statusDot:{width:7,height:7,borderRadius:4},
  statusText:{fontSize:FONT.sm,fontWeight:'600'},
  resultCard:{flexDirection:'row',alignItems:'center',gap:12,margin:10,borderWidth:1,borderRadius:RADIUS.xl,padding:14},
  resultLeft:{width:50,height:50,borderRadius:25,alignItems:'center',justifyContent:'center',borderWidth:1},
  resultLabel:{fontSize:FONT.xs,fontWeight:'800',letterSpacing:0.5},
  resultName:{fontSize:FONT.lg,fontWeight:'800',marginTop:2},
  resultClass:{fontSize:FONT.sm,marginTop:1},
  resultMsg:{fontSize:FONT.sm,marginTop:2},
  resultTime:{fontSize:FONT.md,fontWeight:'800'},
  recentWrap:{borderWidth:1,borderRadius:RADIUS.lg,marginHorizontal:10,overflow:'hidden'},
  recentRow:{flexDirection:'row',alignItems:'center',gap:10,padding:10,paddingHorizontal:14},
  recentDot:{width:7,height:7,borderRadius:4},
  recentName:{flex:1,fontSize:FONT.sm,fontWeight:'600'},
  recentStatus:{fontSize:FONT.xs,fontWeight:'700'},
  recentTime:{fontSize:FONT.xs,fontFamily:Platform.OS==='ios'?'Menlo':'monospace'},
  footer:{textAlign:'center',fontSize:FONT.xs,padding:8},
  permIcon:{width:80,height:80,borderRadius:RADIUS.xl,alignItems:'center',justifyContent:'center',borderWidth:1},
  permTitle:{fontSize:FONT.xl,fontWeight:'800',textAlign:'center'},
  permSub:{fontSize:FONT.base,textAlign:'center',lineHeight:22,maxWidth:280},
  permBtn:{paddingHorizontal:24,paddingVertical:14,borderRadius:RADIUS.xl},
  permBtnText:{color:'white',fontWeight:'700',fontSize:FONT.md},
});
