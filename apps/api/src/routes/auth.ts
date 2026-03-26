import { Router } from "express";
import { z } from "zod";
import { resolveIdentity, AuthRequest } from "../middleware/auth";
import { apiLimiter } from "../middleware/rate-limit";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error-handler";

export const authRouter: Router = Router();

const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

/**
 * POST /api/v1/auth/verify-email
 *
 * Links an email to the current session. In production this should send a
 * verification code and require a second confirm step. For now it directly
 * marks the email as verified so the rest of the flow works.
 *
 * If another session already owns this verified email, the email is
 * transferred to the current session (the old session loses it).
 */
authRouter.post("/verify-email", resolveIdentity, apiLimiter, async (req: AuthRequest, res, next) => {
  try {
    if (!req.sessionId) {
      throw new AppError(401, "NO_SESSION", "No active session. Start a call first.");
    }

    const { email } = verifyEmailSchema.parse(req.body);

    // If another session has this verified email, clear it from the old session
    await prisma.session.updateMany({
      where: {
        email,
        emailVerifiedAt: { not: null },
        id: { not: req.sessionId },
      },
      data: {
        email: null,
        emailVerifiedAt: null,
      },
    });

    // Link email to current session and mark as verified
    // TODO: In production, send a 6-digit code via email and require confirmation
    const session = await prisma.session.update({
      where: { id: req.sessionId },
      data: {
        email,
        emailVerifiedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        email: session.email,
        emailVerified: true,
        tier: session.tier,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/magic-link
 *
 * Sends a magic link to recover a session by email. The user clicks the link,
 * which sets the sh_session cookie to the session associated with that email.
 *
 * Stubbed for now — returns the sessionId directly for development.
 */
authRouter.post("/magic-link", apiLimiter, async (req, res, next) => {
  try {
    const { email } = verifyEmailSchema.parse(req.body);

    const session = await prisma.session.findFirst({
      where: {
        email,
        emailVerifiedAt: { not: null },
      },
      orderBy: { lastActiveAt: "desc" },
    });

    if (!session) {
      // Don't reveal whether the email exists
      res.json({
        success: true,
        message: "If an account exists with that email, a magic link has been sent.",
      });
      return;
    }

    // TODO: In production, send an actual email with a signed JWT link
    // For now, return the sessionId directly (development only)
    res.json({
      success: true,
      message: "If an account exists with that email, a magic link has been sent.",
      // Remove this in production:
      _dev: { sessionId: session.id },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/me
 *
 * Returns the current session info (replaces the old /me user profile endpoint).
 */
authRouter.get("/me", resolveIdentity, async (req: AuthRequest, res, next) => {
  try {
    if (!req.sessionId) {
      res.json({ success: true, data: null });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: req.sessionId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        tier: true,
        presenceStyle: true,
        transcriptOptIn: true,
        dailyMinutesUsed: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});
