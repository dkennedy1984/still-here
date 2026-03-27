import { WebSocket } from 'ws';
import { prisma } from '../lib/prisma';

type AgentState = 'GREETING' | 'SILENT_PRESENCE' | 'LISTENING' | 'THINKING' | 'RESPONDING' | 'ENDED';
type PresenceStyle = 'quiet' | 'check-ins' | 'talk';

const SAFETY_KEYWORDS = ['kill myself','end my life','want to die','suicide','self harm','hurt myself','not worth living',"can't go on"];

export class AgentStateMachine {
  private state: AgentState = 'GREETING';
  private style: PresenceStyle = 'quiet';
  private audioChunks: Buffer[] = [];
  private audioTimer: NodeJS.Timeout | null = null;
  private currentMimeType = 'audio/l16';
  private checkInTimer: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private hasGreeted = false;
  private readonly voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  private readonly modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';

  constructor(private ws: WebSocket, private callId: string, private sessionId: string) {}

  async start() {
    if (this.hasGreeted) return;
    this.hasGreeted = true;
    this.send({ type: 'connected', state: this.state });
    await this.speak("Hi. I'm here.");
    await this.sleep(800);
    await this.speak("You don't have to talk. We can just sit quietly.");
    this.transition('SILENT_PRESENCE');
    this.resetCheckInTimer();
  }

  handleAudio(chunk: Buffer, mimeType: string) {
    if (this.state === 'ENDED' || this.state === 'RESPONDING') return;
    this.audioChunks.push(chunk);
    this.currentMimeType = mimeType;
    if (this.audioTimer) clearTimeout(this.audioTimer);
    this.audioTimer = setTimeout(() => this.flushAudio(), 10000);
  }

  async handleSpeechEnd() {
    if (this.audioTimer) { clearTimeout(this.audioTimer); this.audioTimer = null; }
    await this.flushAudio();
  }

  private async flushAudio() {
    if (this.audioChunks.length === 0) return;
    if (this.state === 'ENDED' || this.state === 'RESPONDING') return;
    const audio = Buffer.concat(this.audioChunks);
    this.audioChunks = [];
    if (audio.length < 5000) { this.transition('LISTENING'); return; }
    this.transition('THINKING');
    console.log('[stt] sending', audio.length, 'bytes to Deepgram');
    try {
      console.time('[stt] transcribe');
      const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en-GB&punctuate=true&encoding=linear16&sample_rate=16000&channels=1', {
        method: 'POST',
        headers: {
          'Authorization': 'Token ' + process.env.DEEPGRAM_API_KEY,
          'Content-Type': 'audio/l16',
        },
        body: audio,
      });
      const json = await res.json() as any;
      console.timeEnd('[stt] transcribe');
      if (!res.ok) { console.error('[stt] Deepgram error:', res.status, JSON.stringify(json)); this.transition('SILENT_PRESENCE'); return; }
      const transcript = json?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || '';
      console.log('[stt] transcript:', JSON.stringify(transcript));
      if (transcript) { await this.onTranscript(transcript); } else { this.transition('LISTENING'); }
    } catch (err) {
      console.error('[stt] fetch error:', err);
      this.transition('SILENT_PRESENCE');
    }
  }

  private async onTranscript(transcript: string) {
    const lower = transcript.toLowerCase();
    if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
      await this.speak("I hear you, and I am glad you said something. Please reach out to Samaritans on 116 123, available any time.");
      this.transition('SILENT_PRESENCE');
      return;
    }
    this.clearCheckInTimer();
    this.transition('RESPONDING');
    try {
      console.time('[llm] respond');
      const reply = await this.getLLMReply(transcript);
      console.timeEnd('[llm] respond');
      console.time('[tts] speak');
      await this.speak(reply);
      console.timeEnd('[tts] speak');
    } catch (err) { console.error('[llm] error:', err); }
    this.transition('SILENT_PRESENCE');
    this.resetCheckInTimer();
  }

  private async getLLMReply(userMessage: string): Promise<string> {
    const styleNote = this.style === 'talk' ? 'The user has chosen to talk freely.' : this.style === 'check-ins' ? 'The user has opted in to gentle check-ins.' : 'The user prefers quiet. Respond very briefly.';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini', max_tokens: 60, temperature: 0.6,
        messages: [
          { role: 'system', content: 'You are a calm, quiet body-doubling companion for someone who may have ADHD. Maximum 2 sentences. Never directive. Never mention productivity. Never fill silence. Never ask what they are working on. Respond in British English. ' + styleNote },
          { role: 'user', content: userMessage }
        ]
      }),
    });
    const json = await res.json() as any;
    if (!res.ok) { console.error('[llm] OpenAI error:', res.status, JSON.stringify(json)); }
    console.log('[llm] response:', JSON.stringify(json.choices?.[0]?.message?.content));
    return json.choices?.[0]?.message?.content?.trim() || "I hear you. I'm still here.";
  }

  private async speak(text: string) {
    console.log('[tts] speaking:', text);
    const start = Date.now();
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + this.voiceId + '/stream', {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: this.modelId,
          voice_settings: { stability: 0.75, similarity_boost: 0.75, style: 0.0, use_speaker_boost: false },
          output_format: 'mp3_44100_128',
        }),
      });
      if (!res.ok) { console.error('[tts] error:', res.status, await res.text()); return; }
      // Stream chunks as they arrive instead of buffering entire response
      const reader = res.body!.getReader();
      let chunkIndex = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length > 0) {
          this.send({ type: 'audio_out', data: Buffer.from(value).toString('base64'), mimeType: 'audio/mpeg', chunkIndex: chunkIndex++ });
        }
      }
      this.send({ type: 'audio_out_done' });
      console.log('[tts] done in', Date.now() - start, 'ms');
    } catch (err) { console.error('[tts] error:', err); }
  }

  setStyle(style: PresenceStyle) { this.style = style; this.resetCheckInTimer(); }

  private resetCheckInTimer() {
    this.clearCheckInTimer();
    if (this.style !== 'check-ins') return;
    const ms = parseInt(process.env.CHECK_IN_TIMEOUT_MS || '1500000', 10);
    this.checkInTimer = setTimeout(async () => {
      if (this.state !== 'SILENT_PRESENCE') return;
      await this.speak('Still here.');
      this.resetCheckInTimer();
    }, ms);
  }

  private clearCheckInTimer() { if (this.checkInTimer) { clearTimeout(this.checkInTimer); this.checkInTimer = null; } }

  private transition(next: AgentState) {
    console.log('[agent]', this.state, '->', next);
    this.state = next;
    this.send({ type: 'agent_state', state: next });
  }

  private send(payload: Record<string, unknown>) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  private sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async end() {
    if (this.state === 'ENDED') return;
    this.clearCheckInTimer();
    if (this.audioTimer) clearTimeout(this.audioTimer);
    this.transition('ENDED');
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    await prisma.call.update({ where: { id: this.callId }, data: { endedAt: new Date(), durationSeconds: duration } }).catch(() => {});
  }
}
