# Verification checklist

This file separates **what was actually tested** from **what was written
carefully but not yet run on hardware**. Nothing below is called "verified on
device" unless it was run on a device.

No physical iPhone or Android phone was connected during this build, so **every
device-dependent item is untested**. The commands to test them are given.

---

## Verified by automated tests

264 tests, all passing, no network access and no cost.

```bash
npm test                # 218 tests (jest-expo)
cd server && npm test   # 46 tests (node:test)
```

### AI output validation — `server/src/validateAnalysis.test.js`, `src/services/__tests__/dreamSchema.test.js`

| Verified | Detail |
|---|---|
| The documented example response validates | Exactly the shape in AGENTS.md |
| Unknown categories are rejected | `Nightmares`, `school and work`, `''`, numbers, objects, arrays |
| All 8 categories accepted by key or by label | Case-insensitive on labels; whitespace trimmed, never guessed |
| Every length limit enforced at the boundary | title 60, summary 240, interpretation 500, question 160 |
| Themes 1–5, moods 1–3 | Empty rejected; over-long capped, not rejected; tags lowercased and de-duplicated; over-long individual tags dropped |
| `symbol` requires key, label, and one display emoji | Accepts ZWJ sequences and variation selectors; refuses text, `:)`, emoji runs |
| Symbol keys are slugified | `Being Chased` → `being-chased` |
| Malformed output is rejected, never repaired | Non-objects, `null`, strings, arrays — all rejected without throwing |
| All errors reported at once | Not just the first |
| JSON extracted from bare, fenced, and prose-wrapped responses | Garbage is a rejection, not an invention |
| The schema sent to the model lists exactly the shared categories | Enum matches `shared/categories.json`; `strict: true`; `additionalProperties: false` |

### Backend routes — `server/src/app.test.js` (OpenRouter stubbed)

| Verified | Detail |
|---|---|
| Both AI routes require a bearer token | Missing and wrong tokens → 401, and the upstream is never called |
| `/api/health` never leaks the key or the token | Asserted against the serialized response |
| Transcript validation precedes the model call | Empty, blank, non-string → 400; over-limit → 413; upstream call count is 0 |
| Model allowlist enforced | A model outside it → 400, upstream never called |
| Audio validation precedes the model call | Missing file → 400; under 1 KB → 400; wrong MIME → 415; over 185s → 413 |
| Multipart upload parsed with the boundary fetch sets | Content-Type is never set by hand |
| Rate limiting works | 20 analyses allowed, the 21st → 429 with `Retry-After` |
| **No automatic retry of a billable call** | Exactly one upstream attempt per request, asserted |
| Errors are sanitized | Keys, bearer headers, and internal IPs never reach the client |
| Unknown routes → JSON 404 | Including `/api/v1/chat/completions` |

### Secrets cannot enter the client — `src/services/__tests__/noClientSecrets.test.js`

| Verified | Detail |
|---|---|
| `.env.example` declares only a backend URL and a backend token | And never mentions an OpenRouter variable |
| Both example files contain placeholders only | No real values |
| `.gitignore` ignores every `.env` and keeps the example tracked | App and server |
| No source file reads an OpenRouter key from the client environment | Whole `src/` tree scanned |
| No key-shaped literal anywhere in `src/` | |
| The app never calls `openrouter.ai` directly | It calls its own backend routes |
| `app.json` contains no secrets | |

### Lunar phase — `src/services/__tests__/moonPhase.test.js`

Checked against published eclipse timestamps, which are new and full moons by
definition, plus Meeus's worked example.

| Reference | Result |
|---|---|
| 2000-01-06 18:14 UTC (Meeus example) | New Moon, illumination < 0.0005 |
| 2017-08-21 18:26 UTC (total solar eclipse) | New Moon |
| 2023-10-14 17:59 UTC (annular solar eclipse) | New Moon |
| 2024-04-08 18:17 UTC (total solar eclipse) | New Moon |
| 2000-01-21 04:44 UTC (total lunar eclipse) | Full Moon, illumination > 0.9995 |
| 2019-01-21 05:12 UTC (total lunar eclipse) | Full Moon |
| 2025-03-14 06:58 UTC (total lunar eclipse) | Full Moon |
| 2025-09-07 18:11 UTC (total lunar eclipse) | Full Moon |

Every reference lands **within 0.5° of elongation** (measured: within 0.06°).
Also verified: waxing/waning direction across a full cycle, all eight phases
appearing in the correct order over one synodic month, ~half illumination at the
quarters, correct wrap at 0°/360°, the exact accessibility label wording, J2000
and Unix epoch Julian-day conversions, rejection of non-time inputs, and that
the date key changes at local midnight.

### Cloud-map layout — `src/services/__tests__/cloudMapLayout.test.js`

| Verified | Detail |
|---|---|
| Biggest category first; equal counts break alphabetically | Stable regardless of input order; input not mutated |
| Sizing bounded and sublinear | 100× the dreams gives under 2.5× the type size; square-root growth confirmed exactly; monotonic; always within [min, max] |
| Chips always meet the 48pt touch target | In both axes, at any font size |
| Chips grow with label length and device text scale | |
| Every populated category is placed | Guaranteed by a grid fallback when the spiral cannot find a slot |
| Placement is deterministic | Identical inputs give byte-identical positions |
| No node overlaps another, with a 10pt gap | Including at `fontScale: 1.8` |
| Dream stars never cover a category control | They are dropped instead when there is no room |
| Counts update correctly | Gaining a dream re-ranks; losing the last one removes the cloud |
| Edge cases | One category; all-equal counts; zero dreams; missing measurements; 24 categories in a 300×200 box with no font below the readable minimum |

A real defect was found and fixed here: long labels at the maximum font size
produced near-full-width chips, which pushed the seventh category into
overflow. Font size is now also fitted to a width budget, and a deterministic
grid scan backs up the spiral search.

### Persistence and migrations — `src/services/__tests__/dreamRepository.test.js`

Run against **real SQLite** (Node's `node:sqlite`), not a hand-written fake.

| Verified | Detail |
|---|---|
| Schema is created and the version recorded | `PRAGMA user_version` |
| Migrations are idempotent and lose no data | Re-running changes nothing |
| An already-applied migration never re-runs | |
| Both tables exist | `dreams`, `app_settings` |
| Every field round-trips | Including arrays stored as JSON and emoji |
| Id, UTC dates, time zone, and visual seed come from app code | Never from AI output |
| Data survives a simulated restart | Connection dropped and reopened |
| An unknown category falls back to `other` | |
| Edits update only what changed | |
| `createdAt`, `visualSeed`, and `originalTranscript` survive edits | Even when an edit explicitly tries to overwrite them |
| `updatedAt` moves forward | |
| Newest-first ordering | |
| Category filtering, including an invalid filter being ignored | |
| Search across title, transcript, themes, moods | Case-insensitive |
| Counts by category, including zeros | |
| Delete returns the record so Undo can restore it exactly | Same id, dates, and seed |
| Counts update immediately after a delete | |
| Demo dreams are all marked as demo and removable without touching real dreams | |
| An edit cannot flip a real dream into a demo | |
| Demo data populates at least 5 categories with a real size hierarchy | |
| Settings read back, overwrite, and survive a restart | |
| A storage failure surfaces a readable, recoverable error | Verified by dropping the table |

### Demo seeding and live counts — `src/store/__tests__/dreamsSlice.test.js`

Store-level, over real SQLite, so this is the path a fresh install actually takes.

| Verified | Detail |
|---|---|
| First launch populates an empty database | 16 demo dreams, so the gallery is never blank |
| The cloud map gets a real size hierarchy | 7 populated categories, a clear largest, at least one equal-count pair to exercise the alphabetical tie-breaker, and one deliberately empty category |
| Counts match the fixtures exactly | Adventure 4, Relationships 3, School & Work 3, Nature & Animals 2, Flying & Falling 2, Mystery 1, Everyday Life 1, Other 0 |
| Every demo dream is marked as demo, with an honest model field | `analysisModel` says "not AI output" |
| Every demo dream is a complete, in-limit card | Title, summary, interpretation, question, tags, emoji, seed — all within the documented field limits |
| Demo interpretations use tentative language only | Must contain "could reflect" / "might connect"; must not contain "this means", "symbolizes", "represents", "will happen", "predicts", "proves", "diagnos-" |
| Seeding never runs twice | And never adds demos to a database that already holds real dreams |
| Removing the demos is permanent | They do not return on the next launch |
| They can be re-added deliberately from Settings | |
| Seeded data survives a restart | |
| Newest-first ordering, counts across all 8 categories | Totals to 16 |
| Category filtering and search over title, transcript, and tags | |
| Counts update immediately after every mutation | Creating a dream, changing a category (one cloud down, another up), deleting, and Undo restoring the record with its original id, date, and seed |

### Speech failure messages — `src/services/__tests__/speechErrors.test.js`

Found on a real device run: the iOS Simulator cannot construct an
`SFSpeechRecognizer`, and `isRecognitionAvailable()` returns `true` there
anyway, so the failure only appears when `start()` is called. The app surfaced
the bare native string "failed to initialize recognizer" with no guidance.

| Verified | Detail |
|---|---|
| Recognizer-init failures name the Simulator as the cause | Six real message variants, including both spellings of "initialise" |
| They say recording needs a physical iPhone | |
| Audio-session failures explain the microphone is unavailable | |
| Permission failures are distinguished from hardware failures | |
| Every recognised failure offers typed entry as the alternative | |
| An unrecognised message passes through unchanged | Never replaced with an invented explanation |
| No input ever yields an empty message | `null`, `undefined`, blank strings, empty `Error` |

### Export text — `src/services/__tests__/dreamExportText.test.js`

| Verified | Detail |
|---|---|
| The exact documented format | Full string equality |
| Title + emoji first, localized date second | |
| Ends with "Dream Decoder — a reflection, not a prediction." | |
| **The raw transcript is never included** | Asserted directly |
| Locale-aware dates | en-US, en-GB, de-DE, ja-JP |
| Time zone can change the calendar day | UTC vs. America/Los_Angeles |
| Transcript-only dreams, missing titles, malformed dates, non-array tags | None throw |
| Demo dreams are labelled in the exported text | |

### Date handling — `src/services/__tests__/formatDate.test.js`

Local-convention formatting in four locales, time-zone-dependent calendar days,
ISO/timestamp/Date inputs treated identically, unusable input returning `''`
rather than throwing, and recording-duration formatting including negatives and
nonsense.

### Deterministic card art — `src/services/__tests__/visualSeed.test.js`

Same seed gives the same gradient, accent, and constellation every time;
different seeds differ; PRNG stays in `[0, 1)`; new seeds are distinct; stars
stay inside the card; star count clamps to a drawable range; lines connect only
real stars.

A real defect was found and fixed here: a gradient stop could reach 35%
lightness while the code's own comment promised a 34% ceiling. The ceiling is
now enforced in code.

### Project health

```
npx expo lint     0 errors, 0 warnings
npx expo-doctor   20/20 checks passed
npx expo export --platform ios      bundles, 1406 modules
npx expo export --platform android  bundles, 1401 modules
```

Three real defects were found during this verification pass and fixed:

1. `exportDream.js` called `MediaLibrary.createAssetAsync`, which does not
   exist in SDK 58's media library API. It now uses `MediaLibrary.Asset.create`.
2. `File.copy()` is asynchronous in SDK 58, and the PNG export was not awaiting
   it, so the destination URI could be used before the file existed.
3. The backend client used the global `fetch`. React Native's `FormData` only
   understands strings and `{uri, name, type}` objects, so appending an
   expo-file-system `File` to it would have broken the audio upload. The client
   now uses `expo/fetch`, which is why the class reference repository uses it
   too.

### Backend boot, verified locally

- Refuses to start without `API_AUTH_TOKEN`, with an actionable message
- Boots and serves `/api/health` with correct configuration status
- Rejects unauthenticated and wrongly-authenticated requests with 401
- Rejects an empty transcript before contacting OpenRouter
- Its startup banner never prints the key

---

## NOT verified — needs a physical device

Everything in this section is written against the documented APIs and the class
reference repository's working adapters, and **none of it has been run on
hardware**. Treat each line as an assumption until you tick it.

### iOS — `npx expo run:ios --device`

- [ ] Record → stop → review → decode → save, end to end
- [ ] Partial results appear live and are visibly separate from final text
- [ ] The timer runs and Stop is obvious
- [ ] The 3-minute cap stops recording and **keeps** the transcript
- [ ] Cancel discards and releases the microphone
- [ ] Leaving the screen or backgrounding the app stops recording
- [ ] A phone call interrupting recording is handled
- [ ] Denying the microphone still permits typed entry
- [ ] Force-quit and reopen: all dreams still there
- [ ] Editing works with the keyboard open; inputs, Save, and Cancel reachable
- [ ] Large text (Accessibility → Larger Text) does not clip
- [ ] VoiceOver reads cards as single meaningful items and skips the stars
- [ ] Reduce Motion stops the cloud-map floating animation
- [ ] "Copy text" pastes correctly into another app
- [ ] The PNG is readable, unclipped, and excludes the action buttons
- [ ] Image share and save-to-photos work; denial is reported as denial
- [ ] Cloud transcription uploads and returns text **(costs money)**
- [ ] The recorded WAV's real format and MIME type match what the backend accepts

### Android — `npx expo run:android --device`

**The Android speech adapter is the highest-risk untested item.** The reference
repository's Android adapter is a starting point, and this one adds behaviour
that only a device can confirm:

- [ ] **Transcription is real, not a placeholder** — words you speak appear
- [ ] Continuous dictation survives a pause for breath. Android ends a
      recognition session after each utterance on many devices; this adapter
      restarts the engine until Stop is tapped, and that restart loop needs to
      be watched on hardware for dropped or duplicated words
- [ ] `getSpeechRecognitionServices()` reports what Settings claims it does
- [ ] A device with no speech service degrades to typed entry gracefully
- [ ] A missing language pack produces the intended message
- [ ] `softwareKeyboardLayoutMode: resize` keeps the edit form usable
- [ ] TalkBack reads cards and controls correctly
- [ ] "Remove animations" stops the floating animation
- [ ] Shadows/elevation render acceptably (Android ignores `shadowRadius`)
- [ ] The ExportCard captures non-blank — `collapsable={false}` and the
      off-screen position are there for this, and only a device proves it
- [ ] Scoped-storage photo saving works on Android 13+
- [ ] Cloud transcription upload works **(costs money)**

### Both platforms

- [ ] Offline: browsing, editing, and manual drafts all still work
- [ ] Offline: "Decode my dream" fails cleanly and the transcript survives
- [ ] An AI error permits saving a transcript-only dream
- [ ] Changing a category updates the cloud map immediately
- [ ] Delete confirmation names the dream, and Undo restores it
- [ ] The moon button opens the catalog, and its phase matches a published
      almanac for today
- [ ] Two microphone consumers never run at once

### Not yet exercised at all

- **Cloud transcription end to end.** The backend route is tested with a stubbed
  OpenRouter and a synthetic WAV. No real audio has been uploaded, and no
  transcription model has been configured or billed.
- **A real OpenRouter analysis call.** `cd server && npm run test:paid` runs one.
  It is opt-in precisely because it costs money.
- **Schema migration from version 1 to 2.** The migration runner is tested
  (idempotency, version recording, no re-running), but only version 1 exists, so
  no actual upgrade path has been exercised.
- **A deployed backend.** Only local `HOST=0.0.0.0` has been run. The rate
  limiter is in-memory and per-process; the access token is a development gate,
  not user authentication.

---

## Known limitations, stated plainly

| Area | Limitation |
|---|---|
| Phone transcription | Uses the OS speech service, which may process audio locally or remotely. Not offline, and the app does not claim otherwise. |
| Storage | Local SQLite, unencrypted, no backup, no sync. Deleting the app deletes the dreams. |
| Moon phase | Approximate — within a small fraction of a day. Not observatory precision. Orientation of the crescent is not latitude-corrected. |
| Symbol catalog | Editorial reflection prompts. Not research, and deliberately without citations. |
| Interpretations | Reflective possibilities only. Never diagnostic, predictive, or supernatural. |
| Demo data | 16 hand-written samples, not AI output. Marked DEMO DATA on every card and removable in Settings. |
| Sharing | The app reports that a share sheet opened, never that anything was received. |
| Emoji rendering | Platform-drawn, so export cards differ between iOS and Android. |
| Backend auth | Shared token in the app bundle. Fine for development on your own network; not sufficient for public deployment. |
| Prompt injection | The dream text is delimited and the system prompt says to treat it as data, but that is defence in depth, not a guarantee. The real protections are structural: fixed schema validation, a fixed category list, no tools, no key exposure, and no writes. |
