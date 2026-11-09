const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.EXPO_PUBLIC_OPENROUTER_MODEL || 'openai/gpt-4o-mini';

export async function interpretDream(text) {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Add EXPO_PUBLIC_OPENROUTER_API_KEY to your .env file, then restart Expo.');
  }

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 160,
        messages: [
          {
            role: 'system',
            content: 'Give a gentle, imaginative interpretation of a dream in 2–3 short sentences. Describe possible themes, not facts. Do not diagnose, predict events, or claim certainty. Do not include a disclaimer.',
          },
          { role: 'user', content: `Dream:\n${text}` },
        ],
      }),
    });
  } catch {
    throw new Error('Could not reach OpenRouter. Check your connection and try again.');
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('OpenRouter rejected the API key. Check the key in your .env file.');
    }
    if (response.status === 403) {
      let providerMessage = '';
      try {
        const body = await response.json();
        providerMessage = String(body?.error?.message || '');
      } catch {
        // Use a general message when the provider error cannot be read.
      }
      if (/key limit exceeded/i.test(providerMessage)) {
        throw new Error('This OpenRouter key has reached its spending limit. Increase the key limit in your OpenRouter dashboard, then try again.');
      }
      throw new Error('OpenRouter denied this request. Check this key’s limits and model access.');
    }
    if (response.status === 402) {
      throw new Error('OpenRouter needs available credits for this model.');
    }
    if (response.status === 429) {
      throw new Error('OpenRouter is busy or has reached a rate limit. Try again shortly.');
    }
    throw new Error(`OpenRouter could not interpret this dream (${response.status}). Try again.`);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('OpenRouter returned an unreadable response. Try again.');
  }

  const content = body?.choices?.[0]?.message?.content;
  const interpretation = typeof content === 'string'
    ? content.trim()
    : Array.isArray(content)
      ? content.filter((part) => part?.type === 'text').map((part) => part.text).join(' ').trim()
      : '';
  if (!interpretation) throw new Error('OpenRouter returned an empty interpretation. Try again.');
  return interpretation;
}
