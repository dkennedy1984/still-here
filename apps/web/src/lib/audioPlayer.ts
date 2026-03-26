let audioContext: AudioContext | null = null;
let nextStartTime = 0;
const queue: string[] = [];
let isProcessing = false;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const base64 = queue.shift()!;
    try {
      const ctx = getAudioContext();

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
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

  isProcessing = false;
}

export function playAudioChunk(base64: string): void {
  queue.push(base64);
  processQueue();
}
