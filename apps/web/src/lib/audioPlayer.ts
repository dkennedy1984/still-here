let audioCtx: AudioContext | null = null;
let onStartCb: (() => void) | null = null;
let onEndCb: (() => void) | null = null;
let chunkBuffer: Uint8Array[] = [];
let isPlaying = false;
let playQueue: Promise<void> = Promise.resolve();

export function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    // Try to reuse the AudioContext created on Call button tap
    // This ensures we're on the media playback route, not voice call route
    if (typeof window !== 'undefined' && (window as any).__swyAudioCtx) {
      audioCtx = (window as any).__swyAudioCtx;
      (window as any).__swyAudioCtx = null;
    } else {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive',
      });
    }
    // Play 1 second of silence to keep the route active
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

      const audioBuffer = await ctx.decodeAudioData(combined.buffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      if (!isPlaying) {
        isPlaying = true;
        onStartCb?.();
      }

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start(0);
      });
    } catch (e) {
      console.error('[audioPlayer] decode/play error', e);
    }
  }).then(() => {
    if (chunkBuffer.length === 0 && isPlaying) {
      isPlaying = false;
      onEndCb?.();
    }
  });
}
