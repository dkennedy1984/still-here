import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { resolveIdentity, AuthRequest } from "../middleware/auth";
import { apiLimiter } from "../middleware/rate-limit";
import { prisma } from "../lib/prisma";
import { config } from "../config";

export const callRouter: Router = Router();

const createCallSchema = z.object({
  sessionId: z.string().uuid(),
  presenceStyle: z.enum(["silent", "check-ins", "talk"]).default("check-ins"),
});

// POST /api/v1/calls/session — lightweight session-or-create for the call flow
// No authentication required — anonymous users get an sh_session cookie identity
callRouter.post("/session", resolveIdentity, apiLimiter, async (req: AuthRequest, res, next) => {
  try {
    const callerId = req.userId || req.anonymousId!;

    // Create a minimal session for the 1-on-1 presence call
    const session = await prisma.session.create({
      data: {
        title: "Presence Call",
        hostId: callerId,
        status: "active",
        visibility: "private",
        focusDurationMinutes: 25,
        breakDurationMinutes: 5,
        maxParticipants: 2,
        startedAt: new Date(),
      },
    });

    // Also generate a call + wsTicket so the client can connect immediately
    const callId = crypto.randomUUID();
    const wsTicket = jwt.sign(
      {
        callerId,
        sessionId: session.id,
        callId,
        presenceStyle: "check-ins",
      },
      config.jwt.secret,
      { expiresIn: "5m" }
    );

    res.json({ sessionId: session.id, callId, wsTicket });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/calls — create a call and return a WS ticket (JWT)
// No authentication required — anonymous users can join calls
callRouter.post("/", resolveIdentity, apiLimiter, async (req: AuthRequest, res, next) => {
  try {
    const body = createCallSchema.parse(req.body);
    const callerId = req.userId || req.anonymousId!;

    // Verify the session exists
    const session = await prisma.session.findUnique({
      where: { id: body.sessionId },
    });

    if (!session) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }

    // Generate a unique call ID and a short-lived WS ticket (JWT)
    const callId = crypto.randomUUID();
    const wsTicket = jwt.sign(
      {
        callerId,
        sessionId: body.sessionId,
        callId,
        presenceStyle: body.presenceStyle,
      },
      config.jwt.secret,
      { expiresIn: "5m" }
    );

    res.json({ callId, wsTicket });
  } catch (err) {
    next(err);
  }
});
