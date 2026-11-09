# Verified provider checks

Checked on November 9, 2026. Keys are kept in the ignored `.env` file.

| Check | Model | Result |
| --- | --- | --- |
| Original 10.22-second `Grocery List.m4a` | OpenRouter `openai/whisper-large-v3-turbo` | PASS, 1.5 seconds |
| Same recording converted to 16 kHz mono PCM WAV | OpenRouter `openai/whisper-large-v3-turbo` | PASS, 1.4 seconds; same words |
| Toolkit `GET /v1/models` with the second key | U-M GPT Toolkit | HTTP 200; includes `gpt-6-luna` |
| Grocery transcript to strict-schema JSON | Toolkit `gpt-6-luna` via `/v1/responses` | PASS, 5.5 seconds; schema validated |

Transcript:

> Make me a shopping list that includes apples, eggs, two gallons of milk,
> and a loaf of bread. Thank you.

Parsed items:

| Name | Quantity | Unit | Category | Quantity inferred |
| --- | --- | --- | --- | --- |
| apple | 1 | none | Produce | true |
| egg | 1 | none | Dairy | true |
| milk | 2 | gal | Dairy | false |
| bread | 1 | loaf | Bakery | false |

The initial HTTP 401 was resolved by using the U-M GPT Toolkit gateway rather
than sending the Toolkit key directly to OpenAI. The app and check script now
use `EXPO_PUBLIC_UMGPT_API_KEY` and `EXPO_PUBLIC_UMGPT_BASE_URL`.

To recreate the WAV comparison:

```sh
ffmpeg -i "Grocery List.m4a" -ar 16000 -ac 1 /tmp/grocery-list.wav
node scripts/check-whisper.mjs /tmp/grocery-list.wav
```

See [the Whisper check guide](whisper-check.md) for key/account errors. Live
checks make provider requests; the automated unit and browser tests use mocks.
