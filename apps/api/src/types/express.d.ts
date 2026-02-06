import type { Session, User } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      session?: Session;
      user?: User;
    }
  }
}
