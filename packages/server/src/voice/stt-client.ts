const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

interface STTResult {
  text: string;
  language: string;
  language_probability: number;
  duration: number;
}

export async function transcribe(audioBuffer: Buffer): Promise<STTResult> {
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/wav' });
  formData.append('audio', blob, 'audio.wav');

  const res = await fetch(`${AI_SERVICE_URL}/stt`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`STT service returned ${res.status}`);
  }

  return res.json() as Promise<STTResult>;
}
