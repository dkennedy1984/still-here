import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { prisma } from "../lib/prisma";

export interface AuthRequest extends Request {
  userId?: string;
}

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
