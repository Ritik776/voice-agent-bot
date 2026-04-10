# Voice Pipeline — STT / TTS / WebSocket

## Overview

Voice is the key differentiator. The flow must feel natural — no long pauses, no robotic speech. Target latency: under 3 seconds from user stops speaking to bot starts speaking.

## Voice flow (detailed)

```
Browser (Widget)                    Server                      AI Service
─────────────────                   ──────                      ──────────
1. User clicks mic button
2. Request microphone permission
3. Create AudioContext (48kHz)
4. Connect MediaStreamSource
   → AudioWorklet (PCM16, 16kHz)
   → Buffer into 250ms chunks
5. Send chunks via WebSocket          │
   event: "audio-chunk"              │
   data: { audio: Uint8Array,        │
           sampleRate: 16000 }       │
                                     6. Buffer chunks
                                     7. Detect silence (VAD)
                                        - 600ms silence = end of utterance
                                     8. POST /stt ──────────────►
                                        body: audio buffer            9. Faster-Whisper
                                                                         transcribe
                                                                      10. Return:
                                     11. ◄───────────────────────        { text, language,
                                         transcript received              confidence }
                                     12. Feed to ConversationService
                                     13. Get bot response text
                                     14. Call TTSService.synthesize()
                                         (Edge-TTS, runs in Node.js)
                                     15. Stream TTS audio back
   ◄─────────────────────────────    16. WebSocket "tts-audio"
17. Play audio via AudioContext           { audio: ArrayBuffer,
    + Show text in chat                     text: string }
```

## Widget audio capture

```typescript
// Key implementation details for the widget

class VoiceCapture {
  private audioContext: AudioContext;
  private stream: MediaStream;
  private processor: AudioWorkletNode;
  
  async start() {
    // 1. Get microphone access
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,       // Whisper expects 16kHz
        channelCount: 1,          // Mono
        echoCancellation: true,   // Important for speakers playing TTS
        noiseSuppression: true,
        autoGainControl: true,
      }
    });
    
    // 2. Create audio pipeline
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.stream);
    
    // 3. Use AudioWorklet for low-latency processing
    // AudioWorklet runs in a separate thread, doesn't block UI
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');
    this.processor = new AudioWorkletNode(this.audioContext, 'audio-processor');
    
    source.connect(this.processor);
    
    // 4. Processor sends 250ms chunks to main thread
    this.processor.port.onmessage = (event) => {
      const pcm16 = event.data; // Int16Array
      this.sendChunk(pcm16);
    };
  }
  
  stop() {
    this.stream.getTracks().forEach(t => t.stop());
    this.audioContext.close();
  }
}
```

## Audio processor worklet (runs in widget)

```javascript
// audio-processor.js — loaded via AudioWorklet
// This runs in a separate thread, zero UI blocking

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 4000; // 250ms at 16kHz
  }
  
  process(inputs) {
    const input = inputs[0][0]; // mono channel
    if (!input) return true;
    
    // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      this.buffer.push(s < 0 ? s * 32768 : s * 32767);
    }
    
    // Send 250ms chunks
    if (this.buffer.length >= this.bufferSize) {
      const chunk = new Int16Array(this.buffer.splice(0, this.bufferSize));
      this.port.postMessage(chunk);
    }
    
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
```

## Server-side VAD (Voice Activity Detection)

```typescript
// Simple energy-based VAD — no ML model needed for v1
// Detects when user stops speaking

class SimpleVAD {
  private silenceThreshold = 500;   // RMS energy threshold
  private silenceDuration = 600;    // ms of silence = end of utterance
  private silenceStart: number | null = null;
  private audioBuffer: Buffer[] = [];
  
  processChunk(chunk: Buffer): { complete: boolean; audio: Buffer | null } {
    this.audioBuffer.push(chunk);
    
    const rms = this.calculateRMS(chunk);
    
    if (rms < this.silenceThreshold) {
      // Silence detected
      if (!this.silenceStart) {
        this.silenceStart = Date.now();
      }
      
      if (Date.now() - this.silenceStart >= this.silenceDuration) {
        // User has stopped speaking — return complete audio
        const fullAudio = Buffer.concat(this.audioBuffer);
        this.reset();
        return { complete: true, audio: fullAudio };
      }
    } else {
      // Speech detected — reset silence timer
      this.silenceStart = null;
    }
    
    return { complete: false, audio: null };
  }
  
  private calculateRMS(chunk: Buffer): number {
    const samples = new Int16Array(chunk.buffer);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }
  
  private reset() {
    this.audioBuffer = [];
    this.silenceStart = null;
  }
}
```

## STT service (Python)

```python
# ai-service/stt.py

from faster_whisper import WhisperModel

# Load model once at startup
# "base" for fast CPU inference (~2-3s per utterance)
# "large-v3" for best accuracy (needs GPU or 10+ seconds on CPU)
model = WhisperModel("base", device="cpu", compute_type="int8")

async def transcribe(audio_bytes: bytes) -> dict:
    """Transcribe audio bytes to text with language detection."""
    
    # Save to temp file (faster-whisper needs file path)
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        temp_path = f.name
    
    try:
        segments, info = model.transcribe(
            temp_path,
            language=None,           # Auto-detect language
            beam_size=5,
            vad_filter=True,         # Filter out non-speech
            vad_parameters=dict(
                min_silence_duration_ms=300,
            ),
        )
        
        text = " ".join(segment.text for segment in segments)
        
        return {
            "text": text.strip(),
            "language": info.language,           # "hi", "en", "es", etc.
            "language_probability": info.language_probability,
            "duration": info.duration,
        }
    finally:
        os.unlink(temp_path)
```

## TTS service (Node.js with Edge-TTS)

```typescript
// server/src/voice/tts.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

// Voice mapping per language
const VOICE_MAP: Record<string, string> = {
  'hi': 'hi-IN-SwaraNeural',       // Hindi female (natural)
  'hi-male': 'hi-IN-MadhurNeural', // Hindi male
  'en': 'en-IN-NeerjaNeural',      // Indian English female
  'en-male': 'en-IN-PrabhatNeural',// Indian English male
  'es': 'es-ES-ElviraNeural',      // Spanish
  'ar': 'ar-SA-ZariyahNeural',     // Arabic
  'ta': 'ta-IN-PallaviNeural',     // Tamil
  'te': 'te-IN-ShrutiNeural',      // Telugu
  'bn': 'bn-IN-TanishaaNeural',    // Bengali
  'mr': 'mr-IN-AarohiNeural',      // Marathi
  // Add more as needed — Edge-TTS supports 300+ voices
};

export async function synthesize(
  text: string, 
  language: string
): Promise<Buffer> {
  const voice = VOICE_MAP[language] || VOICE_MAP['en'];
  const outputPath = join(tmpdir(), `tts-${randomUUID()}.mp3`);
  
  try {
    // edge-tts CLI — installed via pip install edge-tts
    await execAsync(
      `edge-tts --voice "${voice}" --text "${text.replace(/"/g, '\\"')}" --write-media "${outputPath}"`,
      { timeout: 10000 }
    );
    
    const audio = await readFile(outputPath);
    return audio;
  } finally {
    await unlink(outputPath).catch(() => {});
  }
}

// For Hinglish: detect if text is mixed, use Hindi voice
// Hindi voice handles English words within Hindi sentences well
export function detectVoice(text: string, detectedLang: string): string {
  // If language detector says Hindi but text has English words = Hinglish
  // Use Hindi voice — it handles code-switching naturally
  if (detectedLang === 'hi' || detectedLang === 'en') {
    const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    if (hindiChars / totalChars > 0.2) {
      return 'hi'; // Has enough Hindi → use Hindi voice
    }
  }
  return detectedLang;
}
```

## WebSocket handler (Server)

```typescript
// server/src/voice/socket-handler.ts

import { Server as SocketServer } from 'socket.io';

export function setupVoiceSocket(io: SocketServer) {
  io.on('connection', (socket) => {
    const vad = new SimpleVAD();
    let conversationId: string | null = null;
    
    socket.on('voice-start', (data: { conversationId: string }) => {
      conversationId = data.conversationId;
    });
    
    socket.on('audio-chunk', async (data: { audio: ArrayBuffer }) => {
      const chunk = Buffer.from(data.audio);
      const result = vad.processChunk(chunk);
      
      if (result.complete && result.audio) {
        try {
          // 1. Transcribe
          const transcript = await sttClient.transcribe(result.audio);
          socket.emit('transcript', { text: transcript.text });
          
          // 2. Get bot response (same as text flow)
          const response = await conversationService.processMessage(
            conversationId!,
            transcript.text,
            transcript.language
          );
          
          // 3. Synthesize speech
          const voice = detectVoice(response.message, transcript.language);
          const audio = await ttsService.synthesize(response.message, voice);
          
          // 4. Send back
          socket.emit('bot-response', { text: response.message, products: response.products });
          socket.emit('tts-audio', { audio: audio.buffer });
          
        } catch (error) {
          socket.emit('error', { message: 'Sorry, could you repeat that?' });
        }
      }
    });
    
    socket.on('voice-stop', () => {
      vad.reset();
    });
    
    socket.on('disconnect', () => {
      vad.reset();
    });
  });
}
```

## Interrupt handling

When the user starts speaking while the bot is still playing TTS:

1. Widget detects mic activity while TTS is playing
2. Widget immediately stops TTS playback
3. Widget sends `voice-interrupt` event to server
4. Server cancels any pending TTS generation
5. Server processes the new user audio normally

This is critical for natural conversation — users WILL interrupt, especially to say "haan haan, samajh gaya" (yes yes, I understand).

## Latency budget

| Step | Target | Free tier reality |
|------|--------|-------------------|
| Audio capture + send | 50ms | 50ms |
| STT (Whisper base, CPU) | 1500ms | 2000-3000ms |
| LLM (Gemini Flash) | 800ms | 500-1500ms |
| TTS (Edge-TTS) | 500ms | 300-800ms |
| Audio playback start | 50ms | 50ms |
| **Total** | **~3 seconds** | **3-5 seconds** |

3-5 seconds is acceptable for v1. Human phone conversations have 1-2s natural pauses. Upgrade path: Whisper on GPU cuts STT to 300ms, bringing total under 2 seconds.

## Voice mode UX rules

1. Show a pulsing animation while listening (user knows mic is active)
2. Show "Thinking..." animation during STT + LLM processing
3. Show the transcript in real-time as text in the chat
4. Show the bot's response as text WHILE it's being spoken
5. Provide a "stop" button to interrupt bot speech at any time
6. If voice fails for any reason, fall back to text mode silently
7. Never auto-activate the microphone — always require explicit user action
