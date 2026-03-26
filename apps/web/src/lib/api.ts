const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function createSession(): Promise<string> {
  const data = await apiFetch<{ sessionId: string }>("/api/sessions", {
    method: "POST",
  });
  return data.sessionId;
}

export async function createCall(
  sessionId: string,
  presenceStyle: string
): Promise<{ callId: string; wsTicket: string }> {
  const data = await apiFetch<{ callId: string; wsTicket: string }>(
    "/api/calls",
    {
      method: "POST",
      body: JSON.stringify({ sessionId, presenceStyle }),
    }
  );
  return data;
}
