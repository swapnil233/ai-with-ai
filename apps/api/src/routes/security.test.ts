import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { CSRF_COOKIE_NAME } from "../middleware/security.js";

describe("Security Routes", () => {
  describe("GET /api/security/csrf-token", () => {
    it("returns a CSRF token and sets CSRF cookie", async () => {
      const response = await request(app).get("/api/security/csrf-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("csrfToken");
      expect(typeof response.body.csrfToken).toBe("string");
      expect(response.body.csrfToken.length).toBeGreaterThan(10);

      const setCookieHeader = response.headers["set-cookie"];
      const serializedSetCookie = Array.isArray(setCookieHeader)
        ? setCookieHeader.join(";")
        : (setCookieHeader ?? "");

      expect(serializedSetCookie).toContain(CSRF_COOKIE_NAME);
    });
  });
});
