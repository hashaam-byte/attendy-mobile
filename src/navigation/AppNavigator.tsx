import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import SplashAnimation from '../components/SplashAnimation';
import * as Notifications from 'expo-notifications';
import { getNavigationFromNotification } from '../lib/notification';

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
import OpenWebScreen from '../screens/OpenWebScreen';

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
      {/* Notices, Notifications and Reports are intentionally NOT registered
          here — they live as top-level tabs in AdminTabs / TeacherTabs so
          the tab bar stays visible when the user navigates to them. Putting
          them in both a nested stack AND a tab causes React Navigation to
          pick the wrong instance and lose the tab bar. */}
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

import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Tab icons map ─────────────────────────────────────────────
const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Dashboard:     { active: 'grid',                inactive: 'grid-outline' },
  Scanner:       { active: 'qr-code',             inactive: 'qr-code-outline' },
  Students:      { active: 'people',              inactive: 'people-outline' },
  Reports:       { active: 'bar-chart',           inactive: 'bar-chart-outline' },
  Notices:       { active: 'megaphone',           inactive: 'megaphone-outline' },
  Notifications: { active: 'chatbubbles',         inactive: 'chatbubbles-outline' },
  Settings:      { active: 'settings',            inactive: 'settings-outline' },
  OpenWeb:       { active: 'globe',               inactive: 'globe-outline' },
  Absent:        { active: 'alert-circle',        inactive: 'alert-circle-outline' },
  Classes:       { active: 'book',                inactive: 'book-outline' },
};

// ── Custom floating tab bar ───────────────────────────────────
function FloatingTabBar({ state, descriptors, navigation, primaryColor }: any) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  // Only show max 5 tabs to keep it clean
  const visibleRoutes = state.routes.slice(0, 5);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom, 8) + 4,
        left: 16,
        right: 16,
        backgroundColor: theme.bgTabBar ?? theme.bgCard,
        borderRadius: 28,
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.4 : 0.12,
        shadowRadius: 24,
        elevation: 12,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      {visibleRoutes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const icons = TAB_ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.7}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 4,
            }}
          >
            {/* Active indicator pill behind icon */}
            {focused && (
              <View style={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: 6, right: 6,
                backgroundColor: `${primaryColor}18`,
                borderRadius: 18,
              }} />
            )}
            <Ionicons
              name={(focused ? icons.active : icons.inactive) as any}
              size={focused ? 22 : 20}
              color={focused ? primaryColor : theme.textMuted}
            />
            <Text style={{
              fontSize: 9,
              fontWeight: focused ? '700' : '500',
              color: focused ? primaryColor : theme.textMuted,
              marginTop: 3,
              letterSpacing: 0.2,
            }}>
              {typeof label === 'string' ? label : route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function tabScreenOptions(pc: string, theme: any) {
  return ({ route }: { route: RouteProp<ParamListBase, string> }) => ({
    headerShown: false,
    tabBarActiveTintColor: pc,
    tabBarInactiveTintColor: theme.textMuted,
    tabBarStyle: { display: 'none' }, // hide default, we use custom
  } as any);
}

function AdminTabs({ pc }: { pc: string }) {
  const { theme } = useTheme();
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Tab.Navigator
      screenOptions={tabScreenOptions(pc, theme)}
      tabBar={(props) => <FloatingTabBar {...props} primaryColor={pc} />}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Students" component={StudentsStack} />
      <Tab.Screen name="Reports" component={ReportsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Reports' }} />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Settings' }} />
    </Tab.Navigator>
  );
}

function TeacherTabs({ pc }: { pc: string }) {
  const { theme } = useTheme();
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Tab.Navigator
      screenOptions={tabScreenOptions(pc, theme)}
      tabBar={(props) => <FloatingTabBar {...props} primaryColor={pc} />}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Notices" component={NoticesScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Notices' }} />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Settings' }} />
    </Tab.Navigator>
  );
}

function GatemanTabs({ pc }: { pc: string }) {
  const { theme } = useTheme();
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Tab.Navigator
      screenOptions={tabScreenOptions(pc, theme)}
      tabBar={(props) => <FloatingTabBar {...props} primaryColor={pc} />}
    >
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

function ThemedNavigationContainer({ navigationRef }: { navigationRef?: React.RefObject<any> }) {
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
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function AppNavigator() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const navigationRef = React.useRef<any>(null);

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

  // Handle notification taps — navigate to the right screen
  useEffect(() => {
    // App was opened FROM a notification (killed state)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification?.request?.content?.data) {
        const target = getNavigationFromNotification(
          response.notification.request.content.data as Record<string, unknown>
        );
        if (target && navigationRef.current) {
          // Delay slightly to let navigator mount first
          setTimeout(() => {
            navigationRef.current?.navigate(target.screen, target.params);
          }, 500);
        }
      }
    });

    // App was in background/foreground when notification was tapped
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const target = getNavigationFromNotification(data);
      if (target && navigationRef.current) {
        navigationRef.current?.navigate(target.screen, target.params);
      }
    });

    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ThemedNavigationContainer navigationRef={navigationRef} />
          </AuthProvider>
          {showCustomSplash && (
            <SplashAnimation onFinish={() => setShowCustomSplash(false)} />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}