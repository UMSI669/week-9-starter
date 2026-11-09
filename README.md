# Interview Lens — privacy-first UX research interviews (Expo / React Native, TypeScript)

Record or import interviews on an iPhone, transcribe them **on the device**, pseudonymize identifying details **on the device**, review exactly what will leave the phone, then run AI-assisted qualitative coding directly against OpenRouter with the researcher's **own** API key. There is no backend.

Built from `UX_Research_App_TODO.md`, following the patterns in the course demo [UMSI669/Voice-To-Text](https://github.com/UMSI669/Voice-To-Text) (Expo SDK 58, Expo Router, expo-audio, expo-file-system, Redux Toolkit, whisper.rn, expo-speech-recognition).

Progress against the TODO list: [docs/STATUS.md](docs/STATUS.md).

## MVP decisions (TODO §1)

| Decision | Choice |
| --- | --- |
| Devices | iPhone 12 or later (A14, 4 GB RAM) — the oldest target for the local LLM benchmark |
| iOS | 17+ (Apple file-based speech recognition in `expo-speech-recognition` requires iOS 17) |
| Language | English (US) |
| Recording length | Up to ~60 min recommended, hard stop at 90 min. 16 kHz mono 16-bit WAV ≈ 115 MB/hour |
| Masked details | People, emails, phones, URLs, IDs (MRN/SSN/account numbers, long digit runs), specific dates, street addresses, organizations, locations, plus researcher-flagged "identifying context" |
| Analysis outputs | Summary, 4–12 research codes linked to segment ids, 2–5 themes grouping codes, 3–8 verbatim supporting quotes linked to segment ids |

## Model choices

| Job | Model | Why |
| --- | --- | --- |
| Speech-to-text (default) | **Apple on-device speech** (`requiresOnDeviceRecognition: true`) | No download; Apple's servers are never used; stops if on-device isn't supported |
| Speech-to-text (alt) | **Whisper base.en Q5_1** (60 MB) via whisper.rn | Clearly better than tiny on conversational speech, still faster than real time on A14. Options: tiny.en (32 MB, fastest), small.en (190 MB, most accurate) |
| Sensitive-span detection | **Qwen2.5-1.5B-Instruct Q4_K_M** (1.1 GB) via llama.rn (`0.13.0-rc.9`; 0.12.9 doesn't build on RN 0.88) | Reliable JSON-schema output and good entity recall for its size; fits 4 GB RAM. Options: Qwen2.5-0.5B (490 MB) for old phones / long transcripts, Llama-3.2-1B (808 MB) for comparison |
| Cloud analysis (default) | **anthropic/claude-sonnet-5.5** on OpenRouter | Strong qualitative reasoning + strict structured outputs; ~a few cents per hour-long interview. Options: Claude Haiku 5.5 (cheapest), Claude Opus 5.5 (deepest), Gemini 3.5 Flash, or any custom id with `json_schema` support |

All download URLs/sizes were verified against Hugging Face; prices come from OpenRouter's model list (Nov 2026).

## Two runtimes

| | Expo Go (demo mode) | Development build (full) |
| --- | --- | --- |
| Bundled synthetic interviews | ✅ with **labeled pre-written sample transcripts** | ✅ (and can be really transcribed) |
| Record / import audio, playback | ✅ | ✅ |
| On-device transcription | ❌ — app stops; type/paste instead (never uploads) | ✅ Apple on-device or Whisper |
| Masking | **Simplified** TypeScript patterns + "Always mask" list (labeled) | Patterns + local Qwen/Llama, chunked |
| Review, edit, cloud analysis, export | ✅ real (your key) | ✅ |

Native modules (`expo-speech-recognition`, `whisper.rn`, `llama.rn`) are only `require`d lazily inside functions guarded by `nativeAiAvailable` (`src/services/runtime.ts`), so Expo Go never loads them.

## Install & run

Requirements: Node 20.19.4+ (22 LTS recommended), Xcode for iOS builds.

```sh
npm install

# Expo Go demo (simulator or phone with Expo Go SDK 58)
npm run start:go            # then press i

# Full development build (native speech, Whisper, Qwen/Llama)
npx expo run:ios --device   # physical iPhone recommended
# or cloud: npx eas-cli@latest build --profile development --platform ios
```

`ios/` and `android/` are generated (CNG); configure native settings in `app.json` only. After adding/updating native libraries, rebuild the dev client (`rm -rf ios && npx expo run:ios`).

The simulator dev build has been verified to compile and launch. On a physical phone over campus Wi-Fi, start Metro with `npx expo start --tunnel`: iOS blocks plain-HTTP loads from a public LAN IP.

### First-run setup

1. **Settings → OpenRouter API key**: paste your own key (`sk-or-…`), *Save*, *Test key*. Stored in the iOS Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Never in source, the bundle, `EXPO_PUBLIC_*`, Redux, or the data file. Set a spending limit on the key at openrouter.ai.
2. **Settings → On-device models** (dev build): download Whisper base.en and/or Qwen2.5-1.5B (use Wi-Fi). Models live in `Caches/models` (kept out of iCloud backups; re-download if iOS purges them).
3. **Settings → Benchmark selected masking model** runs Qwen/Llama on both synthetic interviews and reports load time, per-interview time, chunks, entities found and recall vs. ground truth.

## Workflow

Projects → interviews → **Audio** (record / import / sample) → **Transcribe on device** → **Transcript** (correct text, label speakers, tap timestamps to play) → **Privacy review** (detect, accept/reject per entity, mask extra phrases, compare *Changes / Original / Cloud-bound*, approve) → **Analysis** (checklist, exact payload preview, cost estimate, send/cancel, then accept/edit/reject codes & themes, edit summary, remove quotes) → **Codebook** across interviews → **Export** (explicit masked vs original, Markdown/JSON, share sheet).

## Privacy design

- **Payload boundary** (`src/services/analysis/payload.ts`): only masked segment text, segment ids, rounded start seconds, generic speaker roles (names → "Speaker"), and — if enabled per project — research question/context masked with the same identity map. Never audio, original text, identity map, titles, file names, notes, or project names. A leak check refuses to send if any accepted identifier still appears.
- **Approval** is bound to a fingerprint of the exact cloud-bound text; any transcript edit or masking change clears it.
- **Placeholders** are stable (`[PERSON_01]`), shared across mentions ("Maria Delgado" and later "Maria"), never renumbered, and applied in code — the model never rewrites the transcript.
- **Local LLM** output is only used if the entity text literally occurs in the chunk (hallucinations can't inject text); known entities are passed between chunks and propagated transcript-wide for consistency.
- **OpenRouter privacy**: `provider.data_collection: "deny"` by default, optional `provider.zdr: true`, `require_parameters: true` so structured output is enforced.
- **Errors**: handled for missing key, 401/403, 402 credits, 429 (Retry-After), timeouts (180 s), cancellation, offline, privacy-routing 404, truncated or malformed responses. Messages are scrubbed of keys/URLs/paths. No analytics or crash reporting.
- **Storage**: `Documents/vault/data.json` (atomic write) + `Documents/vault/audio/<sessionId>.<ext>` under iOS Data Protection. Deleting an interview/project removes its audio, transcript, mapping and analysis; *Settings → Delete all local research data* wipes everything.
- **Backups**: iOS device backups include app Documents (transcripts, identity mappings, audio). Use encrypted backups or turn off iCloud Backup for the app if your protocol requires it.

### Pseudonymization ≠ anonymity

Placeholders remove direct identifiers; they do **not** guarantee anonymity. A participant's job, schedule, or a rare event can still identify them, and automatic detection misses things. The researcher must read the cloud-bound text and mask identifying context before approving.

## Tests & checks

```sh
npm test            # jest-expo: 35 tests
npm run lint        # expo lint
npm run typecheck   # tsc --noEmit
npx expo-doctor
```

Tests (`src/services/__tests__`) use the synthetic interviews to check: every ground-truth identifier is masked; placeholder consistency and stability across re-runs/edits; wording outside replacements is byte-identical; researcher rejections and manual phrases survive re-detection; the **network payload boundary** (no identifiers, titles, notes, paths, file names, or identity map in the request body); leak detection blocks sending; OpenRouter error mapping, timeout and cancel; response validation (unknown segment ids dropped, non-verbatim quotes flagged); chunked LLM detection with an injected fake model; store invariants (edits clear approval, segment ids never reused).

## Demo data

`assets/audio/*.wav` are **synthetic** interviews generated with macOS text-to-speech by `scripts/generate-sample-audio.py` from `scripts/sample-interviews.json`. All names, numbers (555-01xx), emails (example.com), and organizations are fictional. Regenerate with `python3 scripts/generate-sample-audio.py`.

## Still to validate on hardware (TODO §7)

Not yet done in this workspace, and needing a physical iPhone 12-class device:

- Live microphone recording quality and background recording
- Apple on-device recognition on long recordings (timestamps across multiple final results)
- Whisper speed, Qwen memory/time and battery use (use the Settings benchmark)
- A real OpenRouter analysis request (charges apply)
- Denied-permission, offline, and interrupted-processing paths on device

The Expo Go demo was checked in the iOS simulator: the project list, demo project, interview screen with bundled audio, and privacy review all render and work.
