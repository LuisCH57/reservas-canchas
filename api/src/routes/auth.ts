// ==========================================================
// Rutas de AUTENTICACIÓN: /api/auth
// ==========================================================
import { Router } from "express";
import { pool } from "../db.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { createToken } from "../auth/token.ts";
import { requireAuth } from "../middleware/auth.ts";
import type { AuthUser, Role } from "../types/auth.ts";

const router = Router();

const UNIQUE_VIOLATION = "23505";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Forma de una fila de la tabla users (lo que devuelve PostgreSQL)
interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
}

// Lo que enviamos al cliente: NUNCA incluye el password_hash
function toPublicUser(row: UserRow) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

function toAuthUser(row: UserRow): AuthUser {
  return { id: row.id, name: row.name, role: row.role };
}

// Lee un campo de texto del cuerpo de la petición (o "" si no es texto)
function readText(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

// ----------------------------------------------------------
// POST /api/auth/register  →  crear una cuenta de CLIENTE
// ----------------------------------------------------------
router.post("/register", async (req, res) => {
  const name = readText(req.body, "name");
  const email = readText(req.body, "email").toLowerCase();
  // La contraseña NO se recorta: los espacios pueden ser parte de ella
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  const errors: string[] = [];
  if (name.length < 2 || name.length > 100) errors.push("El nombre debe tener entre 2 y 100 caracteres.");
  if (!EMAIL_PATTERN.test(email) || email.length > 255) errors.push("Ingresa un correo válido.");
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    errors.push(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: "Datos no válidos.", details: errors });
  }

  try {
    const passwordHash = await hashPassword(password);
    // El rol NO viene del cliente: todo registro público es "customer".
    // Si aceptáramos un "role" enviado por el usuario, cualquiera podría hacerse admin.
    const result = await pool.query<UserRow>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'customer')
       RETURNING id, name, email, password_hash, role`,
      [name, email, passwordHash]
    );
    const user = result.rows[0]!;
    res.status(201).json({ token: createToken(toAuthUser(user)), user: toPublicUser(user) });
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    }
    throw error;
  }
});

// Hash falso para comparar cuando el correo no existe (ver /login)
const DUMMY_HASH = await hashPassword("contraseña-que-nadie-usa");

// ----------------------------------------------------------
// POST /api/auth/login  →  iniciar sesión
// ----------------------------------------------------------
router.post("/login", async (req, res) => {
  const email = readText(req.body, "email").toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  const result = await pool.query<UserRow>(
    "SELECT id, name, email, password_hash, role FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];

  // Siempre calculamos un hash, exista o no el correo. Si solo lo hiciéramos
  // cuando existe, la respuesta tardaría distinto y revelaría qué correos están registrados.
  const isValid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);

  if (!user || !isValid) {
    // Mismo mensaje en ambos casos: no revelamos si el correo existe
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }

  res.json({ token: createToken(toAuthUser(user)), user: toPublicUser(user) });
});

// ----------------------------------------------------------
// GET /api/auth/me  →  ¿quién soy? (ruta PROTEGIDA)
// requireAuth se ejecuta primero: si no hay token válido, responde 401
// ----------------------------------------------------------
router.get("/me", requireAuth, async (req, res) => {
  const result = await pool.query<UserRow>(
    "SELECT id, name, email, password_hash, role FROM users WHERE id = $1",
    [req.user!.id]
  );
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ error: "La cuenta ya no existe." });
  }
  res.json(toPublicUser(user));
});

export default router;
