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
