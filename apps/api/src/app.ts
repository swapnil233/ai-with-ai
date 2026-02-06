import express, { type Express } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { healthRouter } from "./routes/health.js";
import { projectsRouter } from "./routes/projects.js";
import { userRouter } from "./routes/user.js";

const app: Express = express();

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// CRITICAL: Mount better-auth handler BEFORE express.json()
// better-auth handles its own body parsing
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

// Routes
app.use("/health", healthRouter);
app.use("/api/user", userRouter);
app.use("/api/projects", projectsRouter);

export { app };
