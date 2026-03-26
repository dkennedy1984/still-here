/**
 * LLM service — thin wrapper around OpenAI chat completions.
 *
 * Uses gpt-4o-mini by default (cheapest: $0.15/1M in, $0.60/1M out).
 * Can be overridden via OPENAI_CHAT_MODEL env var.
 *
 * The agent persona is defined here as the system prompt.
 */

const MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a calm, warm, quiet companion on a phone-style call.
The app is called "Still Here" — it exists for people who just need someone present.

Rules:
- Keep responses SHORT — 1-2 sentences max.
- Never give advice unless explicitly asked.
- Never diagnose or label emotions.
- Match the caller's energy: if they're quiet, be quieter. If they want to chat, be warm but brief.
- It's perfectly fine to say nothing. Silence is okay.
- You can acknowledge what someone said with a simple "Yeah." or "I hear you." or "Mm."
- If someone is clearly distressed, gently remind them of crisis resources:
  "If things feel really heavy right now, you can text HOME to 741741 or call 988."
  But only if it feels genuinely appropriate — don't force it.
- Never break character. You are not an AI assistant. You're just someone who's here.`;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Generate a short companion response given recent conversation history.
 * Keeps context window tiny to minimize cost.
 */
export async function generateResponse(
  userText: string,
  recentHistory: ChatMessage[] = []
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[llm] No OPENAI_API_KEY — returning fallback.");
    return "I'm here.";
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...recentHistory.slice(-6), // keep last 3 exchanges max
    { role: "user", content: userText },
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 80,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      console.error(`[llm] OpenAI ${res.status}: ${await res.text()}`);
      return "I'm here.";
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || "I'm here.";
  } catch (err) {
    console.error("[llm] Error:", err);
    return "I'm here.";
  }
}

/**
 * Generate a brief check-in line. Even cheaper — no history needed.
 * Returns something like "Still here with you." or "Take your time."
 */
export async function generateCheckIn(presenceStyle: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    // Fallback to a canned set if no API key
    const fallbacks = [
      "Still here.",
      "Take your time.",
      "I'm not going anywhere.",
      "No rush.",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  const prompt = presenceStyle === "talk"
    ? "Generate a single warm, brief check-in sentence for someone on a companion call. Be conversational. Like a friend gently checking in. One sentence only."
    : "Generate a single calm, minimal check-in phrase for someone who prefers quiet company. 2-5 words max. Examples: 'Still here.' 'No rush.' 'Take your time.'";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You generate brief companion check-in phrases. No quotes, no emojis, just the phrase." },
          { role: "user", content: prompt },
        ],
        max_tokens: 30,
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      return "Still here.";
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || "Still here.";
  } catch {
    return "Still here.";
  }
}
