import express, { type Express } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { getTrustedOrigins } from "./lib/security-config.js";
import {
  applySecurityHeaders,
  attachRequestId,
  rateLimitRequests,
  requireCsrfProtection,
} from "./middleware/security.js";
import { healthRouter } from "./routes/health.js";
import { projectsRouter } from "./routes/projects.js";
import { securityRouter } from "./routes/security.js";
import { userRouter } from "./routes/user.js";

const app: Express = express();
const trustedOrigins = getTrustedOrigins();
const requestBodyLimit = process.env.API_BODY_LIMIT || "1mb";

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, trustedOrigins.includes(origin));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-Id"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(attachRequestId);
app.use(applySecurityHeaders);
app.use(rateLimitRequests);

// CRITICAL: Mount better-auth handler BEFORE express.json()
// better-auth handles its own body parsing
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
app.use(requireCsrfProtection);

// Routes
app.use("/health", healthRouter);
app.use("/api/security", securityRouter);
app.use("/api/user", userRouter);
app.use("/api/projects", projectsRouter);

export { app };
