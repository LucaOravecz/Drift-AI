# Mobile App Scaffold — React Native

## Architecture

```
drift-ai-mobile/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── mfa.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Bottom tab navigator
│   │   ├── dashboard.tsx        # AUM, alerts, opportunities
│   │   ├── clients/
│   │   │   ├── index.tsx        # Client list
│   │   │   └── [id].tsx         # Client detail
│   │   ├── meetings.tsx         # Upcoming meetings + briefs
│   │   ├── compliance.tsx       # Flags & review queue
│   │   └── settings.tsx         # Profile, notifications
│   └── _layout.tsx
├── components/
│   ├── ClientCard.tsx
│   ├── OpportunityCard.tsx
│   ├── MeetingBrief.tsx
│   ├── AumChart.tsx
│   └── ComplianceBadge.tsx
├── lib/
│   ├── api.ts                   # API client (shared with web)
│   ├── auth.ts                  # Biometric + PIN auth
│   ├── push-notifications.ts    # APNs/FCM registration
│   └── offline.ts               # Offline-first with WatermelonDB
├── hooks/
│   ├── useClient.ts
│   ├── useOpportunities.ts
│   └── useRealtimeNotifications.ts
├── app.json
├── eas.json                     # Expo Application Services
├── package.json
└── tsconfig.json
```

## Key Features for Advisor Field Use

1. **Biometric Login** — Face ID / Touch ID + PIN fallback
2. **Offline-First** — Client data cached locally, syncs on reconnect
3. **Push Notifications** — New opportunities, compliance flags, meeting reminders
4. **Meeting Brief Access** — View AI-generated briefs before walking into a meeting
5. **Quick Actions** — Approve/draft communications, dismiss opportunities
6. **Client Search** — Instant search across all clients with recent interactions
7. **Document Capture** — Photo → OCR → document upload pipeline

## Tech Stack

| Component | Choice | Rationale |
|---|---|---|
| Framework | Expo SDK 50 + React Native | OTA updates, managed workflow |
| Navigation | Expo Router v3 | File-based routing, shared with web |
| State | TanStack Query | Shared cache with web, offline support |
| Auth | Expo SecureStore + LocalAuth | Biometric + encrypted token storage |
| Push | Expo Notifications | Unified APNs/FCM |
| Offline | WatermelonDB | SQLite-based, reactive, sync engine |
| Charts | Victory Native | Touch-interactive financial charts |

## API Integration

The mobile app shares the same REST API (`/api/v1/*`) as the web app and third-party integrations. Authentication uses the same session tokens with biometric-protected local storage.

```typescript
// lib/api.ts — shared between web and mobile
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://app.drift.ai";

export async function apiFetch(path: string, options?: RequestInit) {
  const token = await getStoredToken(); // From SecureStore
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}
```

## Push Notification Flow

```
Server Event → SSE → Push Service (APNs/FCM) → Device Notification
                                    ↓
                            App Open → Deep Link → Relevant Screen
```

## Deployment

- **iOS**: Expo EAS Build → TestFlight → App Store
- **Android**: Expo EAS Build → Internal Track → Play Store
- **OTA Updates**: Expo Update for JS bundle changes (no app store review needed)

## Getting Started

```bash
npx create-expo-app drift-ai-mobile --template tabs
cd drift-ai-mobile
# Install shared dependencies
npm install @tanstack/react-query expo-secure-store expo-local-authentication
npm install expo-notifications watermelondb @nozbe/watermelondb
npx expo start
```
