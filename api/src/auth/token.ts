// ==========================================================
// Tokens JWT: el "pase" que demuestra quién eres
// ==========================================================
// Un JWT tiene 3 partes separadas por puntos: encabezado.datos.firma
// Los datos NO están cifrados (cualquiera puede leerlos), pero la FIRMA
// garantiza que nadie los modificó: solo el servidor conoce JWT_SECRET.
import jwt from "jsonwebtoken";
import { config } from "../config.ts";
import type { AuthUser, Role } from "../types/auth.ts";

const TOKEN_DURATION = "8h"; // después de 8 horas hay que volver a iniciar sesión

export function createToken(user: AuthUser): string {
  return jwt.sign({ name: user.name, role: user.role }, config.jwtSecret, {
    subject: String(user.id), // "sub": a quién pertenece el token
    expiresIn: TOKEN_DURATION,
  });
}

// Devuelve el usuario si el token es válido, o null si es falso o expiró
export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "string" || !payload.sub) {
      return null;
    }
    return {
      id: Number(payload.sub),
      name: String(payload.name),
      role: payload.role as Role,
    };
  } catch {
    return null; // firma inválida, token mal formado o expirado
  }
}
