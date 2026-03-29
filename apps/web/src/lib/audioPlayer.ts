let onStartCb: (() => void) | null = null;
let onEndCb: (() => void) | null = null;
let chunkBuffer: Uint8Array[] = [];
let isPlaying = false;
let playQueue: Promise<void> = Promise.resolve();

export function setAudioCallbacks(onStart: () => void, onEnd: () => void) {
  onStartCb = onStart;
  onEndCb = onEnd;
}

export function resetAudioPlayer() {
  chunkBuffer = [];
  isPlaying = false;
  playQueue = Promise.resolve();
}

export function stopAudioPlayback() {
  chunkBuffer = [];
  isPlaying = false;
  playQueue = Promise.resolve();
  onEndCb?.();
}

export function getCtx(): null {
  return null; // No longer using AudioContext
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
      // Combine all chunks into one buffer
      const totalBytes = chunks.reduce((a, c) => a + c.length, 0);
      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const c of chunks) { combined.set(c, offset); offset += c.length; }

      // Create a Blob and Object URL from the mp3 data
      const blob = new Blob([combined], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      if (!isPlaying) { isPlaying = true; onStartCb?.(); }

      // Play through HTML Audio element — ALWAYS routes to speaker on mobile
      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(url);
        audio.setAttribute('playsinline', 'true');
        audio.volume = 1.0;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = (e) => {
          URL.revokeObjectURL(url);
          console.error('[audio] playback error:', e);
          reject(e);
        };

        audio.play().catch(err => {
          URL.revokeObjectURL(url);
          console.error('[audio] play failed:', err);
          reject(err);
        });
      });
    } catch (err) {
      console.error('[audio] playback error:', err);
    } finally {
      if (chunkBuffer.length === 0) { isPlaying = false; onEndCb?.(); }
    }
  });
  return playQueue;
}

export async function playAudioChunk(base64: string): Promise<void> {
  bufferAudioChunk(base64);
  await flushAudioBuffer();
}
