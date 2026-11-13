import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { safeErrorMessage } from "../audio/recording";
import { isOpenRouterConfigured, openRouterConfig } from "./openRouterConfig";

export const cloudStt = {
  capabilities: {
    microphone: true,
    audioFile: true,
    processingLocation: "cloud",
    unavailableReason: null,
  },

  async transcribeFile({ uri, filename, mimeType, model, signal }) {
    if (!isOpenRouterConfigured()) {
      throw new Error(
        "OpenRouter env items need to be provided in .env for it to work.",
      );
    }
    if (!model) throw new Error("Select an OpenRouter transcription model.");
    if (signal?.aborted) throw makeAbortError();

    const audioFile = new File(uri);
    if (!audioFile.exists) {
      throw new Error("The audio file is not available for upload.");
    }

    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("model", model);

    const response = await expoFetch(
      `${openRouterConfig.baseUrl}/audio/transcriptions`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${openRouterConfig.apiKey}`,
        },
        body: formData,
        signal,
      },
    );

    const responseText = await response.text();
    let body;
    try {
      body = JSON.parse(responseText);
    } catch (_error) {
      if (!response.ok) {
        throw new Error(`OpenRouter transcription failed (${response.status}).`);
      }
      throw new Error("OpenRouter returned an unexpected transcription response.");
    }

    if (!response.ok) {
      const providerMessage =
        body?.error?.message ||
        body?.message ||
        `OpenRouter transcription failed (${response.status}).`;
      throw new Error(safeErrorMessage(new Error(providerMessage)));
    }

    if (typeof body?.text !== "string") {
      throw new Error("OpenRouter returned an unexpected transcription response.");
    }

    return {
      transcript: body.text,
      model,
      returnedModel: typeof body.model === "string" ? body.model : null,
      language: typeof body.language === "string" ? body.language : null,
      responseDetails: {
        text: body.text,
        language: typeof body.language === "string" ? body.language : null,
        durationInSeconds:
          typeof body.duration === "number" ? body.duration : null,
        segments: Array.isArray(body.segments) ? body.segments : [],
        words: Array.isArray(body.words) ? body.words : [],
      },
      filename: filename || audioFile.name,
      mimeType: mimeType || audioFile.type,
    };
  },
};

function makeAbortError() {
  const error = new Error("Transcription canceled.");
  error.name = "AbortError";
  return error;
}
