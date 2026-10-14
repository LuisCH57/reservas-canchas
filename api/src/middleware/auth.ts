// ==========================================================
// Middlewares de seguridad: se ponen ANTES de las rutas protegidas
// ==========================================================
import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../auth/token.ts";
import type { AuthUser, Role } from "../types/auth.ts";

// Lee "Authorization: Bearer <token>" y devuelve el usuario, o null
function readUser(req: Request): AuthUser | null {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return verifyToken(token);
}

// 1. AUTENTICACIÓN OBLIGATORIA: ¿quién eres?
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const hasHeader = Boolean(req.headers.authorization);
  const user = readUser(req);

  if (!user) {
    const message = hasHeader
      ? "Tu sesión expiró o no es válida. Inicia sesión otra vez."
      : "Debes iniciar sesión.";
    return res.status(401).json({ error: message });
  }

  req.user = user; // las rutas siguientes ya saben quién hace la petición
  next();
}

// 2. AUTENTICACIÓN OPCIONAL: si hay sesión la usamos, si no, seguimos igual.
// Sirve para rutas públicas que muestran algo extra a quien inició sesión.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const user = readUser(req);
  if (user) {
    req.user = user;
  }
  next();
}

// 3. AUTORIZACIÓN: ¿tienes permiso?
// requireRole("admin") devuelve un middleware que solo deja pasar a administradores.
// Se usa SIEMPRE después de requireAuth.
export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: "No tienes permiso para realizar esta acción." });
    }
    next();
  };
}
