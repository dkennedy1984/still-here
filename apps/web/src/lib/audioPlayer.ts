let audioCtx: AudioContext | null = null;
let nextStartTime = 0;
let onStartCb: (() => void) | null = null;
let onEndCb: (() => void) | null = null;
let activeBuffers = 0;

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
    nextStartTime = 0;
  }
  return audioCtx;
}

export function setAudioCallbacks(onStart: () => void, onEnd: () => void) {
  onStartCb = onStart;
  onEndCb = onEnd;
}

export async function playAudioChunk(base64: string): Promise<void> {
  try {
    const ctx = getCtx();
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const audioBuffer = await ctx.decodeAudioData(bytes.buffer as ArrayBuffer);

    if (activeBuffers === 0) onStartCb?.();
    activeBuffers++;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, nextStartTime);
    source.start(startAt);
    nextStartTime = startAt + audioBuffer.duration;

    source.onended = () => {
      activeBuffers--;
      if (activeBuffers === 0) onEndCb?.();
    };
  } catch (err) {
    console.error('[audio] playback error:', err);
  }
}

export function resetAudioPlayer() {
  nextStartTime = 0;
  activeBuffers = 0;
}
