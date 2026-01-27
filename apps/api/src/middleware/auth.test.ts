import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireAuth, optionalAuth } from "./auth.js";

// Mock the auth module
vi.mock("../lib/auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("better-auth/node", () => ({
  fromNodeHeaders: vi.fn((headers) => headers),
}));

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

describe("Auth Middleware", () => {
  let mockReq: Request;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      headers: {},
    } as unknown as Request;

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe("requireAuth", () => {
    it("calls next() and attaches session when authenticated", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValueOnce(mockSession);

      await requireAuth(mockReq, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.session).toEqual(mockSession.session);
      expect(mockReq.user).toEqual(mockSession.user);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("returns 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      await requireAuth(mockReq, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("optionalAuth", () => {
    it("attaches session and calls next() when authenticated", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValueOnce(mockSession);

      await optionalAuth(mockReq, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.session).toEqual(mockSession.session);
      expect(mockReq.user).toEqual(mockSession.user);
    });

    it("calls next() without session when not authenticated", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      await optionalAuth(mockReq, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.session).toBeUndefined();
      expect(mockReq.user).toBeUndefined();
    });
  });
});
