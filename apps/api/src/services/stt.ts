/**
 * Speech-to-Text service.
 *
 * Tries providers in order:
 * 1. Deepgram Nova-2 (DEEPGRAM_API_KEY) — cheapest at $0.0043/min
 * 2. OpenAI Whisper (OPENAI_API_KEY) — $0.006/min
 *
 * Accepts an array of base64-encoded webm/opus audio chunks and returns a
 * transcript string.  Callers may also pass a single base64 string for
 * backward compatibility.
 */

export async function transcribeAudio(
  audioInput: string | string[],
  mimeType = "audio/webm;codecs=opus"
): Promise<string> {
  // Normalise to a single Buffer regardless of input shape
  const audioBuffer = Array.isArray(audioInput)
    ? Buffer.concat(audioInput.filter(Boolean).map((c) => Buffer.from(c, "base64")))
    : Buffer.from(audioInput, "base64");

  if (audioBuffer.length === 0) return "";

  if (process.env.DEEPGRAM_API_KEY) return transcribeDeepgram(audioBuffer, mimeType);
  if (process.env.OPENAI_API_KEY) return transcribeWhisper(audioBuffer);

  console.warn("[stt] No STT API key found. Set DEEPGRAM_API_KEY or OPENAI_API_KEY.");
  return "";
}

async function transcribeDeepgram(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&language=en-GB&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": mimeType,
      },
      body: audioBuffer,
    }
  );

  if (!res.ok) {
    console.error(`[stt] Deepgram ${res.status}: ${await res.text()}`);
    return "";
  }

  const data = (await res.json()) as {
    results?: {
      channels?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
    };
  };
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}

async function transcribeWhisper(audioBuffer: Buffer): Promise<string> {
  // Whisper API expects multipart form data
  const blob = new Blob([audioBuffer], { type: "audio/webm" });
  const formData = new FormData();
  formData.append("file", blob, "audio.webm");
  formData.append("model", "whisper-1");
  formData.append("language", "en");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!res.ok) {
    console.error(`[stt] Whisper ${res.status}: ${await res.text()}`);
    return "";
  }

  const data = (await res.json()) as { text?: string };
  return data.text || "";
}
