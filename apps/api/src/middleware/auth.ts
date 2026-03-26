import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { prisma } from "../lib/prisma";

export interface AuthRequest extends Request {
  userId?: string;
  anonymousId?: string;
}

/**
 * requireAuth — strict JWT-based auth for routes that need a registered user.
 * Checks the "token" cookie or Authorization Bearer header.
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({ success: false, error: "Authentication required", code: "UNAUTHORIZED" });
      return;
    }

    const payload = jwt.verify(token, config.jwt.secret) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      res.status(401).json({ success: false, error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid token", code: "INVALID_TOKEN" });
  }
}

/**
 * resolveIdentity — attempts to identify the caller without rejecting anonymous
 * requests. Checks JWT first (cookie/header), then falls back to the sh_session
 * signed cookie. If neither exists, generates a new anonymous ID and sets the
 * sh_session cookie so the caller is tracked across requests.
 */
export async function resolveIdentity(req: AuthRequest, res: Response, next: NextFunction) {
  // 1. Try JWT auth (registered user)
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (token) {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as { userId: string };
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user) {
        req.userId = user.id;
        next();
        return;
      }
    } catch {
      // Token invalid — fall through to anonymous
    }
  }

  // 2. Try sh_session signed cookie (anonymous returning visitor)
  const sessionCookie = req.signedCookies?.sh_session;
  if (sessionCookie) {
    req.anonymousId = sessionCookie;
    next();
    return;
  }

  // 3. First visit — generate anonymous ID and set signed cookie
  const anonId = crypto.randomUUID();
  res.cookie("sh_session", anonId, {
    httpOnly: true,
    signed: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  req.anonymousId = anonId;
  next();
}
