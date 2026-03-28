let audioCtx: AudioContext | null = null;
let onStartCb: (() => void) | null = null;
let onEndCb: (() => void) | null = null;
let chunkBuffer: Uint8Array[] = [];
let isPlaying = false;
let playQueue: Promise<void> = Promise.resolve();

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext({ sampleRate: 16000 });
    // Play silent buffer immediately to unlock AudioContext on iOS
    const buf = audioCtx.createBuffer(1, 1, 16000);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
  }
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

export function bufferAudioChunk(base64: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  chunkBuffer.push(bytes);
}

export async function flushAudioBuffer(): Promise<void> {
  if (chunkBuffer.length === 0) return;
  const chunks = [...chunkBuffer];
  chunkBuffer = [];

  playQueue = playQueue.then(async () => {
    try {
      const ctx = getCtx();
      // Combine all chunks
      const totalBytes = chunks.reduce((acc, c) => acc + c.length, 0);
      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }

      // Convert linear16 PCM to AudioBuffer
      // Ensure even byte length for Int16Array (odd trailing byte discarded)
      const evenBytes = combined.length % 2 === 0 ? combined : combined.slice(0, combined.length - 1);
      const int16 = new Int16Array(evenBytes.buffer.slice(evenBytes.byteOffset, evenBytes.byteOffset + evenBytes.byteLength));
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = ctx.createBuffer(1, float32.length, 16000);
        audioBuffer.copyToChannel(float32, 0);
      } catch (err) {
        console.error('[audio] createBuffer error:', err, 'float32 length:', float32.length);
        return;
      }

      if (!isPlaying) { isPlaying = true; onStartCb?.(); }

      await new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start(0);
      });
    } catch (err) {
      console.error('[audio] playback error:', err);
    } finally {
      if (chunkBuffer.length === 0) { isPlaying = false; onEndCb?.(); }
    }
  });
  return playQueue;
}

// Legacy compatibility
export async function playAudioChunk(base64: string): Promise<void> {
  bufferAudioChunk(base64);
  await flushAudioBuffer();
}
