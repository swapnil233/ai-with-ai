import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("GET /health", () => {
  it("returns status ok with timestamp and uptime", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("uptime");
    expect(typeof response.body.uptime).toBe("number");
  });

  it("returns a valid ISO timestamp", async () => {
    const response = await request(app).get("/health");

    const timestamp = new Date(response.body.timestamp);
    expect(timestamp.toISOString()).toBe(response.body.timestamp);
  });
});
