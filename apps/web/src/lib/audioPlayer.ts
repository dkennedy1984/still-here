let audioCtx: AudioContext | null = null;
let onStartCb: (() => void) | null = null;
let onEndCb: (() => void) | null = null;
let chunkBuffer: Uint8Array[] = [];
let isPlaying = false;
let playQueue: Promise<void> = Promise.resolve();

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    // Use 'playback' category to route to speaker not earpiece
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'interactive',
    });
    // Play silent buffer to initialise audio path through speaker
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

export function setAudioCallbacks(onStart: () => void, onEnd: () => void) {
  onStartCb = onStart;
  onEndCb = onEnd;
}

export function stopAudioPlayback() {
  chunkBuffer = [];
  isPlaying = false;
  playQueue = Promise.resolve();
  onEndCb?.();
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
      const totalBytes = chunks.reduce((a, c) => a + c.length, 0);
      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const c of chunks) { combined.set(c, offset); offset += c.length; }
      const audioBuffer = await ctx.decodeAudioData(combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength) as ArrayBuffer);
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
