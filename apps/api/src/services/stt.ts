/**
 * Speech-to-Text service.
 *
 * Tries providers in order:
 * 1. Deepgram Nova-2 (DEEPGRAM_API_KEY) — cheapest at $0.0043/min
 * 2. OpenAI Whisper (OPENAI_API_KEY) — $0.006/min
 *
 * Accepts a base64-encoded webm/opus audio blob and returns a transcript string.
 */

export async function transcribeAudio(base64Audio: string): Promise<string> {
  if (!base64Audio) return "";

  if (process.env.DEEPGRAM_API_KEY) return transcribeDeepgram(base64Audio);
  if (process.env.OPENAI_API_KEY) return transcribeWhisper(base64Audio);

  console.warn("[stt] No STT API key found. Set DEEPGRAM_API_KEY or OPENAI_API_KEY.");
  return "";
}

async function transcribeDeepgram(base64Audio: string): Promise<string> {
  const audioBuffer = Buffer.from(base64Audio, "base64");

  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "audio/webm",
      },
      body: audioBuffer,
    }
  );

  if (!res.ok) {
    console.error(`[stt] Deepgram ${res.status}: ${await res.text()}`);
    return "";
  }

  const data = await res.json() as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
  };
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}

async function transcribeWhisper(base64Audio: string): Promise<string> {
  const audioBuffer = Buffer.from(base64Audio, "base64");

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

  const data = await res.json() as { text?: string };
  return data.text || "";
}
