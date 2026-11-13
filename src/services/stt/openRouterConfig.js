// CLASSROOM DEMO ONLY:
// EXPO_PUBLIC_* values are embedded in the app. This is NOT production-safe.
// Production apps must keep provider keys on a backend.
// Cloned from the Voice-To-Text demo, plus a fixed transcription model because
// this app has no model picker.

const DEFAULT_STT_MODEL = "openai/whisper-large-v3-turbo";

const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim() || "";

const baseUrl = (
  process.env.EXPO_PUBLIC_OPENROUTER_BASE_URL?.trim() ||
  "https://openrouter.ai/api/v1"
).replace(/\/+$/, "");

const sttModel =
  process.env.EXPO_PUBLIC_OPENROUTER_STT_MODEL?.trim() || DEFAULT_STT_MODEL;

export const openRouterConfig = {
  apiKey,
  baseUrl,
  sttModel,
  modelsUrl: `${baseUrl}/models?output_modalities=transcription`,
};

export function getMissingOpenRouterEnvItems() {
  return apiKey ? [] : ["EXPO_PUBLIC_OPENROUTER_API_KEY"];
}

export function isOpenRouterConfigured() {
  return getMissingOpenRouterEnvItems().length === 0;
}
