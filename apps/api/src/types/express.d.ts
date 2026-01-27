import type { Session, User } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      session?: Session;
      user?: User;
    }
  }
}
