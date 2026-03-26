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
