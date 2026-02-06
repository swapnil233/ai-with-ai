import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("Security Hardening", () => {
  it("adds request id, security headers, and rate-limit headers", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["permissions-policy"]).toContain("camera=()");
    expect(response.headers["x-ratelimit-limit"]).toBeTruthy();
    expect(response.headers["x-ratelimit-remaining"]).toBeTruthy();
  });
});
