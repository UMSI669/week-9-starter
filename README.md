# Dream Journal

Dream Journal turns a spoken or typed dream into a saved journal entry. You can correct the transcript, choose a category, search and filter past dreams, edit an entry, or delete it with confirmation. After you save a dream, OpenRouter generates a short AI interpretation on its detail screen. The interpretation suggests possible themes; it is not a definite explanation of the dream.

Dreams and completed interpretations are stored locally with AsyncStorage. They remain after closing and reopening the app or browser, but they do not sync between devices or browsers. Saving a dream sends its text to OpenRouter for interpretation.

## Set up OpenRouter

Create a `.env` file in the app root, next to `package.json`:

```dotenv
EXPO_PUBLIC_OPENROUTER_API_KEY=your-openrouter-key
EXPO_PUBLIC_OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
```

Replace only the key placeholder with your own key. The model shown is the one currently used for this project; you can choose another OpenRouter chat model by changing the model line. If you omit that line, the code defaults to `openai/gpt-4o-mini`. Restart Expo after changing `.env`.

The `.env` file is ignored by Git. Keep the key out of commits and documentation. Because `EXPO_PUBLIC_` values are included in the browser/app bundle, this setup is suitable only for the class prototype. A deployed app would keep the key on a backend.

## Run in a browser

```bash
npm install
npm run web
```

Open the URL Expo prints, usually `http://localhost:8081`. Use a browser with Web Speech API support and allow microphone access. You can type a dream if speech recognition is unavailable. `npx expo run` selects a native build and can require CocoaPods; it is not needed for the browser.

For a mobile development build, use `npx expo run:ios` or `npx expo run:android`. The native speech module is not available in Expo Go.

## Use the app

1. On **Speak**, record or type a dream, edit the text, choose a category, and tap **Save dream**.
2. The app opens the saved entry. Its **AI interpretation** section shows a loading state and then the result. If the request fails, the dream remains saved and you can retry from that section.
3. Open **Journal** to search or filter entries. Tap a dream to edit its text or category, or delete it with confirmation. Changing the saved dream text requests a new interpretation.
4. Close and reopen the app or browser to see the saved dreams and completed interpretations.

## OpenRouter troubleshooting

- **Key rejected (401):** Check the key in `.env` and restart Expo if you changed it.
- **Key spending limit (403):** Raise that key's total limit in OpenRouter and check that the account can use the selected model. Selecting a free model may not override a key limit.
- **Credits or rate limit (402/429):** Check your OpenRouter account or try again later.

## Project files

- `src/screens/SpeakDreamScreen.js` and `src/hooks/useDreamDictation.js`: dream entry and speech recognition.
- `src/screens/DreamListScreen.js` and `src/screens/DreamDetailScreen.js`: journal browsing and editing.
- `src/hooks/useDreamJournal.js`: local storage.
- `src/services/interpretDream.js`: OpenRouter request and error handling.

The original course setup guide is in [`docs/README.md`](docs/README.md). Its Expo creation step is already complete for this repository.
