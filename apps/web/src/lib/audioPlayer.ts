let audioContext: AudioContext | null = null;
let nextStartTime = 0;

let activeCount = 0;
let onStartCallback: (() => void) | null = null;
let onEndCallback: (() => void) | null = null;

export function setAudioCallbacks(
  onStart: () => void,
  onEnd: () => void
): void {
  onStartCallback = onStart;
  onEndCallback = onEnd;
}

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Decode and schedule a chunk for immediate sequential playback.
// Fires onStart when the first chunk of a new burst begins,
// and onEnd only after the LAST chunk in that burst finishes playing.
export function bufferAudioChunk(base64: string): void {
  const bytes = base64ToBytes(base64);

  // Signal "speaking started" on the very first queued chunk
  if (activeCount === 0) {
    onStartCallback?.();
  }
  activeCount++;

  const ctx = getAudioContext();

  ctx.decodeAudioData(bytes.buffer as ArrayBuffer).then((audioBuffer) => {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextStartTime);
    source.start(startTime);
    nextStartTime = startTime + audioBuffer.duration;

    // When this chunk finishes playing in the browser
    source.onended = () => {
      activeCount--;
      if (activeCount === 0) {
        onEndCallback?.();
        // Reset scheduling baseline so next utterance starts cleanly
        nextStartTime = 0;
      }
    };
  }).catch((err) => {
    console.error("[audioPlayer] decodeAudioData error:", err);
    activeCount--;
    if (activeCount === 0) {
      onEndCallback?.();
      nextStartTime = 0;
    }
  });
}

// Called on audio_out_done — nothing to do here anymore,
// playback is already scheduled chunk-by-chunk above.
// Kept for backwards compat so callers don't break.
export function flushAudioBuffer(): void {
  // no-op: chunks are scheduled individually as they arrive
}

// Legacy alias
export function playAudioChunk(base64: string): void {
  bufferAudioChunk(base64);
}
