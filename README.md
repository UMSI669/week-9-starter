# Voice Expense

SI 669 Week 9 mobile prototype. Speak one expense in English, review the transcript and suggested fields, edit them, and save only after pressing **Save Expense**. Manual entry works when speech recognition is unavailable. The main screen shows the overall USD total, category filters and subtotals, and saved expenses with Delete and a five-second Undo.

## Run

```bash
npm install
npm start
```

For a quick voice-input demo without building a native app, run `npx expo start --web` and open the local page in a supported desktop browser such as Chrome or Safari. Allow microphone access when the browser asks. Browser speech recognition requires browser support and a secure context such as `localhost` or HTTPS; Firefox and some mobile browsers do not implement it. The browser's speech service may use network processing.

For microphone recognition, install a **development build** on an iOS or Android phone. This app uses `expo-speech-recognition@58.0.1`, which contains native code and is unavailable in Expo Go. Example cloud build commands:

```bash
npx eas-cli@latest build --profile development --platform ios
# or: npx eas-cli@latest build --profile development --platform android
```

An Expo account and the usual platform signing setup are needed for a cloud build. The `development` build profile is included in `eas.json`. Rebuild the native app after permission or plugin changes. On iOS the app asks for microphone and speech-recognition permission; on Android it asks for microphone permission. The device must have an available system speech service. The service may process audio remotely. The app does not save raw audio.

The project is linked to `@deoxc/voice-expense`. A local iPhone 18 Pro **simulator** development build compiled and installed successfully. To put the app on a physical iPhone, connect and trust the phone, then run `npx expo run:ios --device`, or run the EAS iOS build command above interactively and complete Apple signing and device registration. The non-interactive EAS build could not start because no suitable iOS internal-distribution credentials are configured. A simulator build cannot be installed on a physical iPhone.

Expo Go can still be used to review manual-entry UI if the installed native module fails gracefully, but voice input on iOS or Android requires the development build. The web version uses the browser's speech recognition implementation. A native physical-phone recording was not tested here.

## Behavior

- Parsing accepts whole or decimal numeric dollars (`12`, `$12`, `4.50`) and common English number words from zero through ninety-nine before “dollars.” It suggests Food, Transportation, Shopping, Entertainment, or Other from the specified keywords. A phrase after “on” or “for” becomes the description. Missing or multiple plausible amounts leave the amount blank for correction.
- Amount entry must be positive, finite, at most two decimal places, and within safe integer-cent range. The editable form requires a description. Cancel never saves. Recording results never save automatically.
- Expenses use `@react-native-async-storage/async-storage` under `voice-expense:v1`. Each record has an ID, integer cents, category, description, and timestamp. Invalid stored data blocks changes and is left untouched. A failed save leaves the draft in place.
- The All filter shows all expenses. A selected category shows only matching entries and a labeled subtotal; the overall total remains visible. Deleting updates both totals after storage succeeds. Undo restores the same record and its position. Only the latest deletion can be undone, for about five seconds. Undo is session-only; the deleted state persists.

## Class example adapted

The adjacent `Voice-To-Text` class project uses `expo-speech-recognition` with `requestPermissionsAsync`, `isRecognitionAvailable`, `result`/`error`/`end` listeners, and `start`/`stop`/`abort`. This app adapts that microphone flow and its `en-US` recognition settings. The same library also supplies a browser implementation. It does not copy the example’s Whisper, cloud transcription, audio-file, Redux, or logging features. Recognition callbacks are scoped to one session and cleaned up after completion or unmount.

### OpenRouter option from the professor's example

The class project at `../Voice-To-Text` has a separate cloud transcription path. Its `src/services/stt/cloudStt.js` records audio first, then sends the file and a selected `model` as multipart form data to OpenRouter's `/audio/transcriptions` endpoint. Its `src/services/stt/fetchOpenRouterModels.js` fetches currently available transcription models; `src/store/openRouterModelsSlice.js` prefers `qwen/qwen3-asr-0.6b` when that model is available. The example's **local** Whisper model (`ggml-tiny.en-q5_1.bin`) is a different path and does not use OpenRouter.

Voice Expense currently uses the phone or browser speech service, so it does not need an OpenRouter key or a paid AI model. OpenRouter could be added later if a browser lacks speech recognition or you need a particular transcription model. That would require recording audio with an Expo module, uploading it, and handling network errors and provider charges. The class demo reads `EXPO_PUBLIC_OPENROUTER_API_KEY` directly in the client and warns that this exposes the key in app bundles. Use a server-side key for any shared or published app. A local `.env` file is ignored by Git here, but that alone does not protect a key embedded in a build.

## Checks and remaining device work

Run `npm test`, `npx expo lint`, and `npx tsc --noEmit`. The parser tests use typed transcripts, not a microphone. Web bundling passed, and a browser UI check reached Listening and Stop without spoken audio. The iPhone simulator build compiled and installed, but its app window and microphone were not verified. On a physical development build, verify permission grant and denial, speech silence and errors, repeated Record/Stop taps, saving an edited transcript, restart persistence, filtering, and delete/Undo. Physical-phone voice recognition was **not run** in this workspace.

## Presentation demo

1. Record “I spent 12 dollars on lunch.”
2. Review the transcript, edit the fields, and save.
3. Add “I spent 8 dollars on parking.”
4. Show the overall total.
5. Filter by Food and show its subtotal.
6. Delete the lunch expense and tap Undo to restore it.
