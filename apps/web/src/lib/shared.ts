// ============================================================
// Inlined from @still-here/shared — do NOT edit manually.
// This file was generated to decouple apps/web from the
// pnpm workspace package so Vercel can deploy with plain npm.
// ============================================================

// ─── Types ─────────────────────────────────────────────────
// ─── User ────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  focusStreak: number;
}

// ─── Session ─────────────────────────────────────────
export type SessionStatus = "waiting" | "active" | "paused" | "completed";
export type SessionVisibility = "public" | "private" | "friends";

export interface Session {
  id: string;
  title: string;
  description: string | null;
  hostId: string;
  host: UserProfile;
  status: SessionStatus;
  visibility: SessionVisibility;
  scheduledStart: string | null;
  startedAt: string | null;
  endedAt: string | null;
  focusDurationMinutes: number;
  breakDurationMinutes: number;
  maxParticipants: number;
  tags: string[];
  participants: Participant[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  hostName: string;
  status: SessionStatus;
  participantCount: number;
  maxParticipants: number;
  focusDurationMinutes: number;
  tags: string[];
  startedAt: string | null;
}

export interface CreateSessionInput {
  title: string;
  description?: string;
  visibility: SessionVisibility;
  focusDurationMinutes: number;
  breakDurationMinutes: number;
  maxParticipants: number;
  tags: string[];
  scheduledStart?: string;
}

// ─── Participant ─────────────────────────────────────
export type ParticipantStatus = "joined" | "focusing" | "break" | "left";

export interface Participant {
  id: string;
  userId: string;
  sessionId: string;
  user: UserProfile;
  status: ParticipantStatus;
  currentTask: string | null;
  joinedAt: string;
  totalFocusMinutes: number;
}

// ─── Focus Block ─────────────────────────────────────
export interface FocusBlock {
  id: string;
  sessionId: string;
  round: number;
  startedAt: string;
  endsAt: string;
  type: "focus" | "break";
}

// ─── Chat ────────────────────────────────────────────
export type MessageType = "text" | "system" | "encouragement";

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string | null;
  userName: string;
  content: string;
  type: MessageType;
  createdAt: string;
}

// ─── Check-in ────────────────────────────────────────
export type MoodRating = 1 | 2 | 3 | 4 | 5;
export type EnergyLevel = "low" | "medium" | "high";

export interface CheckIn {
  id: string;
  userId: string;
  sessionId: string;
  mood: MoodRating;
  energy: EnergyLevel;
  intention: string;
  createdAt: string;
}

export interface CreateCheckInInput {
  mood: MoodRating;
  energy: EnergyLevel;
  intention: string;
}

// ─── Stats ───────────────────────────────────────────
export interface UserStats {
  totalSessions: number;
  totalFocusMinutes: number;
  currentStreak: number;
  longestStreak: number;
  sessionsThisWeek: number;
  focusMinutesThisWeek: number;
  averageMood: number;
  favoriteTimeOfDay: string | null;
}

// ─── API Responses ───────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ─── WebSocket Events ────────────────────────────────
export type WSClientEvent =
  | { type: "join_session"; sessionId: string }
  | { type: "leave_session" }
  | { type: "update_task"; task: string }
  | { type: "send_message"; content: string }
  | { type: "toggle_focus"; focusing: boolean }
  | { type: "send_encouragement"; targetUserId: string };

export type WSServerEvent =
  | { type: "session_update"; session: Session }
  | { type: "participant_joined"; participant: Participant }
  | { type: "participant_left"; userId: string }
  | { type: "participant_update"; participant: Participant }
  | { type: "chat_message"; message: ChatMessage }
  | { type: "focus_block_start"; block: FocusBlock }
  | { type: "focus_block_end"; block: FocusBlock }
  | { type: "encouragement"; fromUser: string; toUserId: string }
  | { type: "error"; message: string };


// ─── Constants ─────────────────────────────────────────────
// Session constraints
export const SESSION_TITLE_MIN = 3;
export const SESSION_TITLE_MAX = 100;
export const SESSION_DESC_MAX = 500;
export const SESSION_FOCUS_MIN = 5;
export const SESSION_FOCUS_MAX = 120;
export const SESSION_BREAK_MIN = 1;
export const SESSION_BREAK_MAX = 30;
export const SESSION_PARTICIPANTS_MIN = 2;
export const SESSION_PARTICIPANTS_MAX = 50;
export const SESSION_TAGS_MAX = 5;
export const SESSION_TAG_LENGTH_MAX = 30;

// Chat
export const CHAT_MESSAGE_MAX = 500;

// Check-in
export const INTENTION_MAX = 200;

// Timing
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const RECONNECT_DELAY_MS = 3_000;
export const MAX_RECONNECT_ATTEMPTS = 5;

// Tags (popular defaults)
export const POPULAR_TAGS = [
  "deep-work",
  "writing",
  "coding",
  "studying",
  "admin",
  "creative",
  "reading",
  "planning",
  "exercise",
  "cleaning",
] as const;

// Encouragement messages
export const ENCOURAGEMENT_MESSAGES = [
  "You’re doing great! Keep going! 💪",
  "Proud of you for showing up today!",
  "One step at a time — you’ve got this!",
  "Your focus is inspiring!",
  "Remember: done is better than perfect.",
  "You’re not alone — we’re all here together.",
  "Small progress is still progress!",
  "Your brain is doing its best, and that’s enough.",
] as const;

export const API_VERSION = "v1";


// ─── Validators ────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSessionInput(input: CreateSessionInput): ValidationResult {
  const errors: string[] = [];

  if (!input.title || input.title.trim().length < SESSION_TITLE_MIN) {
    errors.push(`Title must be at least ${SESSION_TITLE_MIN} characters`);
  }
  if (input.title && input.title.length > SESSION_TITLE_MAX) {
    errors.push(`Title must be at most ${SESSION_TITLE_MAX} characters`);
  }
  if (input.description && input.description.length > SESSION_DESC_MAX) {
    errors.push(`Description must be at most ${SESSION_DESC_MAX} characters`);
  }
  if (input.focusDurationMinutes < SESSION_FOCUS_MIN || input.focusDurationMinutes > SESSION_FOCUS_MAX) {
    errors.push(`Focus duration must be between ${SESSION_FOCUS_MIN} and ${SESSION_FOCUS_MAX} minutes`);
  }
  if (input.breakDurationMinutes < SESSION_BREAK_MIN || input.breakDurationMinutes > SESSION_BREAK_MAX) {
    errors.push(`Break duration must be between ${SESSION_BREAK_MIN} and ${SESSION_BREAK_MAX} minutes`);
  }
  if (input.maxParticipants < SESSION_PARTICIPANTS_MIN || input.maxParticipants > SESSION_PARTICIPANTS_MAX) {
    errors.push(`Max participants must be between ${SESSION_PARTICIPANTS_MIN} and ${SESSION_PARTICIPANTS_MAX}`);
  }
  if (input.tags.length > SESSION_TAGS_MAX) {
    errors.push(`Maximum ${SESSION_TAGS_MAX} tags allowed`);
  }
  for (const tag of input.tags) {
    if (tag.length > SESSION_TAG_LENGTH_MAX) {
      errors.push(`Tag "${tag}" exceeds ${SESSION_TAG_LENGTH_MAX} characters`);
    }
  }
  if (!["public", "private", "friends"].includes(input.visibility)) {
    errors.push("Visibility must be public, private, or friends");
  }

  return { valid: errors.length === 0, errors };
}

export function validateCheckInInput(input: CreateCheckInInput): ValidationResult {
  const errors: string[] = [];

  const validMoods: MoodRating[] = [1, 2, 3, 4, 5];
  if (!validMoods.includes(input.mood)) {
    errors.push("Mood must be between 1 and 5");
  }

  const validEnergy: EnergyLevel[] = ["low", "medium", "high"];
  if (!validEnergy.includes(input.energy)) {
    errors.push("Energy must be low, medium, or high");
  }

  if (!input.intention || input.intention.trim().length === 0) {
    errors.push("Intention is required");
  }
  if (input.intention && input.intention.length > INTENTION_MAX) {
    errors.push(`Intention must be at most ${INTENTION_MAX} characters`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateChatMessage(content: string): ValidationResult {
  const errors: string[] = [];

  if (!content || content.trim().length === 0) {
    errors.push("Message cannot be empty");
  }
  if (content && content.length > CHAT_MESSAGE_MAX) {
    errors.push(`Message must be at most ${CHAT_MESSAGE_MAX} characters`);
  }

  return { valid: errors.length === 0, errors };
}
