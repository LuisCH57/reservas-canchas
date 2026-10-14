// ==========================================================
// Crea un ADMINISTRADOR (o convierte en admin a un usuario existente).
// Uso (dos formas):
//   npm run create-admin -- "Tu Nombre" tu@correo.com "TuContraseñaSegura"
//   npm run create-admin      ← sin datos: usa ADMIN_EMAIL y ADMIN_PASSWORD del .env
//
// ¿Por qué un script y no una pantalla? Porque nadie desde internet debe
// poder crearse un admin: solo quien tiene acceso al servidor y a .env.
// ==========================================================
import { pool } from "../src/db.ts";
import { hashPassword } from "../src/auth/password.ts";

const args = process.argv.slice(2);
const name = args[0] ?? "Administrador";
const rawEmail = args[1] ?? process.env.ADMIN_EMAIL;
const password = args[2] ?? process.env.ADMIN_PASSWORD;

if (!name || !rawEmail || !password) {
  console.error('Uso: npm run create-admin -- "Nombre" correo@ejemplo.com "contraseña"');
  console.error("O completa ADMIN_EMAIL y ADMIN_PASSWORD en tu .env y ejecuta: npm run create-admin");
  process.exit(1);
}
if (password.length < 8) {
  console.error("La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}

const email = rawEmail.trim().toLowerCase();
const passwordHash = await hashPassword(password);

// ON CONFLICT: si el correo ya existe, lo actualiza en lugar de fallar
const result = await pool.query<{ id: number; email: string; role: string }>(
  `INSERT INTO users (name, email, password_hash, role)
   VALUES ($1, $2, $3, 'admin')
   ON CONFLICT (email) DO UPDATE
     SET role = 'admin', name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
   RETURNING id, email, role`,
  [name.trim(), email, passwordHash]
);

console.log("Administrador listo:", result.rows[0]);
await pool.end(); // cerrar la conexión para que el script termine
