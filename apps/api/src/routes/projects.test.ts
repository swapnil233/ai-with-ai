import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { mockGetSession, mockProjectCreate, mockProjectFindFirst, mockProjectFindMany } = vi.hoisted(
  () => ({
    mockGetSession: vi.fn(),
    mockProjectCreate: vi.fn(),
    mockProjectFindFirst: vi.fn(),
    mockProjectFindMany: vi.fn(),
  })
);

vi.mock("../lib/auth.js", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    project: {
      create: mockProjectCreate,
      findFirst: mockProjectFindFirst,
      findMany: mockProjectFindMany,
    },
  },
}));

import { app } from "../app.js";

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

describe("Project Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/projects", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const response = await request(app).get("/api/projects");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
    });

    it("returns projects for the authenticated user", async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockProjectFindMany.mockResolvedValueOnce([
        {
          id: "project-1",
          name: "Landing Page",
          description: "Marketing site",
          userId: "user-123",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ]);

      const response = await request(app).get("/api/projects");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Landing Page");
      expect(mockProjectFindMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        orderBy: { updatedAt: "desc" },
      });
    });
  });

  describe("POST /api/projects", () => {
    it("returns 400 for an invalid payload", async () => {
      mockGetSession.mockResolvedValue(createMockSession());

      const response = await request(app).post("/api/projects").send({ name: "" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Project name is required" });
      expect(mockProjectCreate).not.toHaveBeenCalled();
    });

    it("creates a project for the authenticated user", async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockProjectCreate.mockResolvedValueOnce({
        id: "project-2",
        name: "CRM Dashboard",
        description: null,
        userId: "user-123",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      });

      const response = await request(app).post("/api/projects").send({
        name: "CRM Dashboard",
      });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe("project-2");
      expect(response.body.name).toBe("CRM Dashboard");
      expect(mockProjectCreate).toHaveBeenCalledWith({
        data: {
          name: "CRM Dashboard",
          description: null,
          userId: "user-123",
        },
      });
    });
  });

  describe("GET /api/projects/:projectId", () => {
    it("returns a project when the authenticated user owns it", async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockProjectFindFirst.mockResolvedValueOnce({
        id: "project-1",
        name: "Landing Page",
        description: null,
        userId: "user-123",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      const response = await request(app).get("/api/projects/project-1");

      expect(response.status).toBe(200);
      expect(response.body.id).toBe("project-1");
      expect(mockProjectFindFirst).toHaveBeenCalledWith({
        where: {
          id: "project-1",
          userId: "user-123",
        },
      });
    });

    it("returns 404 when project does not exist for the user", async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockProjectFindFirst.mockResolvedValueOnce(null);

      const response = await request(app).get("/api/projects/project-404");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Project not found" });
    });
  });
});
