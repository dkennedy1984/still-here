import { Router } from "express";
import jwt from "jsonwebtoken";
import { resolveIdentity, AuthRequest } from "../middleware/auth";
import { apiLimiter } from "../middleware/rate-limit";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { createHash } from "crypto";

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

function hashIP(ip: string): string {
  return createHash('sha256').update(ip + (process.env.COOKIE_SECRET || 'salt')).digest('hex').substring(0, 16);
}

// POST /api/v1/calls/session — create or resume a session, then create a call
callRouter.post("/session", resolveIdentity, apiLimiter, async (req: AuthRequest, res, next) => {
  try {
    // Direct signed cookie check (belt-and-suspenders on top of resolveIdentity)
    const signedSessionId = (req as any).signedCookies?.sh_session;
    console.log('[session] signedCookies.sh_session:', signedSessionId || 'NONE');
    console.log('[session] req.sessionId (from resolveIdentity):', req.sessionId || 'NONE');
    const sessionId = signedSessionId || req.sessionId;
    const clientIP = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || (req as any).ip || 'unknown';
    const ipHash = hashIP(clientIP);
    const { presenceStyle: rawPresenceStyle, voice: rawVoice } = (req as any).body || {};
    const presenceStyle = rawPresenceStyle || 'quiet';
    const voice = rawVoice || 'her';


    let session: {
      id: string;
      email: string | null;
      emailVerifiedAt: Date | null;
      emailVerified: boolean;
      tier: string;
      dailyMinutesUsed: number;
      minutesResetAt: Date;
      monthlyMinutesUsed: number;
      monthlyCallCount: number;
      monthlyResetAt: Date;
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
        const created = await prisma.session.create({ data: { ipHash } });
        session = created;
        setSessionCookie(res, created.id);
      }
    } else {
      // No cookie — new anonymous session
      const created = await prisma.session.create({ data: { ipHash } });
      session = created;
      setSessionCookie(res, created.id);
    }

    // --- Limit tracking (set to true to allow call with farewell instead of 403) ---
    let limitReached = false;
    let limitType = '';

    // --- IP-based abuse prevention for anonymous users ---
    if (!session.email && session.tier !== 'PAID' && session.tier !== 'pro') {
      const ipSessions = await prisma.session.findMany({
        where: { ipHash },
      });
      const totalMinutes = ipSessions.reduce((sum, s) => sum + (s.monthlyMinutesUsed || 0), 0);
      const totalCalls = ipSessions.reduce((sum, s) => sum + (s.monthlyCallCount || 0), 0);
      if (totalMinutes >= 30 || totalCalls >= 5) {
        console.log('[session] IP limit reached:', ipHash, 'minutes:', totalMinutes, 'calls:', totalCalls);
        limitReached = true;
        limitType = 'ip_limit';
      }
    }

        // --- Enforce free tier limits ---
    const resetResult = await ensureDailyReset(session.id, session.minutesResetAt);
    const minutesUsed = resetResult >= 0 ? resetResult : session.dailyMinutesUsed;

    // Check if this is a returning user without email (second call gate)
    const callCount = await prisma.call.count({ where: { sessionId: session.id } });
    if (!session.email && callCount >= 1 && session.tier !== 'PAID' && session.tier !== 'pro') {
      console.log('[session] email required for second call — allowing with farewell');
      limitReached = true;
      limitType = 'email_required';
    }

    // Check monthly limits for free users with email
    if (session.tier !== 'PAID' && session.tier !== 'pro' && session.email) {
      // Reset monthly counters if needed
      const now = new Date();
      const resetAt = new Date(session.monthlyResetAt);
      if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
        await prisma.session.update({
          where: { id: session.id },
          data: { monthlyMinutesUsed: 0, monthlyCallCount: 0, monthlyResetAt: now },
        });
        session.monthlyMinutesUsed = 0;
        session.monthlyCallCount = 0;
      }

      console.log('[session] monthly check: calls=' + session.monthlyCallCount + '/5, minutes=' + session.monthlyMinutesUsed + '/30');
      if (session.monthlyCallCount >= 5) {
        console.log('[session] monthly limit reached (calls):', session.monthlyCallCount, '— allowing call with farewell');
        limitReached = true;
        limitType = 'monthly_calls';
      } else if (session.monthlyMinutesUsed >= 30) {
        console.log('[session] monthly limit reached (minutes):', session.monthlyMinutesUsed, '— allowing call with farewell');
        limitReached = true;
        limitType = 'monthly_minutes';
      }

      if (!limitReached) {
        // Increment call count only when within limit
        await prisma.session.update({
          where: { id: session.id },
          data: { monthlyCallCount: { increment: 1 } },
        });
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
        limitReached,
        limitType,
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
        limitReached,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/calls/register-email — register email for free tier
callRouter.post('/register-email', async (req, res) => {
  const sessionId = req.signedCookies?.sh_session || req.cookies?.sh_session;
  if (!sessionId) return res.status(400).json({ error: 'No session' });
  
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });
  
  const currentSession = await prisma.session.findUnique({ where: { id: sessionId } }).catch(() => null);
  if (!currentSession) return res.status(400).json({ error: 'Session not found' });
  
  // Check if email already exists on another session
  const existingSession = await prisma.session.findFirst({ 
    where: { email, id: { not: sessionId } } 
  }).catch(() => null);
  
  if (existingSession) {
    // Merge: transfer usage from existing session to current session
    console.log('[session] merging sessions for email:', email, 'old:', existingSession.id, 'new:', sessionId);
    
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        email,
        emailVerified: existingSession.emailVerified,
        tier: existingSession.tier, // Keep paid status if they were paid
        subscriptionId: existingSession.subscriptionId,
        monthlyMinutesUsed: existingSession.monthlyMinutesUsed,
        monthlyCallCount: existingSession.monthlyCallCount,
        monthlyResetAt: existingSession.monthlyResetAt,
      },
    });
    
    // Move calls from old session to new
    await prisma.call.updateMany({
      where: { sessionId: existingSession.id },
      data: { sessionId: sessionId },
    });
    
    // Delete old session
    await prisma.session.delete({ where: { id: existingSession.id } }).catch(() => {});
    
    console.log('[session] merge complete, usage carried over');
  } else {
    // New email - just update current session
    await prisma.session.update({
      where: { id: sessionId },
      data: { email },
    });
    console.log('[session] email registered:', email);
  }
  
  // Send welcome email with magic link
  const magicToken = require('crypto').randomUUID();
  await prisma.magicToken.create({
    data: {
      email,
      token: magicToken,
      sessionId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
    },
  }).catch(() => {});
  
  const magicLinkUrl = `${process.env.MAGIC_LINK_BASE_URL || 'https://stillhere-api.onrender.com'}/api/auth/verify?token=${magicToken}`;
  
  // Send branded welcome email
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'Sit With You <hello@sitwithyou.app>';
  if (apiKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'Your link to Sit With You',
        html: `<div style="font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 0;">
  <div style="background: #0f172a; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
    <tr>
      <td style="vertical-align: middle; padding-right: 10px;">
        <div style="width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 38% 35%, #ffffff 0%, #6ee7a0 40%, #22a85a 100%); display: inline-block;"></div>
      </td>
      <td style="vertical-align: middle;">
        <span style="color: #ffffff; font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; font-size: 18px; font-weight: 500; letter-spacing: -0.3px;">Sit With You</span>
      </td>
    </tr>
  </table>
  </div>
  <div style="background: #ffffff; padding: 32px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Hi,</p>
    <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Thanks for trying Sit With You. Here's your personal link — bookmark it or come back to this email whenever you need quiet company.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${magicLinkUrl}" style="display: inline-block; padding: 14px 32px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 999px; font-size: 16px; font-weight: 500;">Open Sit With You</a>
    </div>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 16px;">Your free plan includes 5 calls per month, up to 30 minutes total. If you'd like unlimited sessions, you can <a href="https://sitwithyou.app/upgrade" style="color: #16a34a; text-decoration: none; font-weight: 500;">upgrade anytime</a>.</p>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 24px;">If you have any questions, reach us at <a href="mailto:support@sitwithyou.app" style="color: #16a34a; text-decoration: none;">support@sitwithyou.app</a></p>
    <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0;">Take care,<br/>Sit With You</p>
    <div style="border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 16px;">
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;"><a href="https://sitwithyou.app/terms" style="color: #9ca3af; text-decoration: underline;">Terms</a> · <a href="https://sitwithyou.app/privacy" style="color: #9ca3af; text-decoration: underline;">Privacy</a></p>
    </div>
  </div>
</div>`
      }),
    }).then(r => {
      if (r.ok) console.log('[email] welcome sent to:', email);
      else console.error('[email] failed:', r.status);
    }).catch(err => console.error('[email] error:', err));
  }
  
  return res.json({ success: true });
});

// GET /api/v1/calls/tier — return tier for the current session
callRouter.get('/tier', async (req, res) => {
  const sessionId = (req as any).signedCookies?.sh_session || (req as any).cookies?.sh_session;
  if (!sessionId) return res.json({ tier: 'free' });

  const session = await prisma.session.findUnique({ where: { id: sessionId } }).catch(() => null);
  return res.json({ tier: session?.tier?.toLowerCase() || 'free' });
});

function setSessionCookie(res: any, sessionId: string) {
  res.cookie("sh_session", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    signed: true,
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
  });
}
