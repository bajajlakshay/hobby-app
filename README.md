# HobbyApp (mobile)

Expo / React Native client for HobbyApp — a notes and tasks app with
authentication. Users can write **notes** that mix typed text and handwriting on
one page, and keep **tasks** with done/remaining checklists. Backed by the
[HobbyApp backend](../hobby-app-backend) (.NET + PostgreSQL).

## Tech stack

- **Expo SDK 56** / **React Native 0.85** / **React 19.2**
- **expo-router** (file-based routing, typed routes)
- **TypeScript**
- `expo-secure-store` (token storage), `react-native-svg` (handwriting strokes)

> ⚠️ Expo SDK 56 moves fast — read the versioned docs at
> https://docs.expo.dev/versions/v56.0.0/ before changing native/config code
> (see `AGENTS.md`).

## Features

- **Auth** — email/password register & login with JWT access + refresh tokens.
  Tokens are stored securely (Keychain/Keystore on native, `localStorage` on web)
  and access tokens refresh automatically on expiry.
- **Notes** — a block-based "mixed canvas": add typed-text blocks and handwriting
  blocks (vector ink via `react-native-svg`) in the same note. Color labels,
  pin, archive, trash/restore, and search.
- **Tasks** — title + checklist items you can tick off, with a progress bar.

## Project structure

```
src/
├── app/                      # expo-router routes
│   ├── _layout.tsx           # SessionProvider + auth-guarded Stack
│   ├── (auth)/               # sign-in / sign-up (signed out)
│   └── (app)/                # signed-in area
│       ├── (tabs)/           # Notes + Tasks tabs
│       ├── note/[id].tsx     # note editor (mixed canvas)
│       └── task/[id].tsx     # task editor (checklist)
├── services/
│   ├── api/client.ts         # fetch wrapper + error handling
│   ├── auth/                 # SessionProvider, auth API, secure storage
│   ├── notes/                # notes API + types
│   └── tasks/                # tasks API + types
├── components/               # themed UI, drawing canvas, note card, ...
├── constants/                # theme, colors, API config
└── hooks/
```

Routing is guarded with `Stack.Protected`: the `(auth)` group shows when signed
out, the `(app)` group when signed in — switching happens automatically from the
session state.

## Prerequisites

- [Node.js](https://nodejs.org/) and npm
- The [HobbyApp backend](../hobby-app-backend) running and reachable
- Android Studio / Xcode for native builds (or a device with a dev build)

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Point the app at your backend (see Configuration below)
#    e.g. create a .env with EXPO_PUBLIC_API_URL

# 3. Start the dev server
npx expo start
```

Then open a [development build](https://docs.expo.dev/develop/development-builds/introduction/),
Android emulator, or iOS simulator. The custom app icon and splash require a
native build (`npx expo run:android` / `run:ios`) — they don't appear in Expo Go.

### Scripts

| Command | Description |
|---|---|
| `npm start` | Start the Metro dev server |
| `npm run android` | Build & run on Android |
| `npm run ios` | Build & run on iOS |
| `npm run web` | Run in the browser |
| `npm run lint` | Lint with Expo ESLint |

## Configuration

The backend base URL is resolved in `src/constants/config.ts`:

- Defaults to `http://10.0.2.2:5169` (Android emulator) / `http://localhost:5169`
  (iOS simulator & web).
- Override with the **`EXPO_PUBLIC_API_URL`** environment variable (inlined at
  build time). For a **physical device**, set your machine's LAN IP, e.g.:

  ```
  EXPO_PUBLIC_API_URL=http://192.168.1.x:5169
  ```

Use plain **HTTP** for local device development — the backend's dev HTTPS
certificate is `localhost`-only and untrusted on a phone.

## Notes on native builds

- This project includes a committed `android/` folder (app id `com.badmist.hobbyapp`).
- After changing `app.json` icon/splash/config, regenerate native assets with
  `npx expo prebuild -p android` and rebuild.
- Icons and splash screens are baked in at build time and won't update via Fast
  Refresh or in Expo Go.
