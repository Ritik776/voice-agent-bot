import { Router, raw } from 'express';
import { synthesize, detectVoice } from '../voice/tts';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

export const voiceRouter = Router();

// TTS — text → audio (Edge-TTS)
voiceRouter.post('/tts', async (req, res) => {
  const { text, language = 'en' } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  try {
    const lang = detectVoice(text, language);
    const audio = await synthesize(text, lang);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audio.length.toString());
    res.send(audio);
  } catch (error) {
    console.error('[TTS]', error);
    res.status(500).json({ error: 'TTS synthesis failed' });
  }
});

// STT — audio blob → transcript (Deepgram)
voiceRouter.post('/stt', raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  if (!DEEPGRAM_API_KEY) {
    res.status(500).json({ error: 'DEEPGRAM_API_KEY not configured' });
    return;
  }

  const audioBuffer = req.body as Buffer;
  if (!audioBuffer || audioBuffer.length === 0) {
    res.status(400).json({ error: 'audio data required' });
    return;
  }

  try {
    // Use known language for better accuracy (Hindi especially needs explicit hint)
    const langHint = (req.query.language as string) || '';
    const langParam = langHint
      ? `language=${encodeURIComponent(langHint)}`
      : 'detect_language=true';

    const dgRes = await fetch(
      `https://api.deepgram.com/v1/listen?${langParam}&model=nova-2&smart_format=true&punctuate=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': req.headers['content-type'] || 'audio/webm',
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!dgRes.ok) {
      throw new Error(`Deepgram error: ${dgRes.status}`);
    }

    const data = await dgRes.json() as any;
    const channel = data.results?.channels?.[0];
    const alt = channel?.alternatives?.[0];

    res.json({
      text: alt?.transcript || '',
      language: channel?.detected_language || 'en',
      confidence: alt?.confidence || 0,
    });
  } catch (error) {
    console.error('[STT]', error);
    res.status(500).json({ error: 'STT failed' });
  }
});
