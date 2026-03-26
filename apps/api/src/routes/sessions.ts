import { Router } from "express";
import { apiLimiter } from "../middleware/rate-limit";
import { prisma } from "../lib/prisma";

export const sessionRouter: Router = Router();

/**
 * GET /api/v1/sessions
 * List recent sessions (public, read-only).
 */
sessionRouter.get("/", apiLimiter, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastActiveAt: "desc" },
        select: {
          id: true,
          presenceStyle: true,
          tier: true,
          createdAt: true,
          lastActiveAt: true,
          _count: { select: { calls: true } },
        },
      }),
      prisma.session.count(),
    ]);

    res.json({
      success: true,
      data: sessions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sessions/:id
 * Get a single session by ID (public, read-only).
 */
sessionRouter.get("/:id", apiLimiter, async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        presenceStyle: true,
        tier: true,
        createdAt: true,
        lastActiveAt: true,
        calls: {
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
            durationSeconds: true,
            presenceStyle: true,
          },
          orderBy: { startedAt: "desc" },
          take: 20,
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, error: "Session not found", code: "NOT_FOUND" });
      return;
    }

    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});
