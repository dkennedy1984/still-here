import { Router } from "express";
import jwt from "jsonwebtoken";
import { resolveIdentity, AuthRequest } from "../middleware/auth";
import { apiLimiter } from "../middleware/rate-limit";
import { prisma } from "../lib/prisma";
import { config } from "../config";

export const callRouter: Router = Router();

const ANON_DAILY_LIMIT = 15;   // minutes before email required
const FREE_DAILY_LIMIT = 30;   // minutes for verified free users
// pro tier: unlimited

function startOfDay(): Date {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now;
}

/**
 * Resets dailyMinutesUsed if the last reset was before today.
 */
async function ensureDailyReset(sessionId: string, minutesResetAt: Date): Promise<number> {
  const today = startOfDay();
  if (minutesResetAt < today) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { dailyMinutesUsed: 0, minutesResetAt: today },
    });
    return 0;
  }
  return -1; // no reset needed, caller should use existing value
}

// POST /api/v1/calls/session — create or resume a session, then create a call
callRouter.post("/session", resolveIdentity, apiLimiter, async (req: AuthRequest, res, next) => {
  try {
    const sessionId = req.sessionId;
    const { presenceStyle: rawPresenceStyle, voice: rawVoice } = (req as any).body || {};
    const presenceStyle = rawPresenceStyle || 'quiet';
    const voice = rawVoice || 'her';


    let session: {
      id: string;
      email: string | null;
      emailVerifiedAt: Date | null;
      tier: string;
      dailyMinutesUsed: number;
      minutesResetAt: Date;
    };

    if (sessionId) {
      // Existing session from cookie
      const existing = await prisma.session.findUnique({ where: { id: sessionId } });
      if (existing) {
        session = existing;
        // Touch lastActiveAt
        await prisma.session.update({
          where: { id: session.id },
          data: { lastActiveAt: new Date() },
        });
      } else {
        // Cookie references a deleted session — create a new one
        const created = await prisma.session.create({ data: {} });
        session = created;
        setSessionCookie(res, created.id);
      }
    } else {
      // No cookie — new anonymous session
      const created = await prisma.session.create({ data: {} });
      session = created;
      setSessionCookie(res, created.id);
    }

    // --- Enforce daily minute limits ---
    const resetResult = await ensureDailyReset(session.id, session.minutesResetAt);
    const minutesUsed = resetResult >= 0 ? resetResult : session.dailyMinutesUsed;

    if (session.tier !== "pro") {
      const limit = session.emailVerifiedAt ? FREE_DAILY_LIMIT : ANON_DAILY_LIMIT;

      if (minutesUsed >= limit) {
        if (!session.emailVerifiedAt) {
          res.status(403).json({
            success: false,
            error: "Daily anonymous limit reached. Verify your email to continue.",
            code: "EMAIL_REQUIRED",
            minutesUsed,
            limit,
          });
          return;
        }
        res.status(403).json({
          success: false,
          error: "Daily free-tier limit reached. Upgrade to pro for unlimited usage.",
          code: "LIMIT_REACHED",
          minutesUsed,
          limit,
        });
        return;
      }
    }

    // --- Create the call ---
    const callId = crypto.randomUUID();
    const wsTicket = jwt.sign(
      {
        callerId: session.id,
        sessionId: session.id,
        callId,
        presenceStyle,
        voice,
      },
      config.jwt.secret,
      { expiresIn: "5m" }
    );

    const call = await prisma.call.create({
      data: {
        id: callId,
        sessionId: session.id,
        wsTicket,
        presenceStyle,
      },
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        callId: call.id,
        wsTicket,
        tier: session.tier,
        minutesUsed,
        emailVerified: !!session.emailVerifiedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

function setSessionCookie(res: any, sessionId: string) {
  res.cookie("sh_session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    signed: true,
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
  });
}
