import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { logAuditEvent } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { getRequestIp } from "../middleware/security.js";

const router: Router = Router();

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(100),
  description: z.string().trim().max(1000).optional(),
});

// List projects for the authenticated user
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  res.json(projects);
});

// Create a new project for the authenticated user
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsedBody = createProjectSchema.safeParse(req.body);

  if (!parsedBody.success) {
    const issue = parsedBody.error.issues[0];
    res.status(400).json({ error: issue?.message ?? "Invalid request body" });
    return;
  }

  const description = parsedBody.data.description?.trim();
  const createdProject = await prisma.project.create({
    data: {
      name: parsedBody.data.name,
      description: description && description.length > 0 ? description : null,
      userId,
    },
  });

  logAuditEvent({
    action: "project.create",
    requestId: req.requestId,
    status: "success",
    sourceIp: getRequestIp(req),
    userId,
    metadata: {
      projectId: createdProject.id,
      projectName: createdProject.name,
    },
  });

  res.status(201).json(createdProject);
});

// Fetch one project by ID, scoped to authenticated user ownership
router.get("/:projectId", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const rawProjectId = req.params.projectId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (typeof rawProjectId !== "string" || rawProjectId.trim().length === 0) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const projectId = rawProjectId;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
  });

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(project);
});

export { router as projectsRouter };
