/**
 * Text-to-Speech service.
 *
 * Tries providers in order based on which API keys are configured:
 * 1. ElevenLabs (ELEVENLABS_API_KEY)
 * 2. OpenAI (OPENAI_API_KEY)
 * 3. Deepgram (DEEPGRAM_API_KEY)
 *
 * Returns base64-encoded audio (mp3) for "audio_out" WebSocket messages.
 */

const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";

export async function synthesizeSpeech(text: string): Promise<string> {
  if (!text.trim()) return "";

  if (process.env.ELEVENLABS_API_KEY) return synthesizeElevenLabs(text);
  if (process.env.OPENAI_API_KEY) return synthesizeOpenAI(text);
  if (process.env.DEEPGRAM_API_KEY) return synthesizeDeepgram(text);

  console.warn("[tts] No TTS API key found. Set ELEVENLABS_API_KEY, OPENAI_API_KEY, or DEEPGRAM_API_KEY.");
  return "";
}

async function synthesizeElevenLabs(text: string): Promise<string> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  if (!res.ok) {
    console.error(`[tts] ElevenLabs ${res.status}: ${await res.text()}`);
    return "";
  }
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

async function synthesizeOpenAI(text: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: process.env.OPENAI_TTS_VOICE || "nova",
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    console.error(`[tts] OpenAI TTS ${res.status}: ${await res.text()}`);
    return "";
  }
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

async function synthesizeDeepgram(text: string): Promise<string> {
  const res = await fetch(
    "https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mp3",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );
  if (!res.ok) {
    console.error(`[tts] Deepgram ${res.status}: ${await res.text()}`);
    return "";
  }
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}
