# Kids Times Tables

Kids Times Tables is a small Expo app for multiplication practice. Choose a time limit, answer as many questions as you can, and review recent results saved on the device.

## Run the app

Use Node.js 20.19.4 or later and npm. From the repository root:

```bash
npm install
npx expo start
```

Open the QR code with Expo Go, or press `i` for the iOS simulator, `a` for Android, or use `npm run web` for a browser. This is a blank Expo project built in the starter repository; the existing class setup guide remains at `docs/README.md`.

## How to play

- Tap **Start quiz** to open the level picker. Easy gives you 5 minutes, Medium 3 minutes, and Hard 1 minute.
- Difficulty changes the session length only. Every level uses randomly selected factors from 1–12.
- The timer starts when you select a level. It uses an end timestamp, so elapsed time is accounted for after the app returns from the background.
- A correct answer advances immediately. An incorrect answer shows the correct product for three seconds, then advances. The timer continues during that feedback; the three seconds are the whole penalty.
- **Record answer** is the default way to answer: it opens the microphone and shows the listening layout. Say the answer, then tap **Stop recording** (recording also stops on its own after 10 seconds). The audio is transcribed by OpenRouter and the spoken number is submitted.
- If no clear number is heard, or transcription fails, the app asks you to try again. That never counts as a wrong answer.
- **Or type your answer** opens a dialog that accepts whole-number digits. Blank, negative, decimal, and nonnumeric entries show an error without affecting the score. Cancel does not count as an answer. If no OpenRouter key is configured, **Record answer** opens this dialog instead.
- Leaving before time expires abandons the round without saving it. At zero, results appear and the completed session is saved once.

## Saved scores

Completed sessions are stored locally with AsyncStorage. Each includes an ID, ISO 8601 completion time, difficulty, correct count, and incorrect count. The records screen sorts newest first and displays at most 10 sessions. If stored data is missing or malformed, the app shows an empty list rather than crashing. If saving fails, the result remains visible with a short message.

## Voice answers

The OpenRouter setup is cloned from the class Voice-To-Text demo:

- `src/services/stt/cloudStt.js` uploads the recording to OpenRouter's `/audio/transcriptions` endpoint (an unchanged copy of the demo file).
- `src/services/stt/openRouterConfig.js` reads the environment variables and adds a fixed transcription model, because this app has no model picker.
- `src/services/audio/recording.js` holds the demo's file-metadata and error-redaction helpers.
- `src/hooks/useVoiceAnswer.js` records 16 kHz mono WAV with `expo-audio`'s `useAudioStream` and returns the final transcript.
- `src/spokenNumber.js` turns the transcript into a whole number. It accepts digits ("72") and words ("seventy-two", "one hundred and forty-four"). It takes the last number spoken, so "nine times eight is seventy-two" gives 72.

The validated number is passed to the same `submitAnswer(answer)` in `App.js` that typed answers use, so scoring is not duplicated.

Copy `.env.example` to `.env` and fill it in:

```
EXPO_PUBLIC_OPENROUTER_API_KEY=sk-or-...
EXPO_PUBLIC_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
EXPO_PUBLIC_OPENROUTER_STT_MODEL=openai/whisper-large-v3-turbo
```

Restart `npx expo start` after editing `.env`. `EXPO_PUBLIC_*` values are embedded in the app bundle. That is acceptable for a classroom demo but not for production, where the key belongs on a backend.

`expo-audio` is a native module with microphone permissions set in `app.json`, so rebuild the native app after pulling these changes (`npx expo run:ios` or `npx expo run:android`).

## Checks and limitations

Run `npm run lint` for the Expo ESLint check. This starter had no existing test framework, so use this manual checklist:

1. Tap **Start quiz**, choose each level, and confirm the timer starts at 5:00, 3:00, or 1:00 respectively. Confirm each level uses factors from 1–12.
2. Submit a correct answer and confirm the correct count changes once and a new question appears.
3. Submit a wrong answer; confirm the label counts 3, 2, 1, the bar fills and is full at 1, then the next card appears after three seconds. Confirm submissions are unavailable and the timer keeps moving during feedback.
4. Say an answer and confirm it scores like a typed one. Say something without a number and confirm you are asked to try again without a wrong answer being counted. In the typed dialog, try blank input, letters, `42abc`, a decimal, and a negative number; none should count as wrong. Try a valid whole number with surrounding spaces.
5. Open the answer dialog and wait for the clock to expire; confirm it closes and results appear. Also check expiry during wrong-answer feedback.
6. Background and reopen the app during a quiz; confirm the remaining time reflects elapsed time.
7. Complete a quiz and confirm it appears at the top of records with difficulty and local date/time. Complete enough sessions to confirm only 10 are shown.
8. Leave a quiz early and confirm that it is not saved.

Voice answers need network access and an OpenRouter API key. Without one, the app falls back to typed answers. There is no backend, account, or cloud sync. Native simulator builds require the usual local Xcode or Android tooling; Expo Go can be used for a quick preview.
