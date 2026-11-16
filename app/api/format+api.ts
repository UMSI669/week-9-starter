import { parseGroceries, parserRequest } from '../../services/umgpt/parser';
import { safeError } from '../../services/apiErrors';

export async function POST(request: Request) {
  let transcript: string;
  try {
    const body = await request.json();
    if (typeof body?.transcript !== 'string') throw new Error('Enter a transcript to format.');
    transcript = body.transcript;
    parserRequest(transcript, '');
  } catch (error) {
    return Response.json({ error: { message: safeError(error, 'Send a valid transcript.') } }, { status: 400 });
  }
  const timeout = AbortSignal.timeout(55_000);
  try {
    const items = await parseGroceries(
      transcript,
      process.env.UMGPT_API_KEY?.trim() || process.env.EXPO_PUBLIC_UMGPT_API_KEY?.trim() || '',
      process.env.EXPO_PUBLIC_PARSER_MODEL?.trim() || 'gpt-6-luna',
      AbortSignal.any([request.signal, timeout]), fetch,
      process.env.EXPO_PUBLIC_UMGPT_BASE_URL?.trim() || 'https://api.toolkit.umgpt.umich.edu/v1',
    );
    return Response.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: { message: timeout.aborted ? 'Item formatting timed out. Please retry.' : safeError(error) } }, { status: timeout.aborted ? 504 : 502 });
  }
}
