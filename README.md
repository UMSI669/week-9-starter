# Dream Decoder

Speak a dream when you wake up, review the text, generate a gentle reflection,
and keep a glowing card in a starry gallery organised by dream themes.

A native iOS and Android app built with React Native, Expo development builds,
Expo Router, and OpenRouter (via this project's own backend).

> Dream Decoder offers **reflective possibilities**, not scientific,
> diagnostic, supernatural, or predictive conclusions.

---

## What works without any API key

Everything except AI analysis:

- Recording with your phone's own speech service, and editing the transcript
- Typing a dream by hand
- The gallery, search, category filtering, detail, edit, and delete
- The dream-cloud map and the list-view alternative
- The moon phase (calculated on the device; no key, no network, no location)
- The bundled symbol catalog
- Copy text, share text, PNG card capture, image share, and save to photos
- 16 labelled demo dreams, pre-loaded on first launch

AI analysis (`Decode my dream` and `Reinterpret`) needs an OpenRouter key on the
backend. See [API_SETUP.md](API_SETUP.md).

---

## Exact startup commands

### 1. Install

```bash
npm install
cd server && npm install && cd ..
```

Requires Node 20.19.4 or newer (`node --version`).

### 2. Configure

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Generate a shared access token for your backend:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put the same value in **both** files — `API_AUTH_TOKEN` in `server/.env` and
`EXPO_PUBLIC_API_AUTH_TOKEN` in `.env`. Then put your OpenRouter key and model
IDs in `server/.env` only, and your computer's LAN address in `.env`:

```bash
# macOS: find your LAN address
ipconfig getifaddr en0
```

```ini
# .env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.25:3000
```

That address is an example. A phone cannot reach your computer at `localhost`,
because `localhost` on a phone is the phone.

Full walkthrough, including model choice: [API_SETUP.md](API_SETUP.md).

### 3. Start the backend

```bash
cd server
npm run dev
```

It prints which models it has configured and refuses to start without
`API_AUTH_TOKEN`.

### 4. Build and install a development build

Expo Go will not work: native speech recognition, SQLite, view-shot, and the
media library all need a development build.

```bash
# iPhone (requires macOS, Xcode, and signing)
npx expo run:ios --device

# Android phone (requires Android build tools and USB debugging)
npx expo run:android --device
```

Or build in the cloud with EAS instead of locally:

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
```

### 5. Start the dev server

```bash
npx expo start --dev-client
```

Restart this after any change to `.env`. Rebuild the native client after adding
or changing a native library or a config plugin; plain JavaScript edits do not
need a rebuild.

---

## Checks

```bash
npm test             # 161 app tests (jest-expo), no network, no cost
npm run lint         # eslint via expo lint
npx expo-doctor      # 20 project health checks

cd server
npm test             # 46 backend tests, mocked OpenRouter, no cost
npm run test:paid    # OPT-IN. Really calls OpenRouter. Really costs money.
```

`npm run test:paid` is the only command in this repository that spends money.

---

## How it is put together

```
src/app/                     Expo Router screens
  (tabs)/index.jsx           Home: dream sky, cloud map, moon button
  (tabs)/capture.jsx         Record -> review -> decode -> save
  (tabs)/symbols.jsx         Symbols / Interpretations catalog
  gallery.jsx                Filterable, searchable gallery
  dream/[id].jsx             Detail and export
  dream/edit/[id].jsx        Edit, with draft protection and Reinterpret
  settings.jsx               Transcription mode and configuration status
src/components/              DreamCard, ExportCard, DreamCloudMap,
                             MoonPhaseButton, StarField, ui primitives
src/services/
  stt/                       Speech adapters (phone-native per platform, cloud)
  dreamRepository.js         The only writer of dream records (SQLite)
  db.js                      Connection and schema migrations
  dreamAnalysis.js           App -> this project's backend
  apiClient.js               Backend transport; holds no provider key
  exportDream.js             Clipboard, PNG capture, share, photo save
  moonPhase.js               Local lunar phase (truncated Meeus series)
  cloudMapLayout.js          Pure deterministic cloud-map layout
  visualSeed.js              Deterministic gradients and constellations
  seedDreams.js              16 labelled demo fixtures
src/data/                    categories.js, symbolCatalog.js
src/theme/                   Design tokens
shared/categories.json       Categories, read by BOTH app and backend
server/                      Express backend that holds the OpenRouter key
```

### Architecture notes

**The key never ships in the app.** `Mobile app -> project backend -> OpenRouter`.
Every `EXPO_PUBLIC_*` value is compiled into the distributed bundle, so the app
holds only a backend URL and a backend access token. A test
(`src/services/__tests__/noClientSecrets.test.js`) fails the build if a provider
secret is ever introduced into client configuration.

**SQLite is the source of truth; Redux is a cache.** Every mutation writes to
SQLite first and then updates the store with what SQLite returned, which is why
a restart shows exactly what was saved.

**Cards are deterministic.** A dream's `visualSeed` is created once and
persisted. Gradient, accent, and constellation are pure functions of that seed
plus the theme and mood tags. No image service is involved.

**The cloud map is a pure function.** `layoutCloudMap()` takes measured
dimensions and returns positions. Sizing is bounded and sublinear (square root
of the share of the largest count), equal counts break alphabetically, and
collisions are detected so touch targets stay separate. Nothing is random, so
nothing jumps between renders.

---

## Honest limits

- **Phone transcription is not offline transcription.** It uses the operating
  system's speech service, which may process audio on the device or on its own
  servers depending on the device and its language packs. The app cannot tell
  which, so it never claims offline.
- **Cloud transcription uploads your audio.** It is a separate mode you select
  on purpose, with a standing notice. When phone transcription fails, the app
  offers typing — it never silently uploads instead.
- **Dreams are stored locally and plainly.** Local SQLite, in the app's own
  storage. Not encrypted by this app, not backed up by this app, not synced.
  Deleting the app deletes the dreams. Audio is not retained.
- **The moon phase is approximate.** Accurate to a small fraction of a day
  (verified against eclipse timestamps), which is far from observatory
  precision.
- **The symbol catalog is editorial.** Reflection prompts, not research. No
  citations, because inventing them would be dishonest.
- **Opening a share sheet is not delivery.** The app reports that the sheet
  opened, never that anyone received anything.
- **The backend's access token is a development gate, not user
  authentication.** It is in the app bundle. A public deployment needs real
  per-user auth; the rate limiter is also in-memory and therefore per-process.

See [VERIFICATION.md](VERIFICATION.md) for exactly what has been tested and what
has not.

---

## Documents

| File | What it covers |
|---|---|
| [AGENTS.md](AGENTS.md) | The implementation brief this app was built to |
| [API_SETUP.md](API_SETUP.md) | OpenRouter key, model choice, backend, device setup |
| [USERS.md](USERS.md) | The original API and device setup notes |
| [VERIFICATION.md](VERIFICATION.md) | Tested behaviour vs. untested assumptions |
| [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md) | Reused code and its licence |

---

## Reference repository

Speech adapter boundaries, the microphone lock, the multipart upload shape, and
the error-sanitizing helper are adapted from the class reference repository,
[UMSI669/Voice-To-Text](https://github.com/UMSI669/Voice-To-Text) (MIT). Its
Expo SDK 58 / React Native 0.88 versions and its JavaScript/JSX conventions are
preserved here. Licence notices are in
[LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md).
