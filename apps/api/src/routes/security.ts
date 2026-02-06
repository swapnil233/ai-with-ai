import { Router, type Request, type Response } from "express";
import { createCsrfToken, setCsrfCookie } from "../middleware/security.js";

const router: Router = Router();

router.get("/csrf-token", (_req: Request, res: Response) => {
  const csrfToken = createCsrfToken();
  setCsrfCookie(res, csrfToken);
  res.setHeader("cache-control", "no-store");
  res.json({ csrfToken });
});

export { router as securityRouter };
