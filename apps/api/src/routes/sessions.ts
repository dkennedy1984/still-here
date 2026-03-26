import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { apiLimiter } from "../middleware/rate-limit";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error-handler";
import {
  SESSION_TITLE_MIN,
  SESSION_TITLE_MAX,
  SESSION_DESC_MAX,
  SESSION_FOCUS_MIN,
  SESSION_FOCUS_MAX,
  SESSION_BREAK_MIN,
  SESSION_BREAK_MAX,
  SESSION_PARTICIPANTS_MIN,
  SESSION_PARTICIPANTS_MAX,
  SESSION_TAGS_MAX,
} from "@still-here/shared";

export const sessionRouter: Router = Router();

const createSessionSchema = z.object({
  title: z.string().min(SESSION_TITLE_MIN).max(SESSION_TITLE_MAX),
  description: z.string().max(SESSION_DESC_MAX).optional(),
  visibility: z.enum(["public", "private", "friends"]),
  focusDurationMinutes: z.number().int().min(SESSION_FOCUS_MIN).max(SESSION_FOCUS_MAX),
  breakDurationMinutes: z.number().int().min(SESSION_BREAK_MIN).max(SESSION_BREAK_MAX),
  maxParticipants: z.number().int().min(SESSION_PARTICIPANTS_MIN).max(SESSION_PARTICIPANTS_MAX),
  tags: z.array(z.string().max(30)).max(SESSION_TAGS_MAX).default([]),
  scheduledStart: z.string().datetime().optional(),
});

// List active/public sessions
sessionRouter.get("/", apiLimiter, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const status = req.query.status as string;
    const tag = req.query.tag as string;

    const where: Record<string, unknown> = { visibility: "public" };
    if (status && ["waiting", "active"].includes(status)) {
      where.status = status;
    } else {
      where.status = { in: ["waiting", "active"] };
    }
    if (tag) {
      where.tags = { has: tag };
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          host: { select: { id: true, displayName: true, avatarUrl: true } },
          _count: { select: { participants: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.session.count({ where }),
    ]);

    const data = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      hostName: s.host.displayName,
      status: s.status,
      participantCount: s._count.participants,
      maxParticipants: s.maxParticipants,
      focusDurationMinutes: s.focusDurationMinutes,
      tags: s.tags,
      startedAt: s.startedAt?.toISOString() ?? null,
    }));

    res.json({
      success: true,
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    next(err);
  }
});

// Get session by ID
sessionRouter.get("/:id", apiLimiter, async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        host: { select: { id: true, displayName: true, avatarUrl: true, bio: true, focusStreak: true } },
        participants: {
          where: { status: { not: "left" } },
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, bio: true, focusStreak: true } },
          },
        },
        focusBlocks: { orderBy: { round: "desc" }, take: 1 },
      },
    });

    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

// Create session
sessionRouter.post("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const input = createSessionSchema.parse(req.body);

    const session = await prisma.session.create({
      data: {
        ...input,
        hostId: req.userId!,
        participants: {
          create: {
            userId: req.userId!,
            status: "joined",
          },
        },
      },
      include: {
        host: { select: { id: true, displayName: true, avatarUrl: true, bio: true, focusStreak: true } },
        participants: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, bio: true, focusStreak: true } },
          },
        },
      },
    });

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.flatten().fieldErrors,
      });
      return;
    }
    next(err);
  }
});

// Join session
sessionRouter.post("/:id/join", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { participants: { where: { status: { not: "left" } } } } } },
    });

    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    if (session.status === "completed") {
      throw new AppError(400, "SESSION_ENDED", "This session has already ended");
    }

    if (session._count.participants >= session.maxParticipants) {
      throw new AppError(400, "SESSION_FULL", "This session is full");
    }

    const existing = await prisma.participant.findUnique({
      where: { userId_sessionId: { userId: req.userId!, sessionId: session.id } },
    });

    if (existing && existing.status !== "left") {
      throw new AppError(400, "ALREADY_JOINED", "You have already joined this session");
    }

    const participant = existing
      ? await prisma.participant.update({
          where: { id: existing.id },
          data: { status: "joined", leftAt: null },
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, bio: true, focusStreak: true } },
          },
        })
      : await prisma.participant.create({
          data: { userId: req.userId!, sessionId: session.id, status: "joined" },
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, bio: true, focusStreak: true } },
          },
        });

    res.status(201).json({ success: true, data: participant });
  } catch (err) {
    next(err);
  }
});

// Leave session
sessionRouter.post("/:id/leave", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: { userId_sessionId: { userId: req.userId!, sessionId: req.params.id } },
    });

    if (!participant || participant.status === "left") {
      throw new AppError(400, "NOT_IN_SESSION", "You are not in this session");
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: { status: "left", leftAt: new Date() },
    });

    res.json({ success: true, data: null, message: "Left session" });
  } catch (err) {
    next(err);
  }
});

// Check in
sessionRouter.post("/:id/check-in", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const checkInSchema = z.object({
      mood: z.number().int().min(1).max(5),
      energy: z.enum(["low", "medium", "high"]),
      intention: z.string().min(1).max(200),
    });

    const input = checkInSchema.parse(req.body);

    const participant = await prisma.participant.findUnique({
      where: { userId_sessionId: { userId: req.userId!, sessionId: req.params.id } },
    });

    if (!participant || participant.status === "left") {
      throw new AppError(400, "NOT_IN_SESSION", "You must join the session first");
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        userId: req.userId!,
        sessionId: req.params.id,
        mood: input.mood,
        energy: input.energy,
        intention: input.intention,
      },
    });

    res.status(201).json({ success: true, data: checkIn });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.flatten().fieldErrors,
      });
      return;
    }
    next(err);
  }
});
