# API_SETUP.md — OpenRouter, the backend, and device builds

## What actually needs a key

| Feature | Needs an OpenRouter key? |
|---|---|
| Typing a dream by hand | No |
| Phone-native transcription | No |
| Gallery, search, edit, delete | No |
| Dream-cloud map, moon phase | No |
| Symbol catalog | No |
| Text copy/share, PNG export, save to photos | No |
| **Decode my dream / Reinterpret** | **Yes** |
| **Cloud (uploaded audio) transcription** | **Yes**, plus a transcription model |

Your classroom Codex key is not your OpenRouter key.

---

## The key architecture, and why

```
Mobile app  ──►  this project's backend  ──►  OpenRouter
  (backend URL +      (OPENROUTER_API_KEY         (chat/completions,
   access token)       in server/.env only)        audio/transcriptions)
```

Every `EXPO_PUBLIC_*` value is compiled into the app bundle. Anyone with the
app can read it. A provider key there is a published key, so this project keeps
it on the backend and nowhere else.

The class reference repository has a direct-from-client key option for
demonstrations. That is not what this app does.

---

## 1. Create an OpenRouter key

1. Open the official OpenRouter website and sign in.
2. Open its API key settings.
3. Create a key dedicated to Dream Decoder.
4. Set a spending limit if the interface offers one.
5. Review your credits and the current prices of the models you plan to use.
6. Paste the key into `server/.env` and nowhere else.

Never put it in a coding-agent prompt, a chat, an issue, a screenshot, a commit,
or any `EXPO_PUBLIC_*` variable. If a key is ever exposed, revoke it and create
a new one — deleting the file is not enough, because git history keeps it.

---

## 2. Choose two models, independently

These are separate choices. **No model is assumed to do both.**

**Analysis model** — must accept text, and should support structured JSON
outputs. Check the current OpenRouter catalog for the exact ID; do not copy an
ID from an example, including this one, without confirming it still exists.

If your analysis model cannot do structured outputs, you have two options, and
the server will tell you which error you hit:

```ini
# server/.env — ask for JSON in the prompt instead of via a strict schema.
# The server validates every field either way.
OPENROUTER_STRUCTURED_OUTPUTS=off
```

**Transcription model** — only needed for cloud transcription. Must support
transcription output and accept the audio this app records (16 kHz mono WAV).
Leave `OPENROUTER_TRANSCRIPTION_MODEL` empty to keep cloud transcription
switched off; phone transcription and typing are unaffected.

---

## 3. Configure the backend

```bash
cp server/.env.example server/.env
```

Then fill in `server/.env`:

```ini
OPENROUTER_API_KEY=            # your key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_ANALYSIS_MODEL=     # exact ID from the current catalog
OPENROUTER_TRANSCRIPTION_MODEL= # leave empty for phone-only transcription
OPENROUTER_STRUCTURED_OUTPUTS= # "off" if your model lacks schema support
OPENROUTER_ALLOWED_MODELS=     # optional extra IDs a client may request
PORT=3000
HOST=0.0.0.0
API_AUTH_TOKEN=                # required; see below
```

Generate the access token:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The server **refuses to start** without `API_AUTH_TOKEN`, because it binds to
the local network so a phone can reach it. This is a development-grade access
gate, not per-user authentication.

`server/.env` is git-ignored. Only the blank `server/.env.example` is committed.

Start it:

```bash
cd server
npm install
npm run dev
```

It prints its configuration status on boot and never prints the key.

### The routes it serves

These are **this project's** routes, not OpenRouter's:

| Route | Purpose |
|---|---|
| `GET /api/health` | Configuration status. No secrets. Used by Settings. |
| `POST /api/dreams/analyze` | Reviewed transcript → validated card fields |
| `POST /api/transcribe` | Audio upload → text (only when a transcription model is set) |

It forwards to `https://openrouter.ai/api/v1/chat/completions` and
`.../audio/transcriptions`, with a Bearer key supplied by the server.

### What it does to protect you

- Bearer-token gate on both AI routes, compared in constant time
- Rate limits: 20 analyses and 10 transcriptions per 10 minutes per client
- Bounded timeouts: 45s analysis, 90s transcription
- **No automatic retries.** Both calls are billable; a retry is your decision
- Model allowlist — a client cannot name an arbitrary model, so this cannot
  become an open OpenRouter proxy
- Request size limits: 32 KB JSON, 6000 transcript characters, 20 MB audio,
  185 seconds of audio, audio MIME allowlist
- Strict server-side validation of every generated field, even when a strict
  schema was sent. Malformed output is rejected, never patched up
- Every outbound message and log line is scrubbed of anything key-shaped
- Full dream text and audio are never logged. Lengths and timings only

---

## 4. Configure the Expo app

```bash
cp .env.example .env
```

```ini
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.25:3000
EXPO_PUBLIC_API_AUTH_TOKEN=     # same value as API_AUTH_TOKEN in server/.env
```

Find your computer's LAN address:

```bash
ipconfig getifaddr en0      # macOS Wi-Fi
ipconfig                    # Windows, look for IPv4 Address
```

`192.168.1.25` is an illustration, not your address.

A physical phone **cannot** reach your computer at `localhost` — on the phone,
`localhost` is the phone. The app detects this and says so rather than hanging.

For development:

- Phone and computer on the same reachable network
- The backend bound to a network-accessible interface (`HOST=0.0.0.0`)
- Your computer's firewall allowing the port
- Prefer an authenticated HTTPS endpoint where you can. Plain local HTTP may
  need development-only platform configuration, and you should not weaken
  release network security settings to make local HTTP work

Restart the dev server after editing `.env`:

```bash
npx expo start --dev-client
```

For a deployed backend, replace the URL with its HTTPS URL — and implement real
authentication and rate limiting before exposing a paid AI endpoint publicly.
The in-memory rate limiter in this repository is per-process and is not
sufficient for a multi-instance deployment.

---

## 5. Build the native clients

A development build is required. Expo Go does not include the native modules
this app uses (speech recognition, SQLite, view-shot, media library).

```bash
npm install
npx expo-doctor

npx expo run:ios --device       # needs macOS, Xcode, signing
npx expo run:android --device   # needs Android build tools, USB debugging

npx expo start --dev-client
```

EAS cloud builds are an alternative to compiling locally:

```bash
npx eas-cli@latest build --profile development --platform ios
```

Rebuild the native client after adding or changing a native library or a config
plugin. Ordinary JavaScript edits do not need a rebuild.

---

## 6. First-run verification

Use a short, non-personal test dream:

> "I dreamed I was walking through a purple forest and found a glowing door."

1. Recording produces editable text.
2. "Decode my dream" sends the reviewed text to your backend.
3. The backend returns validated card fields.
4. The card saves, and survives force-quitting and reopening the app.
5. Editing works with the keyboard open.
6. "Copy text" pastes correctly elsewhere.
7. The PNG export is readable and unclipped.
8. Cloud transcription, if enabled, works as its own separate mode.

Cloud analysis and transcription cost money. Use one small explicit test rather
than repeated automatic requests.

---

## Troubleshooting

**"This app has no backend URL yet"**
`EXPO_PUBLIC_API_BASE_URL` or `EXPO_PUBLIC_API_AUTH_TOKEN` is missing, or the
URL still contains the `YOUR_COMPUTER_LAN_IP` placeholder. Fix `.env` and
restart the dev server. Check Settings → AI backend for exactly what is missing.

**401 unauthorized from your own backend**
`EXPO_PUBLIC_API_AUTH_TOKEN` does not match `API_AUTH_TOKEN`. They must be
identical. Restart both processes after changing either.

**"The backend's OpenRouter credentials were rejected"**
A 401/403 from OpenRouter. Check `OPENROUTER_API_KEY` in `server/.env`. Do not
print the key while debugging.

**"OpenRouter reported a credit or billing problem"**
A 402. Review your account credits and spending settings.

**"OpenRouter does not recognize that model ID"**
A 404. Verify the exact ID against the current catalog.

**"That model does not support structured JSON outputs"**
Either pick a model that does, or set `OPENROUTER_STRUCTURED_OUTPUTS=off`. The
server validates every field either way.

**"The model did not return usable JSON"**
The model replied with something that is not a valid card. Nothing was saved and
your transcript is intact — you can try again, or save the transcript on its
own. The server does not retry automatically, because the call is billable.

**Phone cannot reach the backend**
Do not use `localhost` on a device. Check network reachability, `HOST=0.0.0.0`,
and your firewall.

**"Native module unavailable" / the app crashes on launch**
You are on Expo Go, or the build predates a native dependency change. Install a
development build and rebuild.

**Android speech unavailable**
Check Settings → Phone speech service. It reports availability, permission, and
the installed Android speech services. Many devices report recognition as
available while having no usable service; some need a language pack. Typed entry
always remains available.

**Microphone permission denied**
The app says so and keeps typed entry available. Re-enable it in system settings
for Dream Decoder.

**Photo save denied**
The image is reported as *not saved*, and sharing stays available. The app never
claims a save that did not happen.

---

## Before sharing this app with anyone

- [ ] No provider key in any client configuration (`npm test` enforces this)
- [ ] `git log -p -- .env server/.env` shows nothing — no key was ever committed
- [ ] Any exposed key revoked, not just deleted
- [ ] The backend is authenticated, rate-limited, and served over HTTPS
- [ ] Routine tests stay mocked, so they cost nothing
- [ ] The app's description of what is sent where is accurate
- [ ] No claim of offline transcription, encryption, backup, or sync
