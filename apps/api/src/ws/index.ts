import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import { AgentStateMachine } from "../services/agentStateMachine";

interface AuthenticatedSocket extends WebSocket {
  callerId?: string;
  sessionId?: string;
  callId?: string;
  presenceStyle?: string;
  isAlive?: boolean;
  agent?: AgentStateMachine;
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

    // Authenticate from query param
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("ticket") || url.searchParams.get("token");

    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Ticket required" }));
      ws.close();
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as {
        callerId?: string;
        sessionId?: string;
        callId?: string;
        presenceStyle?: string;
      };
      ws.callerId = payload.callerId;
      ws.sessionId = payload.sessionId;
      ws.callId = payload.callId;
      ws.presenceStyle = payload.presenceStyle || "check-ins";
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid ticket" }));
      ws.close();
      return;
    }

    // Join session room
    const sessionId = ws.sessionId!;
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, new Set());
    }
    sessions.get(sessionId)!.add(ws);

    // Notify the caller they're connected
    ws.send(
      JSON.stringify({
        type: "connected",
        callId: ws.callId,
        sessionId: ws.sessionId,
        presenceStyle: ws.presenceStyle,
      })
    );

    // Create and start the agent state machine
    const agent = new AgentStateMachine(ws, ws.presenceStyle || "check-ins");
    ws.agent = agent;
    agent.start().catch((err) => {
      console.error("[ws] Agent start error:", err);
    });

    // Update call start time
    if (ws.callId) {
      prisma.call
        .update({ where: { id: ws.callId }, data: { startedAt: new Date() } })
        .catch(() => {});
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(ws, msg);
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      // Destroy the agent state machine
      if (ws.agent) {
        ws.agent.destroy();
      }

      const room = sessions.get(sessionId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) sessions.delete(sessionId);
      }

      // Mark call as ended and calculate duration
      if (ws.callId) {
        const now = new Date();
        prisma.call
          .update({
            where: { id: ws.callId },
            data: { endedAt: now },
          })
          .then(async (call) => {
            if (call.startedAt) {
              const durationSeconds = Math.round(
                (now.getTime() - call.startedAt.getTime()) / 1000
              );
              const durationMinutes = Math.ceil(durationSeconds / 60);

              await prisma.call.update({
                where: { id: call.id },
                data: { durationSeconds },
              });

              await prisma.session.update({
                where: { id: call.sessionId },
                data: {
                  dailyMinutesUsed: { increment: durationMinutes },
                },
              });
            }
          })
          .catch(() => {});
      }
    });
  });
}

function handleMessage(ws: AuthenticatedSocket, msg: { type: string; [key: string]: unknown }) {
  switch (msg.type) {
    case "ping": {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pong" }));
      }
      break;
    }

    case "audio_data": {
      // Forward audio to the agent state machine
      if (ws.agent && typeof msg.data === "string") {
        ws.agent.onAudioData(msg.data);
      }
      break;
    }

    case "end_call": {
      if (ws.agent) {
        ws.agent.destroy();
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "call_ended" }));
        ws.close();
      }
      break;
    }

    case "change_style": {
      if (msg.style && typeof msg.style === "string") {
        ws.presenceStyle = msg.style;
        if (ws.agent) {
          ws.agent.onStyleChange(msg.style);
        }
        ws.send(JSON.stringify({ type: "style_changed", style: msg.style }));
      }
      break;
    }

    case "presence": {
      const room = sessions.get(ws.sessionId!);
      if (room) {
        const payload = JSON.stringify({
          type: "presence",
          callerId: ws.callerId,
          presenceStyle: ws.presenceStyle,
          data: msg.data,
        });
        room.forEach((peer) => {
          if (peer !== ws && peer.readyState === WebSocket.OPEN) {
            peer.send(payload);
          }
        });
      }
      break;
    }

    default:
      // Silently ignore unknown message types
      break;
  }
}
