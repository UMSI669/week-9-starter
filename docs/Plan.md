## Locked decisions

- **Tabs:** Home, Lists, mic button, More (Notes dropped).
- **Home:** one mixed list with a small "voice" badge on voice-added items.
- **Voice screen:** waveform and timer while recording, then the transcript and parsed items appear after you tap stop. There is no Ask AI button.
- **Notices:** in-app toasts and banners only. No system notifications, so no notification permission is needed.
- **Categories:** Produce, Dairy, Pantry, Meat, Bakery, Frozen, Household, Other.
- **Units:** pcs, bag, gal, oz, lb, tub, pack, loaf, or none.
- **Icons:** the parser returns one emoji per item, with a category fallback.
- **Item order:** preserve category and insertion order. Manual reordering was removed at user request.
- **Week:** Sunday to Saturday, device timezone, `weekId` = the Sunday's local date.
- **Two separate API keys are required:** `EXPO_PUBLIC_OPENROUTER_API_KEY` for Whisper transcription through OpenRouter, and `EXPO_PUBLIC_UMGPT_API_KEY` for transcript-to-JSON parsing through U-M GPT Toolkit. Store both in `.env` via `EXPO_PUBLIC_*` for this personal prototype. Anyone with the app binary can extract them; production apps must keep keys on a backend.
- **Transcript to JSON:** use a separate U-M GPT Toolkit API key to format the Whisper transcript into structured grocery-item JSON. OpenRouter handles transcription; U-M GPT Toolkit handles parsing.

## Pages (7)

1. **Home:** search, category chips, grid/list toggle, items, quick-add bar.
2. **Lists:** grouped by category, with the "X of Y done" progress bar.
3. **Voice:** one screen with idle, recording, transcribing, parsing, reviewing and error states.
4. **Add/Edit item:** name, category, quantity stepper, unit chips, recent items.
5. **Week History.**
6. **Past Week Detail:** read-only, with "copy unchecked to this week."
7. **More/Settings:** History link, mic permission status, clear data.

## Environment and structure

```
EXPO_PUBLIC_OPENROUTER_API_KEY=
EXPO_PUBLIC_TRANSCRIPTION_MODEL=openai/whisper-large-v3-turbo
EXPO_PUBLIC_UMGPT_API_KEY=
EXPO_PUBLIC_UMGPT_BASE_URL=https://api.toolkit.umgpt.umich.edu/v1
EXPO_PUBLIC_PARSER_MODEL=gpt-6-luna

app/            routes (tabs, voice modal, item modal, history)
features/       list, voice, history
services/       db/, openrouter/, umgpt/
store/          slices + RTK Query APIs
utils/          week.ts, normalize.ts, parser fallback
theme/          navy / orange / peach tokens
```

The two keys authenticate separate services; the Whisper key does not replace the U-M GPT Toolkit key. `.env.example` includes placeholders for both.

When in doubt: check /home/phon1209/works/UMSI_CS/MobileDev/Integration/Voice-To-Text for reference for voice to text

## Data

```
weeks(id TEXT PK 'YYYY-MM-DD', created_at, rolled_over_at)
items(id, week_id, name, name_key, quantity INT>=1, unit TEXT NOT NULL DEFAULT '',
      category, emoji, checked, position, source, carried_over,
      created_at, updated_at)
UNIQUE(week_id, name_key, unit)
settings(key, value)
```

I store "no unit" as an empty string, not NULL, because SQLite treats NULLs as distinct in unique indexes and the merge rule would silently fail.

## Core behaviors

- **Merge:** the same `name_key` and same unit within a week adds quantities and shows a toast ("Milk already on your list, now 2"). Different units create separate rows.
- **Rollover:** runs on app open and on foreground, inside one transaction, and is idempotent via `rolled_over_at`. Unchecked items are copied into the new week with `carried_over = 1`, and a dismissible banner says "N items carried over."
- **Delete:** swipe to delete with a short undo toast. The voice review rows can be deleted before saving.
- **Check-off:** never changes position. Manual reordering is disabled.
- **Web formatting:** send transcripts to the same-origin `/api/format` server route. The server calls Toolkit because its API rejects browser preflight requests. Hosted web requires Expo server output with API routes enabled.

## Voice pipeline

1. Tap mic, then record. A timer shows, the warning comes at 50 seconds, and it auto-stops at 60.
2. Tap stop and call `transcribeAudio` through OpenRouter's `/audio/transcriptions` endpoint using multipart form data with `file` and `model`. The recording check passed with `openai/whisper-large-v3-turbo` and `Grocery List.m4a` in 1.5 seconds.
3. Call `parseGroceries` through U-M GPT Toolkit’s OpenAI-compatible `/v1/responses` endpoint (`https://api.toolkit.umgpt.umich.edu/v1`) with the transcript, using `EXPO_PUBLIC_UMGPT_API_KEY` and `EXPO_PUBLIC_PARSER_MODEL`. Request Structured Outputs with a strict JSON Schema for `{items: [{name, quantity, unit, category, emoji, quantityInferred}]}`. The prompt enforces English, singular names, the category and unit enums, "dozen" = 12, "couple" = 2, and a missing quantity = 1 with `quantityInferred: true`. Validate the returned JSON before showing the review screen; handle refusals and incomplete responses as parsing failures.
4. The review screen has an editable transcript with a **Re-parse** button (no re-upload), plus editable rows (name, stepper, category, delete). Rows with an inferred quantity get the "quantity not heard" tag from your mock.
5. Save runs `addOrMergeItems` in one transaction and then shows the merge toasts.

**Failure handling:**

- If the transcription call fails, the audio file is kept and a retry button is shown.
- If the parse call fails, the rule-based fallback fills in names and quantities and sets category to Other.
- If the transcript is empty, an error state is shown.
- If mic permission is denied, an explanation is shown with a link to settings.

**API references:** [OpenAI API authentication](https://developers.openai.com/api/reference/overview) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). The parser needs a U-M GPT Toolkit API key, separate from the OpenRouter key used for Whisper. Toolkit model discovery and a live strict-schema response both passed with `gpt-6-luna`.

## Task breakdown

**Phase 0, setup and spikes**

- [x] Scaffold Expo Router with TypeScript and a theme file
- [x] Android launch through Expo Go (`npm run android`); physical-phone and emulator setup documented in `README.md`
- [x] Check `Grocery List.m4a` through OpenRouter Whisper (`scripts/check-whisper.mjs`): nonempty transcript returned
- [x] Spike: record 10 seconds, send it to the transcription endpoint, and compare m4a with 16 kHz mono WAV
- [x] Configure the U-M GPT Toolkit API key and select `gpt-6-luna` (verified through `/v1/models`)
- [x] Spike: send the verified grocery transcript through the U-M GPT Toolkit parser and validate the grocery JSON schema

**Phase 1, data layer**

- [x] `getWeekId` with tests (Saturday 23:59 vs Sunday 00:00, the Nov 1 DST change, year rollover)
- [x] SQLite schema and migrations
- [x] Repository functions and `listApi` (RTK Query with `queryFn`, tag invalidation)
- [x] Merge and normalize utilities with tests

**Phase 2, manual list UI**

- [x] Home list and grid views, with the toggle persisted in `settings`
- [x] Category chips and search
- [x] Lists screen with the progress bar
- [x] Add/Edit modal, delete with undo

**Phase 3, rollover**

- [x] Foreground rollover check
- [x] Carried-over badge and banner
- [x] Toast component for merges

**Phase 4, voice**

- [x] Recorder hook and permissions
- [x] `voiceApi` (OpenRouter Whisper transcription)
- [x] `voiceApi` (Toolkit transcript-to-JSON parsing with Structured Outputs and validation)
- [x] Voice state machine in the `voice` slice
- [x] Review UI, retry and fallback parser
- [x] Save and merge

**Phase 5, history**

- [x] History list with completion summaries
- [x] Past Week Detail with "copy unchecked"

**Phase 6, polish and testing**

- [x] Unit tests (week logic, parser fixtures, merge, rollover idempotency)
- [x] Screen/component tests in Chromium (10 browser tests, including the real Expo API route and mock provider responses)
- [x] Browser simulations: permission denied, backgrounding mid-recording, offline mode, recording limits, Sunday rollover
- [ ] Physical-device acceptance: microphone, haptics, touch gestures, airplane mode, and clock changes (see `docs/device-checks.md`)
- [x] Haptics and accessibility labels/states
- [x] EAS development, preview APK, and production build profiles
- Signed EAS native build: skipped at the user's request; physical testing will use Expo Go.

**Verification:** 23 unit tests and 10 browser tests pass, including offline navigation and browser runtime-error checks. Reordering and its related tests were removed at user request. Final Android and web server exports compile. Live Whisper checks passed for M4A and 16 kHz mono WAV; Toolkit returned validated grocery JSON with `gpt-6-luna`, including through the running web `/api/format` endpoint. See `docs/api-spikes.md` for results.

**Remaining release checks:** the user will run physical-device acceptance in Expo Go; the cloud build is skipped. The API format and weekly rollover risks are covered by live provider checks and automated tests; review remains required for parser accuracy.
