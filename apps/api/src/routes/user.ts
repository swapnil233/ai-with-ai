import { Router, type Request, type Response } from "express";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { requireAuth } from "../middleware/auth.js";

const router: Router = Router();

// Get current session (public - returns null if not authenticated)
router.get("/me", async (req: Request, res: Response) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  res.json(session);
});

// Get user profile (protected)
router.get("/profile", requireAuth, (req: Request, res: Response) => {
  res.json({
    user: req.user,
    session: req.session,
  });
});

export { router as userRouter };
