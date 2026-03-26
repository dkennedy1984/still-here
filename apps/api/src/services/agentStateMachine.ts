import { WebSocket } from "ws";
import { synthesizeSpeech } from "./tts";
import { transcribeAudio } from "./stt";
import { generateResponse, generateCheckIn, ChatMessage } from "./llm";

// ─── Types ───────────────────────────────────────────────────

export type AgentStateType =
  | "GREETING"
  | "SILENT_PRESENCE"
  | "CHECK_IN"
  | "LISTENING"
  | "THINKING"
  | "RESPONDING"
  | "ENDED";

export type PresenceStyle = "silent" | "check-ins" | "talk";

interface AgentConfig {
  /** Minutes between check-ins per style */
  checkInIntervalMs: Record<PresenceStyle, number>;
  /** Silence timeout before processing speech (ms) */
  silenceTimeoutMs: number;
  /** Greeting lines spoken on connect */
  greetingLines: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  checkInIntervalMs: {
    "silent": Infinity,           // never check in
    "check-ins": 8 * 60 * 1000,  // every 8 minutes
    "talk": 4 * 60 * 1000,       // every 4 minutes
  },
  silenceTimeoutMs: 3000,         // 3 seconds of silence = end of utterance
  greetingLines: [
    "Hi. I'm here.",
    "You don't have to talk.",
  ],
};

// ─── State Machine ───────────────────────────────────────────

export class AgentStateMachine {
  private state: AgentStateType = "GREETING";
  private ws: WebSocket;
  private style: PresenceStyle;
  private config: AgentConfig;

  // Timers
  private checkInTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  // Audio buffer for collecting user speech chunks
  private audioChunks: string[] = [];

  // Conversation history (kept tiny for cost)
  private history: ChatMessage[] = [];

  constructor(ws: WebSocket, presenceStyle: string) {
    this.ws = ws;
    this.style = this.normalizeStyle(presenceStyle);
    this.config = DEFAULT_CONFIG;
  }

  // ─── Public API ──────────────────────────────────────────

  /** Start the state machine — call once on connection */
  async start(): Promise<void> {
    this.transition("GREETING");
    await this.runGreeting();
  }

  /** Handle incoming audio data from the user's microphone */
  onAudioData(base64Chunk: string): void {
    if (this.state === "ENDED") return;

    // Collect audio regardless of state
    this.audioChunks.push(base64Chunk);

    // If we're in SILENT_PRESENCE or CHECK_IN, transition to LISTENING
    if (this.state === "SILENT_PRESENCE" || this.state === "CHECK_IN") {
      this.cancelCheckInTimer();
      this.transition("LISTENING");
    }

    // Reset silence timer — user is still speaking
    if (this.state === "LISTENING") {
      this.resetSilenceTimer();
    }
  }

  /** Handle presence style changes from the user */
  onStyleChange(newStyle: string): void {
    this.style = this.normalizeStyle(newStyle);
    // Restart check-in timer with new interval
    if (this.state === "SILENT_PRESENCE") {
      this.startCheckInTimer();
    }
  }

  /** Clean up everything */
  destroy(): void {
    this.transition("ENDED");
    this.cancelCheckInTimer();
    this.cancelSilenceTimer();
    this.audioChunks = [];
    this.history = [];
  }

  getState(): AgentStateType {
    return this.state;
  }

  // ─── State Transitions ─────────────────────────────────

  private transition(newState: AgentStateType): void {
    const prev = this.state;
    this.state = newState;
    console.log(`[agent] ${prev} -> ${newState}`);
    this.sendToClient({ type: "agent_state", state: newState });
  }

  // ─── GREETING ──────────────────────────────────────────

  private async runGreeting(): Promise<void> {
    this.transition("RESPONDING");

    for (const line of this.config.greetingLines) {
      if (this.ws.readyState !== WebSocket.OPEN || this.state === "ENDED") break;

      const audio = await synthesizeSpeech(line);
      if (audio && this.ws.readyState === WebSocket.OPEN) {
        this.sendToClient({ type: "audio_out", data: audio });
      }
    }

    if (this.ws.readyState === WebSocket.OPEN && this.state !== "ENDED") {
      this.sendToClient({ type: "audio_out_done" });
      this.enterSilentPresence();
    }
  }

  // ─── SILENT_PRESENCE ───────────────────────────────────

  private enterSilentPresence(): void {
    this.transition("SILENT_PRESENCE");
    this.startCheckInTimer();
  }

  private startCheckInTimer(): void {
    this.cancelCheckInTimer();
    const interval = this.config.checkInIntervalMs[this.style];
    if (interval === Infinity) return; // silent mode — no check-ins

    this.checkInTimer = setTimeout(() => {
      if (this.state === "SILENT_PRESENCE") {
        this.runCheckIn();
      }
    }, interval);
  }

  private cancelCheckInTimer(): void {
    if (this.checkInTimer) {
      clearTimeout(this.checkInTimer);
      this.checkInTimer = null;
    }
  }

  // ─── CHECK_IN ──────────────────────────────────────────

  private async runCheckIn(): Promise<void> {
    if (this.state === "ENDED" || this.ws.readyState !== WebSocket.OPEN) return;

    this.transition("CHECK_IN");

    try {
      // Generate a check-in line via LLM (tiny call, ~20 tokens)
      const line = await generateCheckIn(this.style);

      if (this.state !== "ENDED" && this.state !== "LISTENING" && this.ws.readyState === WebSocket.OPEN) {
        this.transition("RESPONDING");
        const audio = await synthesizeSpeech(line);
        if (audio && this.ws.readyState === WebSocket.OPEN) {
          this.sendToClient({ type: "audio_out", data: audio });
        }
        if (this.ws.readyState === WebSocket.OPEN) {
          this.sendToClient({ type: "audio_out_done" });
        }
        // Track in history
        this.history.push({ role: "assistant", content: line });
      }
    } catch (err) {
      console.error("[agent] Check-in error:", err);
    }

    // Go back to silent presence (unless user started talking during check-in)
    if (this.state !== "LISTENING" && this.state !== "ENDED") {
      this.enterSilentPresence();
    }
  }

  // ─── LISTENING ─────────────────────────────────────────

  private resetSilenceTimer(): void {
    this.cancelSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      // Silence detected — process the collected audio
      if (this.state === "LISTENING") {
        this.processUserSpeech();
      }
    }, this.config.silenceTimeoutMs);
  }

  private cancelSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  // ─── THINKING (STT + LLM) ─────────────────────────────

  private async processUserSpeech(): Promise<void> {
    if (this.state === "ENDED" || this.ws.readyState !== WebSocket.OPEN) return;

    this.transition("THINKING");
    this.cancelSilenceTimer();

    // Collect all buffered audio chunks into one blob
    const allAudio = this.audioChunks.join("");
    this.audioChunks = [];

    if (!allAudio) {
      this.enterSilentPresence();
      return;
    }

    try {
      // 1. Transcribe (STT)
      const transcript = await transcribeAudio(allAudio);
      console.log(`[agent] Transcript: "${transcript}"`);

      if (!transcript.trim()) {
        // No meaningful speech detected
        this.enterSilentPresence();
        return;
      }

      // Track user message
      this.history.push({ role: "user", content: transcript });

      // 2. Generate response (LLM) — GPT-4o-mini, ~100 tokens
      const response = await generateResponse(transcript, this.history);
      console.log(`[agent] Response: "${response}"`);

      // Track assistant response
      this.history.push({ role: "assistant", content: response });

      // Trim history to keep cost tiny (max 6 messages = 3 exchanges)
      if (this.history.length > 8) {
        this.history = this.history.slice(-6);
      }

      // 3. TTS the response and send audio
      if (this.state !== "ENDED" && this.ws.readyState === WebSocket.OPEN) {
        this.transition("RESPONDING");
        const audio = await synthesizeSpeech(response);
        if (audio && this.ws.readyState === WebSocket.OPEN) {
          this.sendToClient({ type: "audio_out", data: audio });
        }
        if (this.ws.readyState === WebSocket.OPEN) {
          this.sendToClient({ type: "audio_out_done" });
        }
      }
    } catch (err) {
      console.error("[agent] processUserSpeech error:", err);
    }

    // Back to silent presence
    if (this.state !== "ENDED") {
      this.enterSilentPresence();
    }
  }

  // ─── Helpers ───────────────────────────────────────────

  private sendToClient(msg: Record<string, unknown>): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private normalizeStyle(raw: string): PresenceStyle {
    const s = raw.toLowerCase().trim();
    if (s === "silent") return "silent";
    if (s === "talk") return "talk";
    return "check-ins";
  }
}
