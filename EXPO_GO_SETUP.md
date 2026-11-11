# Running Dream Decoder in Expo Go

A setup guide for this project in **Expo Go**, written for two readers:

- **You, returning to it** — jump to [Daily startup](#daily-startup).
- **Someone else, starting from a fresh clone** — start at [First-time setup](#first-time-setup).

Expo Go is not the configuration the project brief recommends (it asks for a
development build). It is the fastest way to get the app onto a phone with no
Xcode, no Android Studio, and no EAS account, at the cost of the features listed
below. For the development-build route, see [API_SETUP.md](API_SETUP.md).

> **No secrets live in this file.** Every key and token below is a placeholder.
> Each person creates their own and keeps it only in their own untracked
> `.env` files.

---

## What works in Expo Go, and what does not

Expo Go is a pre-built app from the App Store / Play Store. It contains a fixed
set of native modules. Anything this project uses that Expo Go does not bundle
is simply unavailable at runtime — no rebuild can change that.

| Feature | Expo Go | Why |
|---|---|---|
| Typing a dream by hand | ✅ | No native module needed |
| Gallery, search, filter, detail, edit, delete | ✅ | `expo-sqlite` is bundled in Expo Go |
| Dream-cloud map, list view | ✅ | Pure layout |
| Moon phase | ✅ | Calculated on-device, no key, no network |
| Symbol catalog | ✅ | Bundled content |
| Copy text / share text | ✅ | `expo-clipboard`, `expo-sharing` |
| **Decode my dream** (AI analysis) | ✅ | Needs the backend reachable + OpenRouter credits |
| **Cloud transcription** (uploads audio) | ✅ | Needs the backend reachable + OpenRouter credits |
| **Phone-native transcription** | ❌ | `expo-speech-recognition` is not in Expo Go |
| **PNG card export / save to photos** | ⚠️ | `react-native-view-shot` is not part of Expo Go's bundled set; the app degrades to text export |

The app is built to degrade rather than crash: where a native module is missing
it says so and offers an alternative. So in Expo Go, **transcription means
cloud transcription or typing.**

---

## First-time setup

### 1. Prerequisites

- **Node 20.19.4 or newer** (`node --version`)
- **Expo Go matching this project's SDK.** The project is on **SDK 58**, which
  needs Expo Go **58.0.5 (Android)** or **58.0.7 (iOS)**. The store versions
  often lag; install the matching build from **https://expo.dev/go**. A
  mismatch shows up as `Cannot find native module '...'`.
- A phone and a computer that can reach each other on one network — see
  [Networking](#networking-the-part-that-breaks-most-often).

### 2. Install

```bash
npm install
cd server && npm install && cd ..
```

### 3. Create the two environment files

There are **two** env files with **two different secrets**. Mixing them up is
the single most common mistake, and one direction of the mistake publishes your
provider key.

```bash
cp .env.example .env              # the app (client)
cp server/.env.example server/.env  # the backend
```

```
┌─────────┐  EXPO_PUBLIC_API_AUTH_TOKEN  ┌──────────┐  OPENROUTER_API_KEY  ┌────────────┐
│  app    │ ───────────────────────────► │   your   │ ───────────────────► │ OpenRouter │
│ (phone) │         "let me in"          │ backend  │     "charge me"      │            │
└─────────┘                              └──────────┘                      └────────────┘
      ▲                                       ▲
   .env                                 server/.env
```

- **`EXPO_PUBLIC_API_AUTH_TOKEN`** — a door key to *your own* backend. It belongs
  in the client. If it leaks, you change one string in two files.
- **`OPENROUTER_API_KEY`** — a key to your *wallet*. Backend only. If it leaks,
  someone spends your credits and the only remedy is revoking it.

> **The rule:** anything named `EXPO_PUBLIC_*` is compiled into the app bundle
> as a literal string and is readable by anyone holding the app. A token to
> your own dev backend is fine there. **A provider key never is.**

#### `.env` (the app)

```ini
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:3000
EXPO_PUBLIC_API_AUTH_TOKEN=paste-the-same-token-as-API_AUTH_TOKEN
```

#### `server/.env` (the backend)

```ini
OPENROUTER_API_KEY=sk-or-v1-your-own-key-here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_ANALYSIS_MODEL=google/gemini-3.1-flash-lite
OPENROUTER_TRANSCRIPTION_MODEL=nvidia/nemotron-3.5-asr-streaming-multilingual-0.6b
OPENROUTER_ALLOWED_MODELS=google/gemini-3.1-flash-lite, nvidia/nemotron-3.5-asr-streaming-multilingual-0.6b
PORT=3000
HOST=0.0.0.0
API_AUTH_TOKEN=paste-the-same-token-as-EXPO_PUBLIC_API_AUTH_TOKEN
VERBOSE_LOGS=0
```

Generate your own access token (not a guessable string):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste that **same value** into `API_AUTH_TOKEN` and `EXPO_PUBLIC_API_AUTH_TOKEN`.
If they differ, every request returns `401` — fast, so it looks like a rejection
rather than a hang.

Both `.env` files are git-ignored. Confirm before you ever commit:

```bash
git check-ignore -v .env server/.env   # should print a .gitignore rule for each
git ls-files | grep -E '(^|/)\.env$'   # should print nothing
```

### 4. Get an OpenRouter key and credits

1. Sign in at OpenRouter and create a key dedicated to this project.
2. **Buy a small amount of credits.** This step is not optional for the AI
   features, and it is easy to get wrong:
   - A **key spend limit** caps what a key *may* spend. It does **not** add funds.
   - At a $0 balance, paid models return `402`.
   - `:free` model variants run on a pool **shared across all OpenRouter free
     users**. When that pool is busy you get `429` with
     `limit_source: "upstream_provider_shared_pool"`. There is no waiting period
     that makes it reliable — in testing, a free model answered one call and was
     throttled by the third. Fine for tinkering, not for a graded demo.
3. Paste the key into `server/.env` only.

**What it actually costs.** Measured on this project, one analysis plus one
transcription together came to **$0.000582** — under a tenth of a cent. The
minimum credit purchase will outlast the assignment many times over.

| Purpose | Model | Verified |
|---|---|---|
| Analysis | `google/gemini-3.1-flash-lite` | ✅ full schema honored, ~2.3s |
| Transcription | `nvidia/nemotron-3.5-asr-streaming-multilingual-0.6b` | ✅ word-perfect on 16 kHz mono WAV, ~1.8s |

Both were tested through this project's own routes, not just against OpenRouter
directly. Model IDs change — check the current catalog before assuming one still
exists, and keep `OPENROUTER_ALLOWED_MODELS` in sync when you switch.

---

## Networking: the part that breaks most often

Your phone must reach your computer. Three rules:

1. **Never use `localhost`.** On a phone, `localhost` is the phone.
2. **Use a private address.** iOS App Transport Security blocks plain HTTP to
   *public* addresses. Expo's generated config exempts private ranges only:
   `10.x`, `172.16–31.x`, `192.168.x`, `169.254.x`, `localhost`.
3. **University and corporate Wi-Fi usually will not work.** Campus networks
   hand your computer a *public* address and firewall inbound connections, so
   the phone's packets vanish silently and the app waits out its full timeout.

**The reliable fix: turn on your phone's hotspot and join the computer to it.**
That puts both devices on a private network with no firewall between them.

Then write the address into `.env`:

```bash
npm run set-ip                   # detect and write the current address
npm run set-ip -- 172.20.10.2    # or force a specific one
```

The script rewrites only the `EXPO_PUBLIC_API_BASE_URL` line, leaves your token
untouched, and **refuses to write a public address** unless you pass it
explicitly.

Verify from the computer before blaming the app:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://YOUR_LAN_IP:3000/api/health
# 200 = good.  000 = nothing listening or the network is blocking it.
```

---

## Daily startup

Two terminals.

**Terminal 1 — backend:**

```bash
cd server
npm run dev
```

It should print your configured models and `auth: bearer token required`. If you
changed `server/.env`, **restart it** — the file is read once at boot, and
`--watch` does not pick it up.

**Terminal 2 — the app:**

```bash
npm run set-ip     # whenever your network changed
npm run go         # expo start --go
```

Then scan the QR code **with the Expo Go app itself on Android**, or with the
**Camera app on iOS**.

> `npm start` is a *different* command — it runs `--dev-client` and emits a
> `dreamdecoder://` QR that Expo Go cannot open ("no app can use that QR code").
> For Expo Go, always use `npm run go`.

### Three Expo Go traps

**1. Only run one Metro server.** A second `expo start` takes port 8082 while
the first holds 8081, and you can end up scanning the wrong one. Check:

```bash
ps -axo pid,command | grep "expo start" | grep -v grep
```

**2. Do not trust Fast Refresh after editing a file imported by
`src/app/_layout.jsx`.** Expo Go 58.0.5 has a bug where any full reload loses
the native module registry, and the next native import throws
`Cannot find native module '...'` — usually `ExpoSQLite`, since that is the
first one the app touches. The cascade of *"Route … is missing the required
default export"* warnings is downstream of that single throw, not separate
problems. **Fully quit Expo Go and relaunch** (the red screen's own Reload
button also works). Tracked as
[expo/expo#52146](https://github.com/expo/expo/issues/52146).

**3. Match the Expo Go version to the SDK** (see
[Prerequisites](#1-prerequisites)).

---

## First-run check

Use a short, non-personal test dream:

> "I dreamed I was walking through a purple forest and found a glowing door."

1. App opens to the gallery with the labelled demo dreams.
2. Type that dream → **Decode my dream** → a card appears with a title, symbol,
   interpretation, and reflection question.
3. The card survives a full app restart.
4. Copy text produces readable output.
5. Cloud transcription, if you want to test it: switch the mode in Settings,
   record, and watch the backend terminal for the timing lines.

The backend logs sizes and durations, never dream text or audio:

```
[transcribe] request received, reading upload...
[transcribe] upload complete: 0.12 MB in 8 ms
[transcribe] calling model nvidia/nemotron-3.5-asr-...
[transcribe] model replied in 1766 ms (total 1774 ms)
```

---

## Troubleshooting

Every row below is an error actually hit while setting this up.

| What you see | Cause | Fix |
|---|---|---|
| `Cannot find native module 'ExpoSQLite'` (plus many "missing default export" warnings) | Expo Go 58.0.5 reload bug, **or** an Expo Go version that does not match SDK 58 | Fully quit and relaunch Expo Go; check the Expo Go version |
| `Cannot find native module 'ExpoSpeechRecognition'` | Expected in Expo Go — it is not bundled | Use cloud transcription or typing |
| "no app can use that QR code" | You ran `npm start` (dev-client mode) | Use `npm run go` |
| "The backend did not respond in time" | Phone cannot reach the computer: stale address, campus Wi-Fi, or backend not running | `npm run set-ip`, use a hotspot, confirm with `curl …/api/health` |
| `401` from your own backend | `API_AUTH_TOKEN` ≠ `EXPO_PUBLIC_API_AUTH_TOKEN` | Make them identical; restart both |
| `402` from OpenRouter | $0 balance; the model is paid | Buy credits (a spend *limit* is not funds) |
| `429`, `limit_source: upstream_provider_shared_pool` | A `:free` model's shared pool is busy | Switch to a cheap paid model |
| "Unsupported model" / model not found | The model ID no longer exists | Check the current OpenRouter catalog; update the model **and** the allowlist |
| "an audio file is required in the file field" | The upload reached the backend with no body | Confirm `formData` is passed to `apiRequest`; covered by `src/services/stt/__tests__/cloudStt.test.js` |
| App Transport Security error on iOS | Plain HTTP to a public address | Use a private address — hotspot or home Wi-Fi |
| `EADDRINUSE` on 3000 | A backend is already running | `lsof -nP -iTCP:3000 -sTCP:LISTEN` and stop the old one |

---

## Before sharing this project with anyone

- Share the **`.env.example`** files. Never share a filled-in `.env`.
- Each person creates their **own** OpenRouter key and their **own** access token.
- Check history for accidentally committed secrets before pushing.
- If a provider key is ever exposed — in a commit, a screenshot, a chat, a
  coding-agent prompt, or a client env file — **revoke it and issue a new one.**
  Deleting the file is not enough.
- Do not deploy this backend to a public URL without the bearer token and rate
  limits it already ships with. It spends real money on your account.

---

## Running the tests

No network access, no cost:

```bash
npm test                # app (jest-expo)
cd server && npm test   # backend (node:test)
npx eslint .
npx expo-doctor
```

See [VERIFICATION.md](VERIFICATION.md) for what is covered by tests versus what
still needs checking on real hardware.
