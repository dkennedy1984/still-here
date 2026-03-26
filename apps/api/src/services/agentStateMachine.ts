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
  checkInIntervalMs: Record<PresenceStyle, number>;
  silenceTimeoutMs: number;
  greetingLines: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  checkInIntervalMs: {
    "silent": Infinity,
    "check-ins": 8 * 60 * 1000,
    "talk": 4 * 60 * 1000,
  },
  silenceTimeoutMs: 3000,
  greetingLines: [
    "Hi. I'm here.",
    "You don't have to talk.",
  ],
};

// ─── State Machine ───────────────────────────────────────────

export class AgentStateMachine {
  // Use plain string to avoid TS2367 narrowing issues with async flows
  private state: string = "GREETING";
  private ws: WebSocket;
  private style: PresenceStyle;
  private config: AgentConfig;

  private checkInTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private audioChunks: string[] = [];
  private clientMimeType = "audio/webm;codecs=opus";
  private history: ChatMessage[] = [];

  constructor(ws: WebSocket, presenceStyle: string) {
    this.ws = ws;
    this.style = this.normalizeStyle(presenceStyle);
    this.config = DEFAULT_CONFIG;
  }

  // ─── Public API ──────────────────────────────────────────

  async start(): Promise<void> {
    this.transition("GREETING");
    await this.runGreeting();
  }

  onAudioData(base64Chunk: string, mimeType?: string): void {
    if (mimeType) this.clientMimeType = mimeType;
    if (this.state === "ENDED") return;

    console.log(`[agent] onAudioData in state=${this.state}, chunk size=${base64Chunk.length}`);

    this.audioChunks.push(base64Chunk);

    // Transition to LISTENING from any state except ENDED and LISTENING itself.
    // This fixes the bug where audio arriving during GREETING or RESPONDING
    // was buffered but the silence timer was never started, so THINKING was
    // never reached.
    if (this.state !== "LISTENING") {
      this.cancelCheckInTimer();
      this.transition("LISTENING");
    }

    // Reset the silence timer so that processUserSpeech fires after a pause
    this.resetSilenceTimer();
  }

  onStyleChange(newStyle: string): void {
    this.style = this.normalizeStyle(newStyle);
    if (this.state === "SILENT_PRESENCE") {
      this.startCheckInTimer();
    }
  }

  destroy(): void {
    this.transition("ENDED");
    this.cancelCheckInTimer();
    this.cancelSilenceTimer();
    this.audioChunks = [];
    this.history = [];
  }

  getState(): AgentStateType {
    return this.state as AgentStateType;
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
    if (interval === Infinity) return;

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
        this.history.push({ role: "assistant", content: line });
      }
    } catch (err) {
      console.error("[agent] Check-in error:", err);
    }

    if (this.state !== "LISTENING" && this.state !== "ENDED") {
      this.enterSilentPresence();
    }
  }

  // ─── LISTENING ─────────────────────────────────────────

  private resetSilenceTimer(): void {
    this.cancelSilenceTimer();
    this.silenceTimer = setTimeout(() => {
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

    const chunks = this.audioChunks;
    this.audioChunks = [];

    if (chunks.length === 0) {
      this.enterSilentPresence();
      return;
    }

    try {
      const transcript = await transcribeAudio(chunks, this.clientMimeType);
      console.log(`[agent] Transcript: "${transcript}"`);

      if (!transcript.trim()) {
        this.enterSilentPresence();
        return;
      }

      this.history.push({ role: "user", content: transcript });

      const response = await generateResponse(transcript, this.history);
      console.log(`[agent] Response: "${response}"`);

      this.history.push({ role: "assistant", content: response });

      if (this.history.length > 8) {
        this.history = this.history.slice(-6);
      }

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
