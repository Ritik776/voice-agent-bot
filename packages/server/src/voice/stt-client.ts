const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

interface STTResult {
  text: string;
  language: string;
  language_probability: number;
  duration: number;
}

export async function transcribe(audioBuffer: Buffer): Promise<STTResult> {
  if (!DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY not set');
  }

  const res = await fetch(
    'https://api.deepgram.com/v1/listen?detect_language=true&model=nova-2&smart_format=true&punctuate=true',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/wav',
      },
      body: audioBuffer,
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!res.ok) {
    throw new Error(`Deepgram STT failed: ${res.status}`);
  }

  const data = await res.json() as any;
  const channel = data.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  return {
    text: alternative?.transcript || '',
    language: channel?.detected_language || 'en',
    language_probability: alternative?.confidence || 0,
    duration: data.metadata?.duration || 0,
  };
}
