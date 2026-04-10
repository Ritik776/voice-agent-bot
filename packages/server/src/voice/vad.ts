/**
 * Simple energy-based Voice Activity Detection.
 * Detects when the user stops speaking by monitoring silence duration.
 */
export class SimpleVAD {
  private silenceThreshold = 500;
  private silenceDuration = 600; // ms of silence = end of utterance
  private silenceStart: number | null = null;
  private audioBuffer: Buffer[] = [];

  processChunk(chunk: Buffer): { complete: boolean; audio: Buffer | null } {
    this.audioBuffer.push(chunk);

    const rms = this.calculateRMS(chunk);

    if (rms < this.silenceThreshold) {
      if (!this.silenceStart) {
        this.silenceStart = Date.now();
      }

      if (Date.now() - this.silenceStart >= this.silenceDuration) {
        const fullAudio = Buffer.concat(this.audioBuffer);
        this.reset();
        // Only return if we have meaningful audio (>0.5s at 16kHz 16bit)
        if (fullAudio.length > 16000) {
          return { complete: true, audio: fullAudio };
        }
        return { complete: false, audio: null };
      }
    } else {
      this.silenceStart = null;
    }

    return { complete: false, audio: null };
  }

  private calculateRMS(chunk: Buffer): number {
    const samples = new Int16Array(
      chunk.buffer,
      chunk.byteOffset,
      chunk.byteLength / 2
    );
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  reset(): void {
    this.audioBuffer = [];
    this.silenceStart = null;
  }
}
