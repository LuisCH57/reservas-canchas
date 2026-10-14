// Le enseña a TypeScript que las peticiones de Express pueden tener
// un campo "user" (lo agrega el middleware requireAuth).
import type { AuthUser } from "./auth.ts";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
