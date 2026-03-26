/**
 * Text-to-Speech service stub.
 *
 * Replace the implementation of synthesizeSpeech() with your chosen TTS
 * provider (e.g. ElevenLabs, Google Cloud TTS, OpenAI TTS).
 *
 * The function receives a text string and must return a base64-encoded
 * audio string (the same format the client expects in "audio_out" messages).
 *
 * Until a real provider is wired up, this module logs the text and returns
 * an empty string so the rest of the pipeline keeps working without errors.
 */

export async function synthesizeSpeech(text: string): Promise<string> {
  // TODO: Replace with actual TTS provider call.
  // Example for ElevenLabs:
  //
  //   const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
  //     method: "POST",
  //     headers: {
  //       "xi-api-key": process.env.ELEVENLABS_API_KEY!,
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({ text, model_id: "eleven_monolingual_v1" }),
  //   });
  //   const buffer = Buffer.from(await res.arrayBuffer());
  //   return buffer.toString("base64");

  console.log(`[tts] synthesizeSpeech called with: "${text}" (stub — no audio generated)`);
  return "";
}
