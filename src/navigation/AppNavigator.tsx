import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, ActivityIndicator, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import SplashAnimation from '../components/SplashAnimation';
import { getNavigationFromNotification } from '../lib/notification';

import SlugEntryScreen      from '../screens/SlugEntryScreen';
import LoginScreen          from '../screens/LoginScreen';
import ParentLoginScreen    from '../screens/ParentLoginScreen';
import ParentDashboardScreen from '../screens/ParentDashboardScreen';
import DashboardScreen      from '../screens/DashboardScreen';
import ScannerScreen        from '../screens/ScannerScreen';
import StudentsScreen       from '../screens/StudentsScreen';
import StudentProfileScreen from '../screens/StudentProfileScreen';
import RegisterStudentScreen from '../screens/RegisterStudentScreen';
import AbsentScreen         from '../screens/AbsentScreen';
import ReportsScreen        from '../screens/ReportsScreen';
import NoticesScreen        from '../screens/NoticesScreen';
import NotificationsScreen  from '../screens/NotificationsScreen';
import SettingsScreen       from '../screens/SettingsScreen';
import OpenWebScreen        from '../screens/OpenWebScreen';

import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { RouteProp, ParamListBase } from '@react-navigation/native';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Header options hook ────────────────────────────────────────
function useHeaderOpts(): NativeStackNavigationOptions {
  const { theme } = useTheme();
  return {
    headerStyle:        { backgroundColor: theme.bgHeader ?? theme.bgCard },
    headerTintColor:    theme.text,
    headerTitleStyle:   { fontWeight: '700' as TextStyle['fontWeight'], fontSize: 16, color: theme.text } as TextStyle,
    headerShadowVisible: false,
  } as NativeStackNavigationOptions;
}

// ── Tab icons map ─────────────────────────────────────────────
const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Dashboard:     { active: 'home',          inactive: 'home-outline'          },
  Scanner:       { active: 'qr-code',       inactive: 'qr-code-outline'       },
  Students:      { active: 'people',        inactive: 'people-outline'        },
  Reports:       { active: 'bar-chart',     inactive: 'bar-chart-outline'     },
  Notices:       { active: 'megaphone',     inactive: 'megaphone-outline'     },
  Notifications: { active: 'chatbubbles',   inactive: 'chatbubbles-outline'   },
  Settings:      { active: 'settings',      inactive: 'settings-outline'      },
  More:          { active: 'apps',          inactive: 'apps-outline'          },
  OpenWeb:       { active: 'globe',         inactive: 'globe-outline'         },
};

// ── Floating Tab Bar ──────────────────────────────────────────
function FloatingTabBar({ state, descriptors, navigation, primaryColor }: any) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View style={{
      position:        'absolute',
      bottom:          Math.max(insets.bottom, 8) + 4,
      left:            16,
      right:           16,
      backgroundColor: theme.bgCard,
      borderRadius:    28,
      flexDirection:   'row',
      paddingVertical: 10,
      paddingHorizontal: 6,
      shadowColor:     '#000',
      shadowOffset:    { width: 0, height: 8 },
      shadowOpacity:   0.15,
      shadowRadius:    24,
      elevation:       14,
      borderWidth:     1,
      borderColor:     theme.border,
    }}>
      {state.routes.slice(0, 5).map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const icons = TAB_ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
        const label = options.tabBarLabel ?? options.title ?? route.name;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            activeOpacity={0.7}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
          >
            {focused && (
              <View style={{
                position: 'absolute', top: 0, bottom: 0, left: 4, right: 4,
                backgroundColor: `${primaryColor}18`, borderRadius: 18,
              }} />
            )}
            <Ionicons
              name={(focused ? icons.active : icons.inactive) as any}
              size={focused ? 22 : 20}
              color={focused ? primaryColor : theme.textMuted}
            />
            <Text style={{
              fontSize:   9,
              marginTop:  3,
              letterSpacing: 0.2,
              fontWeight: focused ? '700' : '500',
              color:      focused ? primaryColor : theme.textMuted,
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
  return (_: { route: RouteProp<ParamListBase, string> }) => ({
    headerShown:            false,
    tabBarActiveTintColor:  pc,
    tabBarInactiveTintColor: theme.textMuted,
    tabBarStyle:            { display: 'none' },
  } as any);
}

// ── Stack: Dashboard ──────────────────────────────────────────
function DashboardStack() {
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="Absent"        component={AbsentScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Absent Today' }} />
    </Stack.Navigator>
  );
}

// ── Stack: Students ───────────────────────────────────────────
function StudentsStack() {
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StudentsList"    component={StudentsScreen} />
      <Stack.Screen name="StudentProfile"  component={StudentProfileScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Student Profile' }} />
      <Stack.Screen name="RegisterStudent" component={RegisterStudentScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Register Student' }} />
    </Stack.Navigator>
  );
}

// ── More menu page ────────────────────────────────────────────
function MoreMenu({ navigation, primaryColor, theme }: { navigation: any; primaryColor: string; theme: any }) {
  const MORE_ITEMS = [
    { screen: 'Notices',       icon: 'megaphone-outline',   label: 'School Notices',   sub: 'Announcements from your school' },
    { screen: 'Notifications', icon: 'chatbubbles-outline', label: 'SMS Log',          sub: 'Parent notification history'    },
    { screen: 'Reports',       icon: 'bar-chart-outline',   label: 'Reports',          sub: 'Attendance analytics'           },
    { screen: 'OpenWeb',       icon: 'globe-outline',       label: 'Web Dashboard',    sub: 'Open full dashboard in browser' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>More</Text>
        <Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>All available features</Text>
      </View>
      {MORE_ITEMS.map((item, i) => (
        <TouchableOpacity
          key={item.screen}
          onPress={() => navigation.navigate(item.screen)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 14,
            paddingHorizontal: 20, paddingVertical: 16,
            borderBottomWidth: 1, borderBottomColor: theme.border,
          }}
        >
          <View style={{
            width: 46, height: 46, borderRadius: 23,
            backgroundColor: `${primaryColor}15`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={item.icon as any} size={22} color={primaryColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{item.label}</Text>
            <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>{item.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Tabs: Admin (5 visible + More page for rest) ───────────────
function AdminTabs({ pc }: { pc: string }) {
  const { theme } = useTheme();
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Tab.Navigator
      screenOptions={tabScreenOptions(pc, theme)}
      tabBar={(props) => <FloatingTabBar {...props} primaryColor={pc} />}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Scanner"   component={ScannerScreen}  options={{ headerShown: false }} />
      <Tab.Screen name="Students"  component={StudentsStack} />
      <Tab.Screen
        name="More"
        options={{ tabBarLabel: 'More', headerShown: true, title: 'More', ...(HEADER_OPTS as any) }}
      >
        {({ navigation }: any) => <MoreMenu navigation={navigation} primaryColor={pc} theme={theme} />}
      </Tab.Screen>
      <Tab.Screen name="Settings"  component={SettingsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Settings' }} />
    </Tab.Navigator>
  );
}

// AdminRoot = AdminTabs + screens reachable from More menu
function AdminRoot({ pc }: { pc: string }) {
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs"     options={{ headerShown: false }}>
        {() => <AdminTabs pc={pc} />}
      </Stack.Screen>
      <Stack.Screen name="Notices"       component={NoticesScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'School Notices' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'SMS Log' }} />
      <Stack.Screen name="Reports"       component={ReportsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Reports' }} />
      <Stack.Screen name="OpenWeb"       component={OpenWebScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Web Dashboard' }} />
    </Stack.Navigator>
  );
}

// ── Tabs: Teacher ─────────────────────────────────────────────
function TeacherTabs({ pc }: { pc: string }) {
  const { theme } = useTheme();
  const HEADER_OPTS = useHeaderOpts();
  return (
    <Tab.Navigator
      screenOptions={tabScreenOptions(pc, theme)}
      tabBar={(props) => <FloatingTabBar {...props} primaryColor={pc} />}
    >
      <Tab.Screen name="Dashboard"     component={DashboardStack} />
      <Tab.Screen name="Scanner"       component={ScannerScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Notices"       component={NoticesScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Notices' }} />
      <Tab.Screen name="Settings"      component={SettingsScreen}
        options={{ ...(HEADER_OPTS as any), headerShown: true, title: 'Settings' }} />
    </Tab.Navigator>
  );
}

// ── Tabs: Gateman ─────────────────────────────────────────────
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

// ── Route decision ────────────────────────────────────────────
function AuthenticatedApp() {
  const { authState } = useAuth();
  const role = authState?.role ?? 'viewer';
  const pc   = authState?.primaryColor ?? '#16a34a';
  if (role === 'gateman' || role === 'scanner') return <GatemanTabs pc={pc} />;
  if (role === 'teacher' || role === 'hr')       return <TeacherTabs pc={pc} />;
  return <AdminRoot pc={pc} />;
}

// ── Root navigator ────────────────────────────────────────────
function RootNavigator() {
  const { authState, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.text} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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

// ── Themed navigation container ───────────────────────────────
function ThemedNavigationContainer({ navigationRef }: { navigationRef?: React.RefObject<any> }) {
  const { theme, isDark } = useTheme();
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background:   theme.bg,
      card:         theme.bgCard,
      text:         theme.text,
      border:       theme.border,
      primary:      '#16a34a',
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

// ── App root ──────────────────────────────────────────────────
export default function AppNavigator() {
  const [fontsLoaded,      setFontsLoaded]      = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const navigationRef = React.useRef<any>(null);

  // Load fonts
  useEffect(() => {
    Font.loadAsync({ ...Ionicons.font })
      .catch(console.warn)
      .finally(() => setFontsLoaded(true));
  }, []);

  // Hide native splash once fonts are ready
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Handle push notification taps
  useEffect(() => {
    // Tapped from killed state
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response?.notification?.request?.content?.data) return;
      const target = getNavigationFromNotification(
        response.notification.request.content.data as Record<string, unknown>
      );
      if (target && navigationRef.current) {
        setTimeout(() => navigationRef.current?.navigate(target.screen, target.params), 500);
      }
    });

    // Tapped from background / foreground
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data   = response.notification.request.content.data as Record<string, unknown>;
      const target = getNavigationFromNotification(data);
      if (target && navigationRef.current) {
        navigationRef.current?.navigate(target.screen, target.params);
      }
    });

    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

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