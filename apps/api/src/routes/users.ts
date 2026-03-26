import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error-handler";

export const userRouter: Router = Router();

// Get user profile
userRouter.get("/:id/profile", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        focusStreak: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// Get user stats
userRouter.get("/me/stats", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalSessions, totalFocusResult, weekSessions, weekFocusResult, checkIns, user] =
      await Promise.all([
        prisma.participant.count({ where: { userId } }),
        prisma.participant.aggregate({ where: { userId }, _sum: { totalFocusMinutes: true } }),
        prisma.participant.count({ where: { userId, joinedAt: { gte: weekAgo } } }),
        prisma.participant.aggregate({
          where: { userId, joinedAt: { gte: weekAgo } },
          _sum: { totalFocusMinutes: true },
        }),
        prisma.checkIn.aggregate({ where: { userId }, _avg: { mood: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { focusStreak: true } }),
      ]);

    const stats = {
      totalSessions,
      totalFocusMinutes: totalFocusResult._sum.totalFocusMinutes || 0,
      currentStreak: user?.focusStreak || 0,
      longestStreak: user?.focusStreak || 0,
      sessionsThisWeek: weekSessions,
      focusMinutesThisWeek: weekFocusResult._sum.totalFocusMinutes || 0,
      averageMood: checkIns._avg.mood ? Math.round(checkIns._avg.mood * 10) / 10 : 0,
      favoriteTimeOfDay: null,
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// Update profile
userRouter.patch("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { displayName, bio, avatarUrl } = req.body;
    const updates: Record<string, unknown> = {};

    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: updates,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        focusStreak: true,
      },
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});
