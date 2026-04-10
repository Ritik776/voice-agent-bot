import { Server as SocketServer } from 'socket.io';
import { SimpleVAD } from './vad';
import { transcribe } from './stt-client';
import { synthesize, detectVoice } from './tts';
import { processMessage } from '../services/conversation';

export function setupVoiceSocket(io: SocketServer): void {
  io.on('connection', (socket) => {
    const vad = new SimpleVAD();
    let conversationId: string | null = null;
    let isProcessing = false;

    socket.on('voice-start', (data: { conversationId: string }) => {
      conversationId = data.conversationId;
      vad.reset();
      console.log(`[Voice] Session started for conversation ${conversationId}`);
    });

    socket.on('audio-chunk', async (data: { audio: ArrayBuffer }) => {
      if (!conversationId || isProcessing) return;

      const chunk = Buffer.from(data.audio);
      const result = vad.processChunk(chunk);

      if (result.complete && result.audio) {
        isProcessing = true;

        try {
          // 1. Transcribe speech to text
          socket.emit('processing', { stage: 'transcribing' });
          const transcript = await transcribe(result.audio);

          if (!transcript.text) {
            isProcessing = false;
            return;
          }

          socket.emit('transcript', {
            text: transcript.text,
            language: transcript.language,
          });

          // 2. Get bot response via conversation service
          socket.emit('processing', { stage: 'thinking' });
          const response = await processMessage(
            conversationId,
            transcript.text,
            transcript.language
          );

          socket.emit('bot-response', {
            text: response.message,
            products: response.products,
            state: response.state,
          });

          // 3. Synthesize speech
          socket.emit('processing', { stage: 'speaking' });
          try {
            const voiceLang = detectVoice(response.message, transcript.language);
            const audio = await synthesize(response.message, voiceLang);

            socket.emit('tts-audio', {
              audio: audio.buffer.slice(
                audio.byteOffset,
                audio.byteOffset + audio.byteLength
              ),
              text: response.message,
            });
          } catch {
            console.warn('[Voice] TTS failed, sending text only');
          }
        } catch (error) {
          console.error('[Voice] Processing error:', error);
          socket.emit('error', { message: 'Sorry, could you repeat that?' });
        } finally {
          isProcessing = false;
        }
      }
    });

    socket.on('voice-interrupt', () => {
      // User interrupted — reset VAD, stop processing
      vad.reset();
      console.log('[Voice] User interrupted');
    });

    socket.on('voice-stop', () => {
      vad.reset();
      conversationId = null;
      console.log('[Voice] Session ended');
    });

    socket.on('disconnect', () => {
      vad.reset();
    });
  });
}
