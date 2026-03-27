let audioContext: AudioContext | null = null;
let nextStartTime = 0;
const pendingChunks: Uint8Array[] = [];

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

// Buffer a streamed chunk (called on each audio_out message)
export function bufferAudioChunk(base64: string): void {
  pendingChunks.push(base64ToBytes(base64));
}

// Concatenate all buffered chunks and play (called on audio_out_done)
export async function flushAudioBuffer(): Promise<void> {
  if (pendingChunks.length === 0) return;

  // Concatenate all chunks into a single buffer
  const totalLength = pendingChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of pendingChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  pendingChunks.length = 0;

  try {
    const ctx = getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(combined.buffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const currentTime = ctx.currentTime;
    const startTime = Math.max(currentTime, nextStartTime);
    source.start(startTime);
    nextStartTime = startTime + audioBuffer.duration;
  } catch (err) {
    console.error("Audio playback error:", err);
  }
}

// Legacy: play a single complete audio chunk (for backwards compat)
export function playAudioChunk(base64: string): void {
  bufferAudioChunk(base64);
  flushAudioBuffer();
}
