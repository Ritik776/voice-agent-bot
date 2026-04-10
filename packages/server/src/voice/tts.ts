import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

const VOICE_MAP: Record<string, string> = {
  'hi': 'hi-IN-SwaraNeural',
  'hi-male': 'hi-IN-MadhurNeural',
  'en': 'en-IN-NeerjaNeural',
  'en-male': 'en-IN-PrabhatNeural',
  'es': 'es-ES-ElviraNeural',
  'ar': 'ar-SA-ZariyahNeural',
  'ta': 'ta-IN-PallaviNeural',
  'te': 'te-IN-ShrutiNeural',
  'bn': 'bn-IN-TanishaaNeural',
  'mr': 'mr-IN-AarohiNeural',
};

export async function synthesize(text: string, language: string): Promise<Buffer> {
  const voice = VOICE_MAP[language] || VOICE_MAP['en'];
  const outputPath = join(tmpdir(), `tts-${randomUUID()}.mp3`);

  try {
    // Escape text for shell — replace quotes and limit length
    const safeText = text
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .slice(0, 500);

    await execAsync(
      `edge-tts --voice "${voice}" --text "${safeText}" --write-media "${outputPath}"`,
      { timeout: 15000 }
    );

    const audio = await readFile(outputPath);
    return audio;
  } catch (error) {
    console.error('[TTS] Synthesis failed:', error);
    throw error;
  } finally {
    await unlink(outputPath).catch(() => {});
  }
}

export function detectVoice(text: string, detectedLang: string): string {
  if (detectedLang === 'hi' || detectedLang === 'en') {
    const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;

    if (totalChars > 0 && hindiChars / totalChars > 0.2) {
      return 'hi';
    }
  }
  return detectedLang;
}
