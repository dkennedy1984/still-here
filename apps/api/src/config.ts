import dotenv from "dotenv";
dotenv.config();

function parseCorsOrigins(raw?: string): string[] {
  if (!raw) return ["http://localhost:3000"];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  },
} as const;
