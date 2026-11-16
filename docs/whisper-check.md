# Check Whisper before building the app

Requires Node.js 20.19.4 or newer. No dependencies to install.

1. Copy `.env.example` to `.env` and fill in your OpenRouter API key locally.
2. Run from the project directory:

   ```sh
   node scripts/check-whisper.mjs
   ```

The script uploads `Grocery List.m4a` to OpenRouter's `/audio/transcriptions`
endpoint as multipart form data, matching the Voice-To-Text reference app.
Each run makes one billable transcription request. It prints `PASS` and the
transcript, or `FAIL` with an error and exits with status 1. Read the transcript
to check its accuracy against the recording.

To check another recording (for example, a converted WAV file):

```sh
node scripts/check-whisper.mjs "path/to/recording.wav"
```

The default model is `openai/whisper-large-v3-turbo`, verified with the supplied M4A recording and a 16 kHz mono WAV conversion.
If OpenRouter rejects that model, check its current transcription model catalog
and update `EXPO_PUBLIC_TRANSCRIPTION_MODEL` in `.env`. The script does not
silently switch models. A `PASS` applies to the model you configured.

You can also supply `OPENROUTER_API_KEY` through your shell environment.
Environment variables take precedence over `.env`; `OPENROUTER_API_KEY` takes
precedence over `EXPO_PUBLIC_OPENROUTER_API_KEY`. Run with `--help` for usage.
