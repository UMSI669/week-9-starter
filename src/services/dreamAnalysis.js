/**
 * Dream analysis. Mobile app -> project backend -> OpenRouter.
 *
 * This module sends the REVIEWED transcript only, and only when the user has
 * tapped "Decode my dream" or "Reinterpret". It never fires on its own, and
 * it never retries automatically: the call is billable, so a retry is the
 * user's decision.
 *
 * The id, dates, time zone, and visualSeed of a dream are set by application
 * code, never from this response.
 */

import { apiRequest } from './apiClient';
import { validateAnalysis } from './dreamSchema';

export const ANALYSIS_NOTICE =
  'Decoding sends the dream text above to this app’s backend, which forwards it to OpenRouter ' +
  'for analysis. Audio is never sent in this step. Nothing is sent until you tap the button.';

/**
 * @param {object} input
 * @param {string} input.transcript The text the user reviewed and approved.
 * @param {AbortSignal} [input.signal]
 * @returns {Promise<object>} Validated card fields plus `analysisModel`.
 */
export async function analyzeDreamText({ transcript, signal }) {
  const text = String(transcript || '').trim();
  if (!text) throw new Error('There is no dream text to decode yet.');

  const body = await apiRequest('/api/dreams/analyze', {
    json: { transcript: text },
    timeoutMs: 60_000,
    signal,
  });

  // The backend already validated this. Validating again means a surprising
  // response shape cannot reach the UI.
  const validated = validateAnalysis(body?.analysis);
  if (!validated.ok) {
    throw new Error(
      `The reflection that came back did not look right (${validated.errors[0]}). ` +
        'Nothing was saved. Your transcript is unchanged.',
    );
  }

  return {
    ...validated.value,
    analysisModel: typeof body.analysis.analysisModel === 'string'
      ? body.analysis.analysisModel
      : null,
  };
}

/** Maps analysis output onto the dream record fields. */
export function analysisToDreamFields(analysis) {
  return {
    title: analysis.title,
    summary: analysis.summary,
    symbolKey: analysis.symbol.key,
    symbolLabel: analysis.symbol.label,
    emoji: analysis.symbol.emoji,
    interpretation: analysis.interpretation,
    reflectionQuestion: analysis.reflectionQuestion,
    primaryCategory: analysis.primaryCategory,
    themes: analysis.themes,
    moods: analysis.moods,
    analysisStatus: 'generated',
    analysisModel: analysis.analysisModel || null,
  };
}

export default analyzeDreamText;
