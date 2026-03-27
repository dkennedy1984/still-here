import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const authRouter: Router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const MAGIC_LINK_BASE_URL = process.env.MAGIC_LINK_BASE_URL || process.env.API_BASE_URL || "http://localhost:4000";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Still Here <hello@sitwithyou.app>";

// POST /api/v1/auth/magic-link
authRouter.post("/magic-link", async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const magicToken = await prisma.magicToken.create({
      data: {
        email: normalizedEmail,
        expiresAt,
      },
    });

    const magicLinkUrl = `${MAGIC_LINK_BASE_URL}/api/v1/auth/verify?token=${magicToken.token}`;

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: normalizedEmail,
        subject: "Your link to Still Here",
        html:
          "<p>Hi,</p>" +
          "<p>Click the link below to access Still Here on this device:</p>" +
          '<p><a href="' + magicLinkUrl + '">Open Still Here</a></p>' +
          "<p>This link expires in 15 minutes.</p>" +
          "<p>If you did not request this, you can ignore this email.</p>",
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text().catch(() => "unknown");
      console.error("[auth] Resend error:", emailRes.status, errText);
      return res.status(500).json({ success: false, error: "Failed to send email" });
    }

    console.log("[auth] magic link sent to", normalizedEmail);
    return res.json({ success: true, message: "Check your email" });
  } catch (err) {
    console.error("[auth] magic-link error:", err);
    return res.status(500).json({ success: false, error: "Internal error" });
  }
});

// GET /api/v1/auth/verify?token=TOKEN  — redirect flow (used from email link)
authRouter.get("/verify", async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };

  if (!token) {
    return res.redirect(`${FRONTEND_URL}/upgrade?error=expired`);
  }

  try {
    const magicToken = await prisma.magicToken.findUnique({
      where: { token },
    });

    if (
      !magicToken ||
      magicToken.used ||
      magicToken.expiresAt < new Date()
    ) {
      return res.redirect(`${FRONTEND_URL}/upgrade?error=expired`);
    }

    // Mark token as used
    await prisma.magicToken.update({
      where: { id: magicToken.id },
      data: { used: true },
    });

    // Find or create session by email
    let session = await prisma.session.findFirst({
      where: { email: magicToken.email },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      session = await prisma.session.create({
        data: {
          email: magicToken.email,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          tier: "paid",
        },
      });
    } else {
      session = await prisma.session.update({
        where: { id: session.id },
        data: {
          tier: "paid",
          emailVerified: true,
          emailVerifiedAt: session.emailVerifiedAt ?? new Date(),
        },
      });
    }

    // Link token to session
    await prisma.magicToken.update({
      where: { id: magicToken.id },
      data: { sessionId: session.id },
    });

    // Set session cookie (1 year)
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("sh_session", session.id, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

    console.log("[auth] verified magic link for", magicToken.email, "-> session", session.id);
    return res.redirect(`${FRONTEND_URL}/?verified=true`);
  } catch (err) {
    console.error("[auth] verify error:", err);
    return res.redirect(`${FRONTEND_URL}/upgrade?error=expired`);
  }
});

// POST /api/v1/auth/magic-link/verify — JSON flow (for frontend polling or direct use)
authRouter.post("/magic-link/verify", async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    return res.status(400).json({ success: false, error: "Token required" });
  }

  try {
    const magicToken = await prisma.magicToken.findUnique({
      where: { token },
    });

    if (
      !magicToken ||
      magicToken.used ||
      magicToken.expiresAt < new Date()
    ) {
      return res.status(400).json({ success: false, error: "expired" });
    }

    // Mark token as used
    await prisma.magicToken.update({
      where: { id: magicToken.id },
      data: { used: true },
    });

    // Find or create session by email
    let session = await prisma.session.findFirst({
      where: { email: magicToken.email },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      session = await prisma.session.create({
        data: {
          email: magicToken.email,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          tier: "paid",
        },
      });
    } else {
      session = await prisma.session.update({
        where: { id: session.id },
        data: {
          tier: "paid",
          emailVerified: true,
          emailVerifiedAt: session.emailVerifiedAt ?? new Date(),
        },
      });
    }

    // Link token to session
    await prisma.magicToken.update({
      where: { id: magicToken.id },
      data: { sessionId: session.id },
    });

    // Set session cookie (1 year)
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("sh_session", session.id, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

    console.log("[auth] JSON verify for", magicToken.email, "-> session", session.id);
    return res.json({ success: true, sessionId: session.id, tier: session.tier });
  } catch (err) {
    console.error("[auth] magic-link/verify error:", err);
    return res.status(500).json({ success: false, error: "Internal error" });
  }
});
