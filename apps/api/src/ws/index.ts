import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import { ENCOURAGEMENT_MESSAGES } from "@still-here/shared";

interface AuthenticatedSocket extends WebSocket {
  callerId?: string;
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

    // Authenticate from query param — accept ?ticket= and ?token= for flexibility
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("ticket") || url.searchParams.get("token");

    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Ticket required" }));
      ws.close();
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as {
        userId?: string;
        callerId?: string;
        sessionId?: string;
        callId?: string;
        presenceStyle?: string;
      };
      // Support both "userId" (legacy/registered) and "callerId" (anonymous)
      ws.callerId = payload.callerId || payload.userId;
      ws.userId = payload.userId;
      ws.sessionId = payload.sessionId;
      ws.callId = payload.callId;
      ws.presenceStyle = payload.presenceStyle;
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid or expired ticket" }));
      ws.close();
      return;
    }

    if (!ws.sessionId) {
      ws.send(JSON.stringify({ type: "error", message: "No sessionId in ticket" }));
      ws.close();
      return;
    }

    // Join session room
    if (!sessions.has(ws.sessionId)) {
      sessions.set(ws.sessionId, new Set());
    }
    sessions.get(ws.sessionId)!.add(ws);

    // Notify others
    broadcast(ws.sessionId, {
      type: "participant:joined",
      callerId: ws.callerId,
      callId: ws.callId,
      presenceStyle: ws.presenceStyle,
      count: sessions.get(ws.sessionId)!.size,
    }, ws);

    // Send current participant count to the new joiner
    ws.send(JSON.stringify({
      type: "session:state",
      sessionId: ws.sessionId,
      count: sessions.get(ws.sessionId)!.size,
    }));

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case "check-in": {
            broadcast(ws.sessionId!, {
              type: "check-in",
              callerId: ws.callerId,
              callId: ws.callId,
              message: msg.message || "",
              timestamp: new Date().toISOString(),
            });
            break;
          }

          case "encouragement": {
            const text =
              msg.message ||
              ENCOURAGEMENT_MESSAGES[
                Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length)
              ];
            broadcast(ws.sessionId!, {
              type: "encouragement",
              from: ws.callerId,
              message: text,
              timestamp: new Date().toISOString(),
            });
            break;
          }

          case "focus:start":
          case "focus:end":
          case "break:start":
          case "break:end": {
            broadcast(ws.sessionId!, {
              type: msg.type,
              callerId: ws.callerId,
              timestamp: new Date().toISOString(),
            });
            break;
          }

          default:
            ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${msg.type}` }));
        }
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    ws.on("close", async () => {
      const room = sessions.get(ws.sessionId!);
      if (room) {
        room.delete(ws);
        broadcast(ws.sessionId!, {
          type: "participant:left",
          callerId: ws.callerId,
          callId: ws.callId,
          count: room.size,
        });

        // Clean up empty sessions
        if (room.size === 0) {
          sessions.delete(ws.sessionId!);
          // Mark session as completed
          try {
            await prisma.session.update({
              where: { id: ws.sessionId! },
              data: { status: "completed", endedAt: new Date() },
            });
          } catch {
            // Session may already be completed
          }
        }
      }
    });
  });
}

function broadcast(sessionId: string, data: Record<string, unknown>, exclude?: AuthenticatedSocket) {
  const room = sessions.get(sessionId);
  if (!room) return;
  const msg = JSON.stringify(data);
  room.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}
