const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function startCall(
  presenceStyle: string = "quiet",
  voice: string = "her"
): Promise<{ callId: string; wsTicket: string; sessionId: string; error?: string }> {
  const res = await fetch(`${API_URL}/api/v1/calls/session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ presenceStyle, voice }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || 'unknown_error', callId: '', wsTicket: '', sessionId: '' };
  return data.data || data;
}
