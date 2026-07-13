// src/components/ErrorBoundary.tsx — ATTENDY-EDU
// Catches any unhandled JS error and shows a recovery screen
// instead of a white crash screen. Wrap the root navigator with this.

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface State { hasError: boolean; errorMsg: string; errorStack: string; }
interface Props { children: React.ReactNode; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMsg: '', errorStack: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error?.message ?? 'Unknown error', errorStack: error?.stack ?? '' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => this.setState({ hasError: false, errorMsg: '', errorStack: '' });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.container}>
        <View style={s.iconWrap}>
          <Ionicons name="warning-outline" size={44} color="#ef4444" />
        </View>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.sub}>
          The app hit an unexpected error.{'\n'}Force-close and reopen if this keeps happening.
        </Text>
        <ScrollView style={s.errorBox} contentContainerStyle={{ padding: 12 }}>
          <Text style={s.errorText} selectable>{this.state.errorMsg}</Text>
          {__DEV__ && this.state.errorStack ? (
            <Text style={[s.errorText, { opacity: 0.4, marginTop: 8, fontSize: 10 }]} selectable>
              {this.state.errorStack}
            </Text>
          ) : null}
        </ScrollView>
        <TouchableOpacity style={s.btn} onPress={this.handleReset}>
          <Ionicons name="refresh-outline" size={16} color="white" style={{ marginRight: 8 }} />
          <Text style={s.btnText}>Try to Recover</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container:  { flex:1, backgroundColor:'#030a05', alignItems:'center', justifyContent:'center', padding:28 },
  iconWrap:   { width:72, height:72, borderRadius:36, backgroundColor:'rgba(239,68,68,0.1)', alignItems:'center', justifyContent:'center', marginBottom:18, borderWidth:1, borderColor:'rgba(239,68,68,0.25)' },
  title:      { fontSize:20, fontWeight:'700', color:'rgba(255,255,255,0.9)', marginBottom:10, textAlign:'center' },
  sub:        { fontSize:13, color:'rgba(255,255,255,0.4)', textAlign:'center', lineHeight:20, marginBottom:18 },
  errorBox:   { width:'100%', maxHeight:100, backgroundColor:'rgba(239,68,68,0.07)', borderRadius:10, borderWidth:1, borderColor:'rgba(239,68,68,0.18)', marginBottom:22 },
  errorText:  { fontSize:11, color:'#fca5a5', fontFamily: Platform.OS==='ios'?'Courier New':'monospace', lineHeight:16 },
  btn:        { flexDirection:'row', alignItems:'center', backgroundColor:'#16a34a', paddingHorizontal:24, paddingVertical:13, borderRadius:14 },
  btnText:    { color:'white', fontWeight:'700', fontSize:14 },
});