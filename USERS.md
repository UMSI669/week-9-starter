# Dream Decoder — API and Device Setup

## What needs an API key?

- Manual dream entry: no key.
- Native phone transcription: no OpenRouter key.
- Local gallery, editing, cloud map, moon phase, and PNG export: no key.
- OpenRouter dream analysis: an OpenRouter API key.
- Optional OpenRouter audio transcription: an OpenRouter API key
  and a supported transcription model.

Your classroom Codex key is not your OpenRouter key.

## Recommended key architecture

Keep the OpenRouter key on the project's backend.

The mobile app contains only the backend URL.
It must not contain a shared OpenRouter secret.

Expo variables beginning with EXPO_PUBLIC_ are included in the
client application. They are not a place for provider secrets.

The class reference repository includes a direct-client key option
for classroom demonstrations. That is not the recommended setup
for a shared or distributed Dream Decoder app.

## 1. Create an OpenRouter key

1. Open the official OpenRouter website.
2. Sign in or create an account.
3. Open its API key settings.
4. Create a dedicated key for Dream Decoder.
5. Configure a spending limit if the account interface supports it.
6. Review credits and the selected models' current prices.
7. Put the key directly into your local backend environment file.

Do not paste the key into:
- A coding-agent prompt
- A chat conversation
- A GitHub issue
- A screenshot
- A committed file
- The mobile application's public environment variables

If a key is exposed, revoke it and create a replacement.

## 2. Choose models

Choose two models independently:

Analysis model:
- Accepts text
- Supports structured JSON outputs
- Fits your project budget

Transcription model, if cloud transcription is enabled:
- Supports transcription output
- Accepts the audio format produced by your app

Use exact model identifiers from the current OpenRouter catalog.
Do not assume a model name from an example is still available.

The implementation should make model identifiers configurable.

## 3. Configure the backend

The coding agent should create server/.env.example containing:

OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_ANALYSIS_MODEL=
OPENROUTER_TRANSCRIPTION_MODEL=
PORT=3000

Copy it to server/.env and fill in the values locally.

OPENROUTER_TRANSCRIPTION_MODEL can remain empty when using
only native transcription.

Keep server/.env out of Git.
Commit only the blank example file.

The backend should call:
- https://openrouter.ai/api/v1/chat/completions
- https://openrouter.ai/api/v1/audio/transcriptions, if enabled

OpenRouter authentication uses a Bearer API key supplied by
the backend.

The agent must document the backend startup command.
For consistency, request an npm run dev script in server/package.json.

Then run:

cd server
npm install
npm run dev

## 4. Configure the Expo app

The agent should create a root .env.example containing:

EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:3000

Copy it to .env and replace the placeholder with your development
computer's local network address.

Example address format:
http://192.168.1.25:3000

That is an illustrative address, not a guaranteed address for
your computer.

A physical phone normally cannot reach your computer using
localhost: localhost refers to the phone itself.

Development setup:
- Phone and computer should be on a reachable network.
- The backend must listen on a network-accessible interface.
- Check the computer firewall.
- Use an authenticated HTTPS development endpoint when possible.
- Local HTTP may need development-only platform configuration.
- Do not weaken release network security settings just to make
  local HTTP work.

Restart the Expo development server after changing .env:

npx expo start --dev-client

For a deployed backend, replace the local URL with its HTTPS URL.
The agent must implement authentication and rate limiting before
exposing a paid AI endpoint publicly.

## 5. Install and build native clients

If starting from the class reference repository, follow its current
Node.js and package requirements.

Install dependencies:

npm install

Run project health checks:

npx expo-doctor

Build and install on a connected iPhone:

npx expo run:ios --device

A local iOS build requires macOS, Xcode, and appropriate signing.
Physical-device signing requirements depend on your setup.

Build and install on a connected Android phone:

npx expo run:android --device

Android development requires the Android build tools and device
debugging configuration.

Start the development server:

npx expo start --dev-client

Use an Expo development build rather than Expo Go for the native
speech implementation.

Rebuild the native client after adding or changing native libraries
or configuration plugins. Ordinary JavaScript edits usually do not
require a native rebuild.

Expo Application Services (EAS) development builds are an alternative
to compiling locally; follow Expo's signing and build instructions.

## 6. First-run verification

Start with a short, nonpersonal test dream:

"I dreamed I was walking through a purple forest and found a glowing door."

Check:
1. Native recording produces editable text.
2. "Decode my dream" sends reviewed text to the backend.
3. The backend returns validated card fields.
4. The card saves and survives an app restart.
5. Editing works with the keyboard visible.
6. Copy text works.
7. PNG export is readable.
8. Optional cloud transcription works separately.

Cloud analysis and transcription can incur charges.
Use a small explicit test rather than automatic repeated requests.

## Troubleshooting

"Missing configuration"
- Check server/.env and the app's .env.
- Restart the affected processes.
- Confirm the app has a backend URL, not a provider key.

401 or 403 from OpenRouter
- Check whether the backend key is valid and permitted.
- Do not print the key while debugging.

402 or a credit/billing error
- Review account credits and spending settings.

Unsupported model or schema error
- Verify the exact model ID.
- Confirm structured-output or transcription support.

Phone cannot reach backend
- Do not use localhost on a physical device.
- Check network reachability, server binding, firewall, and HTTPS.

Native module unavailable
- Install a development build with that native module.
- Rebuild after native dependency changes.

Android speech unavailable
- Check the implemented Android adapter, device speech service,
  permissions, and runtime capability.
- The reference repository's Android stub is not working recognition.
- Keep manual entry available.

Microphone denied
- Explain how to change permission in device settings.
- Continue to allow typed dreams.

Photo save denied
- Keep image sharing available when supported.
- Do not report the image as saved unless saving succeeds.

## Before sharing the app

- Remove any provider keys from client configuration.
- Check Git history for accidentally committed secrets.
- Revoke exposed keys; removing the file alone is not sufficient.
- Use an authenticated, rate-limited HTTPS backend.
- Keep routine tests mocked so they do not incur provider charges.
- Clearly describe when audio or text is sent to a service.
- Do not claim offline transcription unless verified for that mode
  and device.
- Do not promise encryption, retention behavior, or cloud backup
  unless implemented and documented.