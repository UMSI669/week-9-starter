# Pantry Week

An Expo Router grocery-list app with local SQLite storage, voice entry, and weekly history.

## Run

Use Node.js 22.13 or newer (the repository tests use Node's SQLite module).

```sh
npm install
npm start
```

Open the app in an Expo Go version matching **SDK 58**, or use a development build.
For the browser, run `npm run web`. Web formatting calls the same-origin
`/api/format` route, which authenticates with U-M GPT Toolkit from the server.
Toolkit rejects browser preflights, so direct browser formatting requests fail.
The web export uses Expo's `server` output and needs a host that runs its API
routes; serving only static files will not enable web formatting.
SQLite on web requires the cross-origin headers configured in `metro.config.js`;
when hosting a web export, set
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: credentialless` on the host too.

### Android

For an Android emulator or a phone connected by USB:

```sh
npm run android
```

This starts Expo and opens the app in **Expo Go**. An emulator needs Android
Studio with an Android Virtual Device running. A USB-connected phone needs
USB debugging enabled and Android SDK platform tools (`adb`) installed.

For a physical Android phone without USB setup, install Expo Go matching SDK 58,
connect your phone and computer to the same network, run `npm start`, and scan
the QR code from Expo Go. If the network prevents connecting, use:

```sh
npm start -- --tunnel
```

Android is configured with package `com.pantryweek.app` and microphone permission.
The start commands explicitly select Expo Go, even though the project also
contains the optional development-client package.

## API configuration

Copy `.env.example` to `.env` and fill in both keys locally:

```dotenv
EXPO_PUBLIC_OPENROUTER_API_KEY=your-whisper-key
EXPO_PUBLIC_TRANSCRIPTION_MODEL=openai/whisper-large-v3-turbo
EXPO_PUBLIC_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
EXPO_PUBLIC_UMGPT_API_KEY=your-toolkit-key
EXPO_PUBLIC_UMGPT_BASE_URL=https://api.toolkit.umgpt.umich.edu/v1
EXPO_PUBLIC_PARSER_MODEL=gpt-6-luna
```

The OpenRouter key transcribes audio. The U-M GPT Toolkit key formats the
transcript into strict-schema grocery JSON using the gateway's Responses API.
Both integrations were verified with the supplied grocery recording/transcript.
Restart Expo after changing `.env`.

The web API route uses `UMGPT_API_KEY` on the server when set, otherwise it uses
the existing `EXPO_PUBLIC_UMGPT_API_KEY`. Set that server environment variable
when deploying the web server. Android continues using its public Toolkit key.

As agreed in the prototype plan, public Expo environment variables embed the
keys in the app. Keep `.env` out of Git. A production app needs a backend for
provider credentials.

## Use

- **Home:** search/filter items, toggle list/grid, add a quick item, check it off,
  or open it to edit details.
- **Lists:** see category groups and completion counts. Items keep their order
  when checked off; manual reordering is disabled.
- **Delete:** swipe left, then tap Delete. Grid cards also have a delete button.
  The toast offers Undo for seven seconds.
- **Speak:** record up to 60 seconds; the app warns at 50 seconds. Stop to
  transcribe and parse. Review names, quantities, categories, and units before
  saving. Re-parse an edited transcript without uploading audio again.
- **More:** check microphone access, view past weeks, or confirm clearing data.
  Past weeks are read-only and can copy unchecked items to this week.

Identical normalized names and units merge by adding quantities. Weeks start
on Sunday in the device timezone. Unchecked items carry over once when a new
week is opened or the app returns to the foreground. A timer also checks for
rollover while the app stays open. Manual lists work offline.

On mobile, lists use a standard scroll view with swipe-to-delete rows.

If transcription fails, the recording remains available for retry. If formatting
fails, editable recovered items are shown with an explicit review notice. Leaving
the app stops the microphone. Discarding or saving removes the temporary recording.

## Validate

```sh
npm run typecheck
npm run lint
npm test
npm run export
```

The tests cover DST and year boundaries, SQLite transactions, duplicate merges,
concurrent saves, rollover idempotency, undo, history copying, parser validation,
and API failures. The export compiles Android, iOS, and web bundles.

For browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts an isolated Expo web server on port 8091. It uses a fake microphone and
mock provider replies, so browser tests do not spend API credits.

For live API checks (each makes one provider request):

```sh
npm run check:whisper
npm run check:parser
node scripts/check-whisper.mjs "path/to/recording.wav"
npm run check:parser -- "Two gallons of milk and a loaf of bread."
```

## Native builds

For this run, physical testing will use Expo Go and the signed cloud build is
skipped at the user's request. The profiles below are ready for a future build.

`eas.json` defines development, internal preview, and production profiles.
Expo account login and an EAS project are required to create signed native builds:

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile preview --platform android
```

The development profile uses a development client; the Android preview profile
produces an APK. iOS device builds additionally need Apple signing credentials.
Physical-device acceptance checks are in [docs/device-checks.md](docs/device-checks.md).
The implementation and verification status are tracked in [docs/Plan.md](docs/Plan.md).
