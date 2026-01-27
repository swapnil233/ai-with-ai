import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";

// Mock the auth module
vi.mock("../lib/auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Import the mocked module
import { auth } from "../lib/auth.js";

const mockGetSession = vi.mocked(auth.api.getSession);

const createMockSession = () => ({
  session: {
    id: "session-123",
    userId: "user-123",
    token: "token-abc",
    expiresAt: new Date("2026-02-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ipAddress: null,
    userAgent: null,
  },
  user: {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    emailVerified: true,
    image: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
});

describe("User Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/user/me", () => {
    it("returns session when authenticated", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValueOnce(mockSession);

      const response = await request(app)
        .get("/api/user/me")
        .set("Cookie", "better-auth.session_token=test-token");

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe(mockSession.user.email);
      expect(response.body.session.id).toBe(mockSession.session.id);
    });

    it("returns null when not authenticated", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const response = await request(app).get("/api/user/me");

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });

  describe("GET /api/user/profile", () => {
    it("returns user profile when authenticated", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue(mockSession);

      const response = await request(app)
        .get("/api/user/profile")
        .set("Cookie", "better-auth.session_token=test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("session");
      expect(response.body.user.email).toBe("test@example.com");
    });

    it("returns 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const response = await request(app).get("/api/user/profile");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Unauthorized");
    });
  });
});
