// ==========================================================
// TIPOS: describen la FORMA de los datos. Solo existen para
// TypeScript; al ejecutar, Node los ignora.
// ==========================================================

// Un "tipo unión": role solo puede ser uno de estos dos textos
export type Role = "customer" | "admin";

// El usuario que viaja dentro del token
export interface AuthUser {
  id: number;
  name: string;
  role: Role;
}
