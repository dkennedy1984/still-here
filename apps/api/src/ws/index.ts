import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import { ENCOURAGEMENT_MESSAGES } from "@still-here/shared";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
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

    // Authenticate from query param
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Authentication required" }));
      ws.close();
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as { userId: string };
      ws.userId = payload.userId;
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
      ws.close();
      return;
    }

    ws.on("message", async (data) => {
      try {
        const event = JSON.parse(data.toString());
        await handleEvent(ws, event);
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      if (ws.sessionId) {
        leaveSessionRoom(ws);
      }
    });
  });
}

async function handleEvent(ws: AuthenticatedSocket, event: { type: string; [key: string]: unknown }) {
  switch (event.type) {
    case "join_session": {
      const sessionId = event.sessionId as string;
      if (!sessionId) return;

      // Verify participant exists
      const participant = await prisma.participant.findUnique({
        where: { userId_sessionId: { userId: ws.userId!, sessionId } },
      });
      if (!participant || participant.status === "left") {
        ws.send(JSON.stringify({ type: "error", message: "You must join the session via the API first" }));
        return;
      }

      ws.sessionId = sessionId;
      if (!sessions.has(sessionId)) sessions.set(sessionId, new Set());
      sessions.get(sessionId)!.add(ws);

      const user = await prisma.user.findUnique({
        where: { id: ws.userId! },
        select: { displayName: true },
      });

      broadcast(sessionId, {
        type: "chat_message",
        message: {
          id: crypto.randomUUID(),
          sessionId,
          userId: null,
          userName: "System",
          content: `${user?.displayName || "Someone"} joined the session`,
          type: "system",
          createdAt: new Date().toISOString(),
        },
      }, ws);

      break;
    }

    case "leave_session": {
      leaveSessionRoom(ws);
      break;
    }

    case "send_message": {
      if (!ws.sessionId || !ws.userId) return;
      const content = (event.content as string || "").trim();
      if (!content || content.length > 500) return;

      const user = await prisma.user.findUnique({
        where: { id: ws.userId },
        select: { displayName: true },
      });

      const message = await prisma.chatMessage.create({
        data: {
          sessionId: ws.sessionId,
          userId: ws.userId,
          userName: user?.displayName || "Anonymous",
          content,
          type: "text",
        },
      });

      broadcast(ws.sessionId, {
        type: "chat_message",
        message: {
          id: message.id,
          sessionId: message.sessionId,
          userId: message.userId,
          userName: message.userName,
          content: message.content,
          type: message.type,
          createdAt: message.createdAt.toISOString(),
        },
      });

      break;
    }

    case "update_task": {
      if (!ws.sessionId || !ws.userId) return;
      const task = (event.task as string || "").trim().slice(0, 200);

      const participant = await prisma.participant.update({
        where: { userId_sessionId: { userId: ws.userId, sessionId: ws.sessionId } },
        data: { currentTask: task || null },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, bio: true, focusStreak: true } },
        },
      });

      broadcast(ws.sessionId, { type: "participant_update", participant });
      break;
    }

    case "toggle_focus": {
      if (!ws.sessionId || !ws.userId) return;
      const focusing = event.focusing as boolean;
      const newStatus = focusing ? "focusing" : "joined";

      const participant = await prisma.participant.update({
        where: { userId_sessionId: { userId: ws.userId, sessionId: ws.sessionId } },
        data: { status: newStatus },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, bio: true, focusStreak: true } },
        },
      });

      broadcast(ws.sessionId, { type: "participant_update", participant });
      break;
    }

    case "send_encouragement": {
      if (!ws.sessionId || !ws.userId) return;
      const targetUserId = event.targetUserId as string;
      if (!targetUserId) return;

      const user = await prisma.user.findUnique({
        where: { id: ws.userId },
        select: { displayName: true },
      });

      const randomMsg = ENCOURAGEMENT_MESSAGES[Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length)];

      await prisma.chatMessage.create({
        data: {
          sessionId: ws.sessionId,
          userId: ws.userId,
          userName: user?.displayName || "Someone",
          content: randomMsg,
          type: "encouragement",
        },
      });

      broadcast(ws.sessionId, {
        type: "encouragement",
        fromUser: user?.displayName || "Someone",
        toUserId: targetUserId,
      });

      break;
    }
  }
}

function leaveSessionRoom(ws: AuthenticatedSocket) {
  if (!ws.sessionId) return;
  const room = sessions.get(ws.sessionId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) sessions.delete(ws.sessionId);
  }
  ws.sessionId = undefined;
}

function broadcast(sessionId: string, data: unknown, exclude?: AuthenticatedSocket) {
  const room = sessions.get(sessionId);
  if (!room) return;
  const message = JSON.stringify(data);
  room.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
