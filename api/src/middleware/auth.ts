// ==========================================================
// Middlewares de seguridad: se ponen ANTES de las rutas protegidas
// ==========================================================
import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../auth/token.ts";
import type { Role } from "../types/auth.ts";

// 1. AUTENTICACIÓN: ¿quién eres?
// Exige el encabezado "Authorization: Bearer <token>".
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: "Tu sesión expiró o no es válida. Inicia sesión otra vez." });
  }

  req.user = user; // las rutas siguientes ya saben quién hace la petición
  next();
}

// 2. AUTORIZACIÓN: ¿tienes permiso?
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
