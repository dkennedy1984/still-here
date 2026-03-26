import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import { synthesizeSpeech } from "../services/tts";
import { ENCOURAGEMENT_MESSAGES } from "@still-here/shared";

interface AuthenticatedSocket extends WebSocket {
  callerId?: string;
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
        callerId?: string;
        sessionId?: string;
        callId?: string;
        presenceStyle?: string;
      };
      ws.callerId = payload.callerId;
      ws.sessionId = payload.sessionId;
      ws.callId = payload.callId;
      ws.presenceStyle = payload.presenceStyle || "quiet";
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

    // Trigger greeting audio — send the initial "Hi. I'm here." lines via TTS
    sendGreeting(ws);

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
            data: {
              endedAt: now,
            },
          })
          .then(async (call) => {
            if (call.startedAt) {
              const durationSeconds = Math.round(
                (now.getTime() - call.startedAt.getTime()) / 1000
              );
              const durationMinutes = Math.ceil(durationSeconds / 60);

              // Update call duration
              await prisma.call.update({
                where: { id: call.id },
                data: { durationSeconds },
              });

              // Increment session daily minutes
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

/**
 * Send greeting audio on connect.
 * The greeting lines ("Hi. I'm here." and "You don't have to talk.")
 * are sent through the TTS pipeline so the caller hears them immediately.
 */
async function sendGreeting(ws: AuthenticatedSocket) {
  try {
    // Notify the client that the agent is responding
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "agent_state", state: "RESPONDING" }));

    const greetingLines = [
      "Hi. I'm here.",
      "You don't have to talk.",
    ];

    for (const line of greetingLines) {
      if (ws.readyState !== WebSocket.OPEN) break;

      const audioBase64 = await synthesizeSpeech(line);

      // Only send audio_out if the TTS service returned actual audio data
      if (audioBase64 && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "audio_out", data: audioBase64 }));
      }
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "audio_out_done" }));
      ws.send(JSON.stringify({ type: "agent_state", state: "LISTENING" }));
    }
  } catch (err) {
    console.error("[ws] Failed to send greeting:", err);
    // Non-fatal — the session still works without the greeting
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "agent_state", state: "LISTENING" }));
    }
  }
}

function handleMessage(ws: AuthenticatedSocket, msg: { type: string; [key: string]: unknown }) {
  switch (msg.type) {
    case "ping": {
      // Respond to client keepalive pings
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pong" }));
      }
      break;
    }

    case "audio_data": {
      // Audio data from client microphone — forward to speech processing pipeline
      // This is handled by the audio processing service
      break;
    }

    case "end_call": {
      // Client requested to end the call
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "call_ended" }));
        ws.close();
      }
      break;
    }

    case "change_style": {
      // Client requested a presence style change
      if (msg.style && typeof msg.style === "string") {
        ws.presenceStyle = msg.style;
        ws.send(JSON.stringify({ type: "style_changed", style: msg.style }));
      }
      break;
    }

    case "presence": {
      // Broadcast presence to session room
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

    case "check-in": {
      // Send an encouragement message back
      const randomMsg =
        ENCOURAGEMENT_MESSAGES[Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length)];
      ws.send(
        JSON.stringify({
          type: "encouragement",
          message: randomMsg,
        })
      );

      // Increment agent turns for the call
      if (ws.callId) {
        prisma.call
          .update({
            where: { id: ws.callId },
            data: { agentTurns: { increment: 1 } },
          })
          .catch(() => {});
      }
      break;
    }

    case "user-turn": {
      if (ws.callId) {
        prisma.call
          .update({
            where: { id: ws.callId },
            data: { userTurns: { increment: 1 } },
          })
          .catch(() => {});
      }
      break;
    }

    default:
      // Silently ignore unknown message types — do not send error back
      break;
  }
}
