import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { config } from "./config";
import { authRouter } from "./routes/auth";
import { sessionRouter } from "./routes/sessions";
import { callRouter } from "./routes/calls";
import { billingRouter, billingWebhookHandler } from "./routes/billing";
import { errorHandler } from "./middleware/error-handler";
import { setupWebSocket } from "./ws";
import { prisma } from "./lib/prisma";

const app = express();
app.set('trust proxy', 1);
const server = createServer(app);

// Billing webhook must receive raw body — mount before express.json()
app.use("/api/billing/webhook", express.raw({ type: "application/json" }), billingWebhookHandler);

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const allowed = config.corsOrigins;

      // Explicit wildcard
      if (allowed.includes("*")) return callback(null, true);

      // Exact match against configured origins
      if (allowed.includes(origin)) return callback(null, true);

      // Also allow any Vercel preview/production URL for this project
      if (origin.endsWith(".vercel.app") || origin.endsWith(".vercel.sh"))
        return callback(null, true);

      // Allow sitwithyou.app domain
      if (origin.endsWith(".sitwithyou.app") || origin === "https://sitwithyou.app")
        return callback(null, true);

      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser(config.cookieSecret));
console.log('[server] COOKIE_SECRET set:', !!process.env.COOKIE_SECRET);

// Health-check
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/sessions", sessionRouter);
app.use("/api/v1/calls", callRouter);
app.use("/api/billing", billingRouter);

// Error handler
app.use(errorHandler);

// Start
setupWebSocket(server);

server.listen(config.port, () => {
  console.log(`[api] listening on :${config.port}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[api] SIGTERM received, shutting down");
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
