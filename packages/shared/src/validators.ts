import {
  SESSION_TITLE_MIN,
  SESSION_TITLE_MAX,
  SESSION_DESC_MAX,
  SESSION_FOCUS_MIN,
  SESSION_FOCUS_MAX,
  SESSION_BREAK_MIN,
  SESSION_BREAK_MAX,
  SESSION_PARTICIPANTS_MIN,
  SESSION_PARTICIPANTS_MAX,
  SESSION_TAGS_MAX,
  SESSION_TAG_LENGTH_MAX,
  CHAT_MESSAGE_MAX,
  INTENTION_MAX,
} from "./constants";
import type { CreateSessionInput, CreateCheckInInput, MoodRating, EnergyLevel } from "./types";

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
