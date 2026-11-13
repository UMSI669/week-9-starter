// Helpers cloned from the Voice-To-Text demo (src/services/audio/recording.js).

export function getAudioFileMetadata(uri) {
  const filename = uri?.split("/").pop() || "recording.wav";
  const extension = filename.split(".").pop()?.toLowerCase();
  const mimeType = extension === "wav" ? "audio/wav" : "audio/mp4";

  return { filename, mimeType };
}

export function safeErrorMessage(error, fallback = "Transcription failed.") {
  let message = error instanceof Error ? error.message : fallback;

  if (!message) message = fallback;

  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim();
  if (apiKey) message = message.split(apiKey).join("[redacted]");

  return message
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"']+/gi, "[request URL]")
    .slice(0, 500);
}
