import express, { type Express } from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";

const app: Express = express();

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use("/health", healthRouter);

export { app };
