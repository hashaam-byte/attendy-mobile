# Attendy Mobile — React Native / Expo App

> QR attendance management for Nigerian schools, on your phone.

---

## 🚀 Quick Setup

### 1. Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (Android or iOS)
- Your Supabase project already running (from the web schema)

### 2. Install dependencies
```bash
cd attendy-mobile
npm install
```

### 3. Configure Supabase
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Open `.env` and set:
```
EXPO_PUBLIC_SUPABASE_URL=https://eptgeumtcsiusxusxcos.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...your actual anon key...
```

Get these from: **Supabase Dashboard → Project → Settings → API**

### 4. Run the app
```bash
npx expo start
```

Then scan the QR code in terminal with **Expo Go** on your phone.

---

## 📱 How the App Works

### Login Flow (3 steps, matching the web)

```
App opens
    ↓
[Slug Entry Screen]
  → User types their School ID (e.g. "greenfield-academy")
  → App looks up the school in Supabase
  → If found & active → goes to Login
  → If parent → tap "Parent Portal" instead
    ↓
[Login Screen] (staff)
  → Email + Password login
  → Verifies the user belongs to THAT specific school slug
  → Role detected → correct interface shown
    ↓
[Role-specific Dashboard]
```

---

## 👥 User Roles & What They See

### 🔴 Admin
Full access. Bottom tab bar has 5 tabs:
- **Dashboard** — stats, recent scans, quick actions
- **Scanner** — QR gate scanner with entry/exit modes
- **Students** — full list, search, filter, add new
- **Reports** — today's log + 7-day bar chart + CSV export
- **Settings** — school info, notifications config, support links

From Dashboard they can also navigate to:
- Absent Today
- School Notices
- SMS Log
- Reports

### 🟡 Teacher
3-tab interface:
- **Dashboard** — stats + today's overview
- **Scanner** — can scan students in
- **Notices** — read school announcements
- **Settings** — profile + sign out

### 🟢 Gateman / Scanner
Minimal 2-tab interface — goes straight to scanner:
- **Scanner** — full QR scanner with entry/exit toggle
- **Settings** — sign out

### 🔵 Parent (no login required)
Completely separate flow — enter phone number only:
- **Parent Dashboard** — child's attendance calendar, stats, history
- Multiple children supported (switcher tabs at top)
- Shows today's status: On time / Late / Not scanned

---

## 📋 All Features

### Shared with Web Version

| Feature | Web | Mobile |
|---------|-----|--------|
| Slug-first login | ✅ | ✅ |
| Role-based access | ✅ | ✅ |
| QR gate scanner | ✅ (camera) | ✅ (camera) |
| Entry + Exit scan modes | ✅ | ✅ |
| Duplicate scan detection | ✅ | ✅ |
| Late detection (grace period) | ✅ | ✅ |
| Today's dashboard stats | ✅ | ✅ |
| Absent Today list | ✅ | ✅ |
| WhatsApp parent link | ✅ | ✅ |
| Excuse absent student | ✅ | ✅ |
| Student list + search | ✅ | ✅ |
| Class filter | ✅ | ✅ |
| Student profile + history | ✅ | ✅ |
| Register new student | ✅ | ✅ |
| Auto student ID generation | ✅ | ✅ |
| Attendance % per student | ✅ | ✅ |
| Suspend/reactivate student | ✅ | ✅ |
| 7-day attendance bar chart | ✅ | ✅ |
| CSV export | ✅ | ✅ (via Share) |
| School notices (read) | ✅ | ✅ |
| School notices (create/delete) | ✅ | ✅ (admin) |
| SMS / notification log | ✅ | ✅ |
| Parent phone login | ✅ | ✅ |
| Parent attendance dashboard | ✅ | ✅ |
| Settings display | ✅ | ✅ (read-only) |
| Sign out | ✅ | ✅ |
| Plan expiry detection | ✅ | ✅ |

### Mobile-Only / Enhanced Features

| Feature | Description |
|---------|-------------|
| **Haptic feedback** | Phone vibrates on scan — different patterns for success, late, duplicate, error |
| **Offline scan queueing** | Scans logged locally when offline, auto-sync when back online |
| **Pull-to-refresh** | Every screen supports swipe-down to refresh data |
| **Native camera integration** | Uses `expo-camera` with real-time QR barcode scanning |
| **Phone call parent** | Tap phone number → opens native dialler |
| **WhatsApp deep link** | Opens WhatsApp to exact parent conversation |
| **Share CSV** | Uses native share sheet (AirDrop, Drive, Email, etc.) |
| **Role-aware tab bar** | Tab bar changes based on role (Admin=5 tabs, Teacher=4, Gateman=2) |
| **Persistent login** | Session stored in AsyncStorage, stays logged in after closing app |
| **Entry/Exit toggle** | Large mode buttons, color changes (green=entry, purple=exit) |
| **Recent scans list** | Last 5 scans shown below camera in real time |
| **Scan counter** | Entry count ↑ and exit count ↓ shown in scanner header |

---

## 🗂 File Structure

```
attendy-mobile/
├── App.tsx                          # App entry (re-exports navigator)
├── index.ts                         # Expo root component registration
├── app.json                         # Expo config (icons, permissions, etc.)
├── .env.example                     # Template for environment variables
├── assets/
│   ├── icon.png                     # App icon (replace with real one)
│   ├── adaptive-icon.png            # Android adaptive icon
│   ├── splash-icon.png              # Splash screen
│   └── favicon.png                  # Web favicon
└── src/
    ├── context/
    │   └── AuthContext.tsx          # Global auth state, session management
    ├── lib/
    │   ├── supabase.ts              # Supabase client (uses AsyncStorage)
    │   ├── types.ts                 # TypeScript interfaces
    │   └── utils.ts                 # Date formatting, phone normalization
    ├── navigation/
    │   └── AppNavigator.tsx         # All routes + tab bars + role routing
    └── screens/
        ├── SlugEntryScreen.tsx      # Step 1: enter school ID
        ├── LoginScreen.tsx          # Step 2: staff email/password login
        ├── ParentLoginScreen.tsx    # Phone-number login for parents
        ├── ParentDashboardScreen.tsx# Parent's child attendance view
        ├── DashboardScreen.tsx      # Main dashboard (admin/teacher)
        ├── ScannerScreen.tsx        # QR camera scanner (all roles)
        ├── StudentsScreen.tsx       # Student list with search/filter
        ├── StudentProfileScreen.tsx # Individual student + history
        ├── RegisterStudentScreen.tsx# Add new student form
        ├── AbsentScreen.tsx         # Today's unscanned students
        ├── ReportsScreen.tsx        # Charts + logs + CSV export
        ├── NoticesScreen.tsx        # School announcements
        ├── NotificationsScreen.tsx  # SMS log
        └── SettingsScreen.tsx       # Profile, school info, support
```

---

## 🔧 Errors Fixed

### 1. `Unable to resolve asset "./assets/adaptive-icon.png"`
**Fix:** Created all 4 required asset files (`icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png`) in the `/assets/` folder. Replace these placeholder PNGs with your real school logo.

### 2. `AsyncStorageError: Native module is null`
**Fix:** The Supabase client now uses `@react-native-async-storage/async-storage` with the correct import and is passed as the `storage` option to `createClient()`. This replaces the default browser localStorage that doesn't exist in React Native.

### 3. `Unable to resolve host "your-project.supabase.co"`
**Fix:** The URL is now pulled from `EXPO_PUBLIC_SUPABASE_URL` environment variable. Copy `.env.example` to `.env` and set your real Supabase URL and anon key.

### 4. No slug entry before login
**Fix:** Added `SlugEntryScreen` as the first screen. Users must enter their school ID (slug), the app verifies it exists in Supabase, then proceeds to login for that specific school.

### 5. Staff-only login
**Fix:** Added a completely separate `ParentLoginScreen` with phone-number login (no email/password), and `ParentDashboardScreen` showing attendance. Parents are never mixed with staff login flows.

---

## 🛠 Building for Production

### Android APK
```bash
npx eas build --platform android --profile preview
```

### iOS (requires Apple Developer account)
```bash
npx eas build --platform ios --profile preview
```

### Install EAS CLI first:
```bash
npm install -g eas-cli
eas login
eas build:configure
```

---

## 📝 Replacing Placeholder Assets

The app currently uses 1×1 pixel placeholder PNGs. Replace them with real images:

1. **App Icon** (`assets/icon.png`) — 1024×1024px PNG
2. **Adaptive Icon** (`assets/adaptive-icon.png`) — 1024×1024px PNG (Android, content area only)
3. **Splash Screen** (`assets/splash-icon.png`) — 200×200px PNG (centered logo)
4. **Favicon** (`assets/favicon.png`) — 196×196px PNG (web only)

---

## 🌐 Relationship to Web App

The mobile app uses the **exact same Supabase database** as the web app. All data is shared in real-time:

- Students registered on mobile appear instantly on web
- Scans logged on mobile show in web reports
- Notices posted on web show in mobile
- SMS notifications work the same way
- Settings changed on web reflect in mobile (read-only on mobile)

The mobile app intentionally keeps settings **read-only** — full settings management (grace period, SMS toggles, staff management, plan upgrades) is done on the web dashboard for ease of use.

---

## 🇳🇬 Built for Nigerian Schools
