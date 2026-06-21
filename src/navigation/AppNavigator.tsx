import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, Platform, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import SplashAnimation from '../components/SplashAnimation';

import SlugEntryScreen from '../screens/SlugEntryScreen';
import LoginScreen from '../screens/LoginScreen';
import ParentLoginScreen from '../screens/ParentLoginScreen';
import ParentDashboardScreen from '../screens/ParentDashboardScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ScannerScreen from '../screens/ScannerScreen';
import StudentsScreen from '../screens/StudentsScreen';
import StudentProfileScreen from '../screens/StudentProfileScreen';
import RegisterStudentScreen from '../screens/RegisterStudentScreen';
import AbsentScreen from '../screens/AbsentScreen';
import ReportsScreen from '../screens/ReportsScreen';
import NoticesScreen from '../screens/NoticesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const MAP: Record<string, [string, string]> = {
    Dashboard:     ['home', 'home-outline'],
    Scanner:       ['qr-code', 'qr-code-outline'],
    Students:      ['people', 'people-outline'],
    Reports:       ['bar-chart', 'bar-chart-outline'],
    Notices:       ['megaphone', 'megaphone-outline'],
    Notifications: ['chatbubble', 'chatbubble-outline'],
    Settings:      ['settings', 'settings-outline'],
  };
  const [a, i] = MAP[name] ?? (['ellipse', 'ellipse-outline'] as [string, string]);
  return <Ionicons name={(focused ? a : i) as any} size={22} color={color} />;
}

import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { RouteProp, ParamListBase } from '@react-navigation/native';

function useHeaderOpts(): NativeStackNavigationOptions {
  const { theme } = useTheme();
  return {
    headerStyle: { backgroundColor: theme.bgHeader },
    headerTintColor: theme.text,
    headerTitleStyle: { fontWeight: '700' as TextStyle['fontWeight'], fontSize: 16, color: theme.text } as TextStyle,
    headerShadowVisible: false,
  } as NativeStackNavigationOptions;
}

function DashboardStack() {
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="Absent" component={AbsentScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Absent Today' }} />
      <Stack.Screen name="Notices" component={NoticesScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'School Notices' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'SMS Log' }} />
      <Stack.Screen name="Reports" component={ReportsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Reports' }} />
      <Stack.Screen name="Students" component={StudentsStack} />
    </Stack.Navigator>
  );
}

function StudentsStack() {
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StudentsList" component={StudentsScreen} />
        <Stack.Screen name="StudentProfile" component={StudentProfileScreen}
          options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Student Profile' }} />
        <Stack.Screen name="RegisterStudent" component={RegisterStudentScreen}
          options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Register Student' }} />
    </Stack.Navigator>
  );
}

function tabScreenOptions(pc: string, theme: any) {
  return ({ route }: { route: RouteProp<ParamListBase, string> }) => ({
    headerShown: false,
    tabBarStyle: {
      backgroundColor: theme.bgTabBar,
      borderTopColor: theme.border,
      borderTopWidth: 1,
      paddingBottom: Platform.OS === 'ios' ? 20 : 6,
      paddingTop: 6,
      height: Platform.OS === 'ios' ? 84 : 62,
    },
    tabBarActiveTintColor: pc,
    tabBarInactiveTintColor: theme.textMuted,
    tabBarLabelStyle: { fontSize: 10, fontWeight: '600' as TextStyle['fontWeight'] } as TextStyle,
    tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => <TabIcon name={(route as any).name} focused={focused} color={color} />,
  } as any);
}

function AdminTabs({ pc }: { pc: string }) {
  const { theme } = useTheme();
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(pc, theme)}>
      <Tab.Screen name="Dashboard"     component={DashboardStack} />
      <Tab.Screen name="Scanner"       component={ScannerScreen}  options={{ headerShown: false }} />
      <Tab.Screen name="Students"      component={StudentsStack} />
        <Tab.Screen name="Reports"       component={ReportsScreen}
          options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Reports' }} />
        <Tab.Screen name="Settings"      component={SettingsScreen}
          options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Settings' }} />
    </Tab.Navigator>
  );
}

function TeacherTabs({ pc }: { pc: string }) {
  const { theme } = useTheme();
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(pc, theme)}>
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Scanner"   component={ScannerScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Notices"   component={NoticesScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Notices' }} />
      <Tab.Screen name="Settings"  component={SettingsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Settings' }} />
    </Tab.Navigator>
  );
}

function GatemanTabs({ pc }: { pc: string }) {
  const { theme } = useTheme();
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Tab.Navigator screenOptions={({ route }: { route: RouteProp<ParamListBase, string> }) => ({
      ...tabScreenOptions(pc, theme)({ route }),
      tabBarStyle: { ...tabScreenOptions(pc, theme)({ route }).tabBarStyle, backgroundColor: theme.bg },
    })}>
      <Tab.Screen name="Scanner"  component={ScannerScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Settings' }} />
    </Tab.Navigator>
  );
}

function AuthenticatedApp() {
  const { authState } = useAuth();
  const role = authState?.role ?? 'viewer';
  const pc   = authState?.primaryColor ?? '#16a34a';
  if (role === 'gateman' || role === 'scanner') return <GatemanTabs pc={pc} />;
  if (role === 'teacher' || role === 'hr')       return <TeacherTabs pc={pc} />;
  return <AdminTabs pc={pc} />;
}

function RootNavigator() {
  const { authState, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {authState ? (
        <Stack.Screen name="App" component={AuthenticatedApp} />
      ) : (
        <Stack.Group>
          <Stack.Screen name="SlugEntry"       component={SlugEntryScreen} />
          <Stack.Screen name="Login"           component={LoginScreen} />
          <Stack.Screen name="ParentLogin"     component={ParentLoginScreen} />
          <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

function ThemedNavigationContainer() {
  const { theme, isDark } = useTheme();
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.bg,
      card: theme.bgCard,
      text: theme.text,
      border: theme.border,
      primary: '#16a34a',
      notification: '#16a34a',
    },
  };
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function AppNavigator() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  useEffect(() => {
    async function loadResources() {
      try {
        await Font.loadAsync({ ...Ionicons.font });
      } catch (e) {
        console.warn('Font loading error:', e);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadResources();
  }, []);

  // Hide the native static splash the instant fonts are ready — our animated
  // component (rendered below, on top of the app) takes over from here.
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedNavigationContainer />
        </AuthProvider>
        {showCustomSplash && (
          <SplashAnimation onFinish={() => setShowCustomSplash(false)} />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}