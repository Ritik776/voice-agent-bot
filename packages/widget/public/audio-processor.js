/**
 * AudioWorklet processor — runs in a separate thread, zero UI blocking.
 * Captures mic audio, converts to Int16, sends 250ms chunks to main thread.
 */
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
      this.port.postMessage(chunk.buffer, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
