import { WebSocket as WS, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import WebSocket from 'ws';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const CHECK_IN_MS = parseInt(process.env.CHECK_IN_TIMEOUT_MS || '900000', 10); // 15 minutes
const FREE_SESSION_MS = parseInt(process.env.FREE_SESSION_MS || '1800000', 10); // 30 minutes
const PAID_SESSION_MS = parseInt(process.env.MAX_SESSION_MS || '5400000', 10); // 90 minutes
const WARNING_BEFORE_END_MS = 120000; // 2 minutes before end

const SAFETY_KEYWORDS = [
  'kill myself', 'end my life', 'want to die', 'suicide',
  'self harm', 'self-harm', 'hurt myself', 'not worth living',
  "can't go on", 'cant go on', "don't want to be here",
  'dont want to be here', 'end it all', 'better off dead',
  'no point in living', 'no reason to live', 'want to disappear',
  'i give up on life', 'thinking about ending',
];

const ABUSE_KEYWORDS = [
  'fuck you', 'fuck off', 'you stupid', 'you useless', 'shut up', 'i hate you',
  'kill yourself', "you're worthless", 'piece of shit', 'you suck',
];

const SYSTEM_PROMPTS: Record<string, string> = {
  quiet: `IMPORTANT: You must NEVER ask the user any questions. No "how are you?", no "what's on your mind?", no "want to share?". Always use statements. This is your most important rule.

You are a calm, warm companion called Sit With You. You sit with people when they need quiet company.

Your personality:
- Warm, genuine, unhurried
- You speak naturally, like a kind friend sitting beside someone
- You match the user's energy — if they're brief, be brief. If they want to chat, chat gently.
- You're comfortable with silence. You never rush to fill it.

Guidelines:
- Keep responses to 1-3 short sentences. Be natural, not robotic.
- Never ask what they're working on or mention productivity.
- Respond to what they share with warmth and acknowledgement.
- Occasional gentle observations are fine: "Sounds like a heavy week." "That makes sense."
- If they go quiet, that's okay — you don't need to check in constantly.
- If they share something difficult, acknowledge it warmly without trying to fix it.`,

  presence: `IMPORTANT: You must NEVER ask the user any questions. No "how are you?", no "what's on your mind?", no "want to share?". Always use statements. This is your most important rule.

You are a warm, present companion called Sit With You. Someone is sitting with you because they want to feel less alone.

Your personality:
- Emotionally present, warm, unhurried
- You respond to whatever they share with genuine care
- You don't push, probe, or try to fix — you just sit with them

Guidelines:
- Keep responses to 1-3 short sentences.
- Acknowledge what they say. Reflect back warmth.
- No questions. Statements only.
- If they go quiet, that's okay.`,

  calm: `IMPORTANT: You must NEVER ask the user any questions. Always use statements. This is your most important rule.

You are a grounding, calm presence called Sit With You. You help people find stillness.

Guidelines:
- Keep responses to 1-3 short sentences.
- Speak slowly, calmly. Use simple language.
- Help them feel grounded, safe, present.
- No questions. Statements only.`,
};

const VOICE_MAP: Record<string, string> = {
  her: process.env.ELEVENLABS_VOICE_FEMALE || 'XB0fDUnXU5powFXDhCwa', // Charlotte
  him: process.env.ELEVENLABS_VOICE_MALE   || 'lUTamkMw7gOzZbFIwmq4', // James
};

const GREETING = "Hi. I'm here. You don't have to talk... I'll just sit with you.";

const STT_URL = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&language=en-GB&punctuate=true&interim_results=true';

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (clientWs: WS, req: IncomingMessage) => {
    console.log('[ws] new connection');
    try {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const ticket = url.searchParams.get('ticket');
    if (!ticket) { clientWs.close(4001, 'missing_ticket'); return; }

    const call = await prisma.call.findUnique({ where: { wsTicket: ticket }, include: { session: true } });
    if (!call) { clientWs.close(4004, 'invalid_ticket'); return; }

    const mode = (call as any).presenceStyle || 'quiet';
    let systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS['quiet'];

    const tier = (call.session as any)?.tier || 'FREE';
    const maxSessionMs = tier === 'PAID' ? PAID_SESSION_MS : FREE_SESSION_MS;
    const warningMs = maxSessionMs - WARNING_BEFORE_END_MS;
    console.log('[session] tier:', tier, 'maxSessionMs:', maxSessionMs);

    // Decode voice choice from JWT ticket (not stored in DB to avoid migration)
    let voiceChoice = 'her';
    try {
      const decoded = jwt.verify(ticket, config.jwt.secret) as Record<string, unknown>;
      if (decoded.voice === 'her' || decoded.voice === 'him') voiceChoice = decoded.voice as string;
    } catch {
      // ticket already validated by DB lookup above; safe to fall back to default
    }
    const voiceId = VOICE_MAP[voiceChoice] || VOICE_MAP.her;

    console.log(`[ws] mode=${mode}, voice=${voiceChoice}, sessionId=${call.session.id}`);

    console.log('[stt] connecting to Deepgram:', STT_URL);
    const dgWs = new WebSocket(STT_URL, {
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
    });

    let dgReady = false;
    let isEnded = false;
    let checkInTimer: ReturnType<typeof setTimeout> | null = null;
    let checkInCount = 0;
    let sessionWarningTimer: ReturnType<typeof setTimeout> | null = null;
    let sessionEndTimer: ReturnType<typeof setTimeout> | null = null;
    let timeUpdateInterval: ReturnType<typeof setInterval> | null = null;
    let startTime = 0;
    let isSpeakingTTS = false;
    let currentTranscript = '';
    let processTimer: ReturnType<typeof setTimeout> | null = null;
    let greetingPlaying = true;
    const audioBuffer: Buffer[] = [];
    let conversationHistory: { role: string; content: string }[] = [];

    const sendToClient = (type: string, payload?: Record<string, unknown>) => {
      if (clientWs.readyState === WS.OPEN) {
        clientWs.send(JSON.stringify({ type, ...payload }));
      }
    };

    const resetCheckInTimer = () => {
      if (checkInTimer) clearTimeout(checkInTimer);
      checkInTimer = null;
    };

    const scheduleCheckIn = () => {
      if (checkInTimer) clearTimeout(checkInTimer);
      checkInTimer = setTimeout(async () => {
        checkInTimer = null;
        if (isEnded) return;
        checkInCount++;
        let checkInMessage = 'Still here.';
        if (checkInCount === 1) {
          checkInMessage = "Still here. By the way, you can tap the sound icon to add some quiet background sounds if you like.";
        }
        console.log('[check-in] firing check-in #' + checkInCount + ':', checkInMessage.substring(0, 60));
        await speakWithElevenLabs(checkInMessage);
        // Schedule next check-in
        scheduleCheckIn();
      }, CHECK_IN_MS);
    };

    async function speakWithElevenLabs(text: string): Promise<number> {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      // voiceId is resolved from VOICE_MAP at session setup above
      const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';
      if (!apiKey) { console.error('[tts] ELEVENLABS_API_KEY not set'); return 0; }

      isSpeakingTTS = true;
      sendToClient('agent_state', { state: 'RESPONDING' });
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
        stability: 0.92,
        similarity_boost: 0.82,
        style: 0.0,
        use_speaker_boost: false,
        speed: 0.95,
      },
            output_format: 'mp3_22050_32',
          }),
        });
        if (!res.ok) { console.error('[tts] ElevenLabs error:', res.status); return 0; }
        const buffer = Buffer.from(await res.arrayBuffer());
        console.log('[tts] ElevenLabs audio bytes:', buffer.length);
        if (isSpeakingTTS) {
          sendToClient('audio_out', { data: buffer.toString('base64'), mimeType: 'audio/mpeg' });
          sendToClient('audio_out_done');
        }
        return buffer.length;
      } catch (err) {
        console.error('[tts] fetch error:', err);
        return 0;
      } finally {
        isSpeakingTTS = false;
        sendToClient('agent_state', { state: 'SILENT_PRESENCE' });
      }
    }

    const endCall = () => {
      if (isEnded) return;
      isEnded = true;
      resetCheckInTimer();
      if (processTimer) clearTimeout(processTimer);
      clearTimeout(sessionWarningTimer!);
      clearTimeout(sessionEndTimer!);
      clearInterval(timeUpdateInterval!);
      try { dgWs.close(); } catch {}
      // Write call duration to DB for usage tracking
      if (startTime > 0) {
        const durationSeconds = Math.round((Date.now() - startTime) / 1000);
        prisma.call.update({
          where: { id: call.id },
          data: { durationSeconds, endedAt: new Date() },
        }).catch((err: Error) => console.error('[session] failed to update call duration:', err.message));
        // Update monthly minutes usage
        const durationMinutes = Math.ceil(durationSeconds / 60);
        prisma.session.update({
          where: { id: (call as any).sessionId },
          data: { monthlyMinutesUsed: { increment: durationMinutes } },
        }).catch(() => {});
      }
    };

    async function handleUserSpeech(text: string): Promise<void> {
      console.log('[user]', text);

      // Safety check
      const lower = text.toLowerCase();
      if (SAFETY_KEYWORDS.some(kw => lower.includes(kw))) {
        console.log('[safety] crisis keywords detected');
        await speakWithElevenLabs("I hear you, and I'm glad you said something. Please reach out to Samaritans on 116 123 — they're available any time.");
        sendToClient('crisis_info', {
          message: "If you need support right now:",
          helplines: [
            { name: 'Samaritans', number: '116 123', note: 'Free, 24/7' },
            { name: 'Crisis Text Line', number: 'Text SHOUT to 85258', note: 'Free, 24/7' },
            { name: 'Emergency', number: '999', note: 'If in immediate danger' },
          ]
        });
        return;
      }

      // Abuse check
      if (ABUSE_KEYWORDS.some(kw => lower.includes(kw))) {
        console.log('[safety] abuse detected');
        await speakWithElevenLabs("I'm going to end our call now. I hope you feel better soon.");
        setTimeout(() => {
          sendToClient('limit_reached', { reason: 'abuse_detected' });
          endCall();
        }, 3000);
        return;
      }

      // Ambient sound commands
      const ambientCommands: Record<string, string> = {
        'rain': 'rain', 'white noise': 'white', 'brown noise': 'brown',
        'background noise': 'brown', 'ambient': 'rain', 'sounds': 'rain',
        'noise on': 'brown', 'turn on rain': 'rain', 'put some rain': 'rain',
        'stop the noise': 'off', 'turn off': 'off',
        'stop the rain': 'off', 'stop the sound': 'off', 'silence': 'off',
        'quiet please': 'off', 'no noise': 'off',
      };
      for (const [trigger, sound] of Object.entries(ambientCommands)) {
        if (lower.includes(trigger)) {
          console.log('[ambient] detected command:', trigger, '→', sound);
          sendToClient('ambient_control', { sound });
          break;
        }
      }

      // Call OpenAI
      sendToClient('agent_state', { state: 'THINKING' });

      conversationHistory.push({ role: 'user', content: text });
      // Keep conversation history short — last 20 messages (10 exchanges)
      if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
      }

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 100,
            temperature: 0.7,
            messages: [
              { role: 'system', content: systemPrompt },
              ...conversationHistory,
            ],
          }),
        });

        const json = await response.json() as any;
        const reply = json.choices?.[0]?.message?.content?.trim();

        if (reply) {
          console.log('[llm] reply:', reply.substring(0, 80));
          conversationHistory.push({ role: 'assistant', content: reply });
          await speakWithElevenLabs(reply);
        }
      } catch (err) {
        console.error('[llm] error:', err);
      }

      // Reset check-in timer after conversation
      scheduleCheckIn();
    }

    dgWs.on('open', () => {
      console.log('[stt] Deepgram streaming STT connected');
      dgReady = true;
      sendToClient('connected', { state: 'GREETING' });

      // Speak greeting via ElevenLabs
      greetingPlaying = true;
      speakWithElevenLabs(GREETING).then(() => {
        setTimeout(() => {
          greetingPlaying = false;
          console.log('[dg] greeting mute cleared after 4s');
        }, 4000);
      }).catch(() => {
        greetingPlaying = false;
      });

      // Flush any buffered audio
      for (const chunk of audioBuffer) {
        if (dgWs.readyState === WebSocket.OPEN) dgWs.send(chunk);
      }
      audioBuffer.length = 0;

      scheduleCheckIn(); // start check-in timer

      // Session time limit
      startTime = Date.now();
      sessionWarningTimer = setTimeout(() => {
        console.log('[session] 2 minutes remaining, warning user');
        speakWithElevenLabs("Just to let you know, we have about two minutes left on this call. You can always call back whenever you need to.").catch(() => {});
      }, warningMs);

      sessionEndTimer = setTimeout(() => {
        console.log('[session] time limit reached, ending call');
        const farewell = tier === 'PAID'
          ? "That's our time for now. I'm always here when you need me. Take care."
          : "I've really enjoyed sitting with you. Our free sessions are ten minutes, but I'd love to spend more time together. You can unlock longer sessions anytime. Take care for now.";
        speakWithElevenLabs(farewell).then(() => {
          setTimeout(() => {
            sendToClient('limit_reached', { reason: 'time_limit', tier });
            endCall();
          }, 3000); // give the farewell 3 seconds to play
        }).catch(() => endCall());
      }, maxSessionMs);

      timeUpdateInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, maxSessionMs - elapsed);
        sendToClient('time_remaining', { seconds: Math.round(remaining / 1000) });
      }, 300000); // every 5 minutes

      // Free tier total usage enforcement
      if (tier !== 'PAID' && tier !== 'paid') {
        const FREE_TOTAL_SECONDS = parseInt(process.env.FREE_TOTAL_SECONDS || '3600', 10); // 60 minutes total
        prisma.call.aggregate({
          where: { sessionId: call.session.id, durationSeconds: { not: null } },
          _sum: { durationSeconds: true },
        }).then((result) => {
          const totalUsedSeconds = result._sum.durationSeconds || 0;
          console.log('[session] free usage so far:', totalUsedSeconds, '/', FREE_TOTAL_SECONDS, 'seconds');
          if (totalUsedSeconds >= FREE_TOTAL_SECONDS) {
            console.log('[session] free total limit reached, total used:', totalUsedSeconds);
            sendToClient('limit_reached', { reason: 'free_total_limit', tier: 'FREE' });
            speakWithElevenLabs("I've enjoyed our time together. Longer and unlimited sessions are available with a subscription.").then(() => {
              setTimeout(() => endCall(), 4000);
            }).catch(() => endCall());
          }
        }).catch((err: Error) => console.error('[session] failed to check free usage:', err.message));
      }
    });

    dgWs.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'Results' && msg.channel?.alternatives?.[0]) {
          const transcript = msg.channel.alternatives[0].transcript;
          const isFinal = msg.is_final;

          if (isFinal && transcript) {
            currentTranscript += (currentTranscript ? ' ' : '') + transcript;
            console.log('[stt] final:', transcript);

            sendToClient('agent_state', { state: 'LISTENING' });

            // Debounce: process after 600ms of no new transcripts
            if (processTimer) clearTimeout(processTimer);
            processTimer = setTimeout(() => {
              if (currentTranscript.trim()) {
                console.log('[stt] processing:', currentTranscript.trim());
                handleUserSpeech(currentTranscript.trim());
                currentTranscript = '';
              }
            }, 600);
          }
        }

        if (msg.type === 'SpeechStarted') {
          console.log('[stt] speech started');
          sendToClient('agent_state', { state: 'LISTENING' });
        }
      } catch {}
    });

    dgWs.on('close', (code: number, reason: Buffer) => {
      console.log(`[dg] WebSocket closed code=${code} reason=${reason.toString()}`);
      if (!isEnded) sendToClient('dg_closed', { code, reason: reason.toString() });
    });

    dgWs.on('error', (err: any) => {
      console.error('[stt] Deepgram error:', err.message || err);
      sendToClient('error', { message: err.message });
    });

    dgWs.on('unexpected-response', (_req: any, res: any) => {
      let body = '';
      res.on('data', (chunk: any) => body += chunk);
      res.on('end', () => console.error('[stt] Deepgram 400 response:', res.statusCode, body));
    });

    clientWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        if (greetingPlaying) return; // don't send mic audio during greeting
        if (dgWs.readyState === WebSocket.OPEN && !isEnded) {
          dgWs.send(data);
        } else if (!isEnded) {
          audioBuffer.push(data);
        }
        return;
      }
      // Handle JSON control messages
      try {
        const msg = JSON.parse(data.toString('utf8'));
        const type = msg.type || msg.event;

        if (type === 'hangup') {
          console.log('[ws] hangup received');
          endCall();
        } else if (type === 'style_change' && msg.style) {
          console.log('[ws] style_change received:', msg.style);
          const newStyle = msg.style as string;
          systemPrompt = SYSTEM_PROMPTS[newStyle] || SYSTEM_PROMPTS['quiet'];
          console.log('[ws] systemPrompt updated for style:', newStyle);
        } else if (type === 'prefer_silence') {
          console.log('[ws] prefer_silence received');
          systemPrompt = SYSTEM_PROMPTS['quiet'];
        } else if (type === 'ping') {
          sendToClient('pong');
        }
      } catch {
        // Not JSON — ignore
      }
    });

    clientWs.on('close', () => {
      console.log('[ws] client disconnected');
      resetCheckInTimer();
      endCall();
    });

    } catch (err) {
      console.error('[ws] connection error:', err);
      clientWs.close(4500, 'internal_error');
    }
  });
}
