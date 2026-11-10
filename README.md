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
- **Record answer** currently opens a dialog that accepts whole-number digits. Blank, negative, decimal, and nonnumeric entries show an error without affecting the score. Cancel does not count as an answer.
- While that dialog is open, the quiz behind it shows the planned listening layout. Its waveform and **Stop recording** button are visual placeholders; no microphone is opened.
- Leaving before time expires abandons the round without saving it. At zero, results appear and the completed session is saved once.

## Saved scores

Completed sessions are stored locally with AsyncStorage. Each includes an ID, ISO 8601 completion time, difficulty, correct count, and incorrect count. The records screen sorts newest first and displays at most 10 sessions. If stored data is missing or malformed, the app shows an empty list rather than crashing. If saving fails, the result remains visible with a short message.

## Voice answer handoff

Microphone access, recording, transcription, and spoken-number parsing are not part of this implementation. The dialog validates the typed string in `src/quiz.js` and calls `submitAnswer(answer)` in `App.js`. That function checks the answer and owns the score, feedback, and question-advance behavior.

The voice feature can replace the dialog: when speech recognition returns a final transcript, convert a clear spoken number to a validated integer and call the same `submitAnswer(answer)` function. If the transcript is empty or unclear, prompt the player to try again and do not submit an answer. Keep transcript parsing and retry handling in the voice feature; do not duplicate quiz scoring there.

The professor’s example was inspected read-only. Its `package.json` shows an Expo / React Native app and includes `expo-audio` and `expo-speech-recognition`. In `src/hooks/useMicrophoneTranscription.js`, `stopAndTranscribe` awaits an STT adapter and places `response.transcript` on a successful result. In `src/services/stt/nativeStt.ios.js`, the speech result listener calls `onFinal({ transcript, ... })` for a nonempty final transcript. Those transcript-delivery points are the useful boundary for a future adapter. The example’s recording and transcription dependencies are not copied into this app.

## Checks and limitations

Run `npm run lint` for the Expo ESLint check. This starter had no existing test framework, so use this manual checklist:

1. Tap **Start quiz**, choose each level, and confirm the timer starts at 5:00, 3:00, or 1:00 respectively. Confirm each level uses factors from 1–12.
2. Submit a correct answer and confirm the correct count changes once and a new question appears.
3. Submit a wrong answer; confirm the label counts 3, 2, 1, the bar fills and is full at 1, then the next card appears after three seconds. Confirm submissions are unavailable and the timer keeps moving during feedback.
4. Try blank input, letters, `42abc`, a decimal, and a negative number; none should count as wrong. Try a valid whole number with surrounding spaces.
5. Open the answer dialog and wait for the clock to expire; confirm it closes and results appear. Also check expiry during wrong-answer feedback.
6. Background and reopen the app during a quiz; confirm the remaining time reflects elapsed time.
7. Complete a quiz and confirm it appears at the top of records with difficulty and local date/time. Complete enough sessions to confirm only 10 are shown.
8. Leave a quiz early and confirm that it is not saved.

There is no speech recognition, spoken-number parser, backend, account, or cloud sync. No environment variables are required. Native simulator builds require the usual local Xcode or Android tooling; Expo Go can be used for a quick preview.
