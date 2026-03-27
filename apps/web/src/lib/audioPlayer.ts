let audioCtx: AudioContext | null = null;
let onStartCb: (() => void) | null = null;
let onEndCb: (() => void) | null = null;
let chunkBuffer: Uint8Array[] = [];
let isPlaying = false;
let playQueue: Promise<void> = Promise.resolve();

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setAudioCallbacks(onStart: () => void, onEnd: () => void) {
  onStartCb = onStart;
  onEndCb = onEnd;
}

export function resetAudioPlayer() {
  chunkBuffer = [];
  isPlaying = false;
  playQueue = Promise.resolve();
}

/** Buffer a single base64 chunk — does not play yet. */
export function bufferAudioChunk(base64: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  chunkBuffer.push(bytes);
}

/**
 * Flush all buffered chunks as a single decoded audio buffer.
 * Call this when audio_out_done is received.
 * Concatenating before decode is critical: MP3 frames split across separate
 * decodeAudioData calls produce garbage or throw EncodingError.
 */
export async function flushAudioBuffer(): Promise<void> {
  if (chunkBuffer.length === 0) return;

  const chunks = chunkBuffer;
  chunkBuffer = [];

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  playQueue = playQueue.then(async () => {
    try {
      const ctx = getCtx();
      // slice(0) creates a detached copy so decodeAudioData can take ownership
      const audioBuffer = await ctx.decodeAudioData(combined.buffer.slice(0) as ArrayBuffer);

      if (!isPlaying) {
        isPlaying = true;
        onStartCb?.();
      }

      await new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start(0);
      });
    } catch (err) {
      console.error('[audio] decode error:', err);
    } finally {
      if (chunkBuffer.length === 0) {
        isPlaying = false;
        onEndCb?.();
      }
    }
  });

  return playQueue;
}

/** Legacy alias kept for any callers that still use playAudioChunk directly. */
export async function playAudioChunk(base64: string): Promise<void> {
  bufferAudioChunk(base64);
}
