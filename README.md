# Voice Idea Lab

A proposed voice-to-text app for capturing an idea while it is fresh. The user
would speak a thought, review the transcript, and choose to save it as a note or
ask AI to turn it into a short summary and a possible next step.

## Current status

This repository now has a minimal Expo app that shows a placeholder screen.
Speech transcription, saving ideas, and AI requests have not been built yet.

## Planned experience

1. Record a short spoken idea.
2. Convert the speech to editable text.
3. Let the user review and correct the transcript.
4. Save the transcript as an idea, or send the approved text to an AI service for
   a summary and suggested next step.
5. Show the saved ideas and any generated results.

The transcript should only be stored or sent to an AI service after the user
chooses that action.

## Setup

Install Node.js and npm, then open this folder in a terminal:

```bash
cd si669/week-9-starter
npm install
npm start
```

Expo will show a QR code. Open it with Expo Go on a compatible phone. Stop the
development server with `Ctrl+C`.

## Next development steps

- Choose a speech-to-text API or library and add microphone permission handling.
- Add transcript review and a place to store saved ideas.
- If AI requests are included, add a secure way to call the AI service without
  putting a secret key in client-side code.
- Document the finished setup, run commands, and testing steps here.

The original course setup guide is in [`docs/README.md`](docs/README.md). Its
Expo creation step describes the blank starter and should be skipped because
this repository already contains an Expo app.
