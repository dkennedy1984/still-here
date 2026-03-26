import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { apiLimiter } from "../middleware/rate-limit";
import { prisma } from "../lib/prisma";
import { config } from "../config";

export const callRouter: Router = Router();

const createCallSchema = z.object({
  sessionId: z.string().uuid(),
  presenceStyle: z.enum(["silent", "check-ins", "talk"]).default("check-ins"),
});

// POST /api/v1/calls/session — lightweight session-or-create for the call flow
callRouter.post("/session", requireAuth, apiLimiter, async (req: AuthRequest, res, next) => {
  try {
    // Create a minimal session for the 1-on-1 presence call
    const session = await prisma.session.create({
      data: {
        title: "Presence Call",
        hostId: req.userId!,
        status: "active",
        visibility: "private",
        focusDurationMinutes: 25,
        breakDurationMinutes: 5,
        maxParticipants: 2,
        startedAt: new Date(),
      },
    });

    res.json({ sessionId: session.id });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/calls — create a call and return a WS ticket (JWT)
callRouter.post("/", requireAuth, apiLimiter, async (req: AuthRequest, res, next) => {
  try {
    const body = createCallSchema.parse(req.body);

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
        userId: req.userId!,
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
