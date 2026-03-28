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
): Promise<{ callId: string; wsTicket: string; sessionId: string }> {
  const body = await apiFetch<{ success: boolean; data: { callId: string; wsTicket: string; sessionId: string } }>(
    "/api/v1/calls/session",
    {
      method: "POST",
      body: JSON.stringify({ presenceStyle, voice }),
    }
  );
  return body.data;
}
