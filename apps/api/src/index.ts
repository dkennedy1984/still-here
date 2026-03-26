import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { config } from "./config";
import { authRouter } from "./routes/auth";
import { sessionRouter } from "./routes/sessions";
import { userRouter } from "./routes/users";
import { callRouter } from "./routes/calls";
import { errorHandler } from "./middleware/error-handler";
import { setupWebSocket } from "./ws";
import { prisma } from "./lib/prisma";

const app = express();
const server = createServer(app);

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
      if (origin.endsWith(".vercel.app") || origin.endsWith(".vercel.sh")) {
        return callback(null, true);
      }

      // Reject cleanly (don't throw — that crashes the request)
      console.warn(`CORS rejected origin: ${origin}. Allowed: ${allowed.join(", ")}`);
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/sessions", sessionRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/calls", callRouter);

// Error handler
app.use(errorHandler);

// WebSocket
setupWebSocket(server);

// Start
async function main() {
  try {
    await prisma.$connect();
    console.log("Connected to database");

    server.listen(config.port, () => {
      console.log(`Still Here API running on port ${config.port}`);
      console.log(`WebSocket server ready`);
      console.log(`CORS origins: ${config.corsOrigins.join(", ")}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down...");
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
