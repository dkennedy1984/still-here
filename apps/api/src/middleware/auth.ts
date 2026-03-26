import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export interface AuthRequest extends Request {
  sessionId?: string;
}

/**
 * resolveIdentity — reads the sh_session signed cookie to identify the caller.
 * Does NOT reject anonymous requests. If no cookie exists, the caller is treated
 * as a brand-new anonymous user (the route handler creates a session).
 */
export async function resolveIdentity(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const sessionId = req.signedCookies?.sh_session;

    if (sessionId && typeof sessionId === "string") {
      // Verify the session still exists in DB
      const session = await prisma.session.findUnique({ where: { id: sessionId } });
      if (session) {
        req.sessionId = session.id;
      }
      // If session not found, treat as anonymous — route handler will create one
    }

    next();
  } catch {
    // On any error, continue as anonymous
    next();
  }
}
