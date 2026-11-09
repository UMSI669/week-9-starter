# Dream Journal

Dream Journal lets you speak a dream, review and correct the transcription, choose a category, and save it. The Journal screen lists saved dreams, supports text search and category filtering, and lets you open an entry to edit its text or category or delete it with confirmation.

Dreams are stored locally with AsyncStorage, so they remain after closing and reopening the app or browser. Browser entries stay in that browser's local storage. They are not synced between devices or backed up by this app. No account, cloud AI service, or API key is required.

## Run the app

```bash
npm install
npm run web
```

Open the local URL printed by Expo, usually `http://localhost:8081`. You can also use `npx expo start --web`. `npx expo run:ios` and `npx expo run:android` are for native builds, not the browser.

For web voice input, use a browser with Web Speech API support and allow microphone access. If speech recognition is unavailable, you can still type a dream. Mobile voice input requires a development build; Expo Go does not include the native speech module.

## Try it

1. On **Speak**, record a dream or type one. Edit the text and pick a category.
2. Tap **Save dream**. The app opens **Journal** with the saved entry.
3. Search for a word, filter by category, and tap an entry to read, edit, or delete it.
4. Close and reopen the app to confirm the saved entry is still in Journal.

## Project notes

- Speech capture is in `src/hooks/useDreamDictation.js` and `src/screens/SpeakDreamScreen.js`.
- Storage is in `src/hooks/useDreamJournal.js`.
- The journal list and detail screens are in `src/screens/`.
- The original course setup guide is in [`docs/README.md`](docs/README.md); its Expo creation step is already complete for this repository.
