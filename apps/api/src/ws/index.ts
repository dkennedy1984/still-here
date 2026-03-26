import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import { ENCOURAGEMENT_MESSAGES } from "@still-here/shared";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
  callId?: string;
  presenceStyle?: string;
  isAlive?: boolean;
}

const sessions = new Map<string, Set<AuthenticatedSocket>>();

export function setupWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Heartbeat
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as AuthenticatedSocket;
      if (socket.isAlive === false) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  wss.on("connection", (ws: AuthenticatedSocket, req) => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    // Authenticate from query param — accept both ?ticket= and ?token= for flexibility
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("ticket") || url.searchParams.get("token");

    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Authentication required" }));
      ws.close();
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        sessionId?: string;
        callId?: string;
        presenceStyle?: string;
      };
      ws.userId = payload.userId;
      ws.sessionId = payload.sessionId;
      ws.callId = payload.callId;
      ws.presenceStyle = payload.presenceStyle;
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid or expired ticket" }));
      ws.close();
      return;
    }

    // Add to session room
    if (ws.sessionId) {
      if (!sessions.has(ws.sessionId)) {
        sessions.set(ws.sessionId, new Set());
      }
      sessions.get(ws.sessionId)!.add(ws);
    }

    // Send session_ready event so the client knows the connection is established
    ws.send(JSON.stringify({
      type: "session_ready",
      callId: ws.callId,
      sessionId: ws.sessionId,
      presenceStyle: ws.presenceStyle,
    }));

    ws.on("message", async (data) => {
      try {
        const event = JSON.parse(data.toString());
        await handleEvent(ws, event);
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      if (ws.sessionId && sessions.has(ws.sessionId)) {
        sessions.get(ws.sessionId)!.delete(ws);
        if (sessions.get(ws.sessionId)!.size === 0) {
          sessions.delete(ws.sessionId);
        }
      }
    });
  });
}

async function handleEvent(ws: AuthenticatedSocket, event: { type: string; [key: string]: unknown }) {
  switch (event.type) {
    case "ping":
      ws.send(JSON.stringify({ type: "pong" }));
      break;

    case "join_session": {
      const sessionId = event.sessionId as string;
      if (!sessionId) return;

      ws.sessionId = sessionId;
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, new Set());
      }
      sessions.get(sessionId)!.add(ws);

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { participants: true },
      });

      ws.send(JSON.stringify({
        type: "session_joined",
        session,
        participantCount: sessions.get(sessionId)?.size || 0,
      }));

      // Notify others
      broadcast(sessionId, {
        type: "participant_joined",
        userId: ws.userId,
        participantCount: sessions.get(sessionId)?.size || 0,
      }, ws);
      break;
    }

    case "audio_data": {
      // Relay audio data to other participants in the session
      if (ws.sessionId) {
        broadcast(ws.sessionId, {
          type: "audio_data",
          from: ws.userId,
          data: event.data,
        }, ws);
      }
      break;
    }

    case "change_style": {
      ws.presenceStyle = event.style as string;
      ws.send(JSON.stringify({ type: "style_changed", style: event.style }));
      break;
    }

    case "encouragement": {
      const msg = ENCOURAGEMENT_MESSAGES[
        Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length)
      ];
      ws.send(JSON.stringify({ type: "encouragement", message: msg }));
      break;
    }

    case "end_call": {
      ws.send(JSON.stringify({ type: "call_ended" }));
      ws.close();
      break;
    }

    default:
      ws.send(JSON.stringify({ type: "error", message: `Unknown event type: ${event.type}` }));
  }
}

function broadcast(sessionId: string, data: Record<string, unknown>, exclude?: WebSocket) {
  const room = sessions.get(sessionId);
  if (!room) return;
  const msg = JSON.stringify(data);
  room.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}
