# Third-party code and licences

## Class reference repository

Parts of this project are adapted from the SI 669 class reference repository:

**UMSI669/Voice-To-Text** — https://github.com/UMSI669/Voice-To-Text

That repository carries the MIT licence reproduced below. The following files in
Dream Decoder adapt code or structure from it, and each one says so in its own
header:

| File here | Adapted from |
|---|---|
| `src/services/stt/micLock.js` | `src/services/audio/recording.js` (microphone lock, audio-file metadata, `safeErrorMessage`) |
| `src/services/stt/nativeStt.ios.js` | `src/services/stt/nativeStt.ios.js` (adapter interface, foreground wait, session teardown, partial/final separation) |
| `src/services/stt/nativeStt.android.js` | `src/services/stt/nativeStt.android.js` (adapter interface and listener wiring; the continuous-dictation restart loop, the service-availability check, and the error mapping are new) |
| `src/services/stt/nativeStt.js` | `src/services/stt/nativeStt.js` (unavailable-platform fallback) |
| `src/services/stt/cloudStt.js` | `src/services/stt/cloudStt.js` (multipart upload shape, redirected at this project's own backend instead of calling OpenRouter from the phone) |
| `src/services/stt/index.js` | `src/services/stt/index.js` (adapter registry shape) |
| `src/hooks/useDreamCapture.js` | `src/hooks/useMicrophoneTranscription.js` (recording lifecycle, cleanup discipline, `useAudioStream` WAV recording) |
| Expo SDK 58 / React Native 0.88 dependency versions and JS/JSX conventions | `package.json`, `app.json` |

The reference repository's licence file attributes the MIT text to Expo
(650 Industries, Inc.), as it originates from an Expo template.

```
The MIT License (MIT)

Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Algorithms

The lunar-phase calculation in `src/services/moonPhase.js` implements the
truncated periodic-term series for the Moon's and Sun's apparent ecliptic
longitudes from:

> Jean Meeus, *Astronomical Algorithms*, 2nd edition, Willmann-Bell, 1998,
> chapters 25 (solar coordinates) and 47 (position of the Moon).

The coefficients are published astronomical constants, not copied source code.
No third-party astronomy library is bundled.

## Runtime dependencies

Expo SDK 58, React Native, React, Redux Toolkit, react-redux,
react-native-svg, react-native-view-shot, Express, multer, and dotenv are each
used under their own licences, which ship inside `node_modules` and are not
reproduced here.

## The dream-symbol catalog

`src/data/symbolCatalog.js` and the 16 demo dreams in
`src/services/seedDreams.js` were written for this project. They are editorial
reflection content, not reproductions of any published dream dictionary, and
they deliberately carry no research citations because inventing them would be
dishonest.
