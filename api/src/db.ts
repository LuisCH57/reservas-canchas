// ==========================================================
// Conexión a PostgreSQL (Neon)
// ==========================================================
import pg from "pg";
import { config } from "./config.ts";

// Por defecto, pg convierte las columnas DATE en objetos Date de JavaScript,
// y al hacerlo puede "correr" la fecha un día por la zona horaria.
// 1082 es el código interno del tipo DATE: le pedimos que lo deje como texto ("2026-10-14").
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // Las pruebas automáticas usan una base de datos que solo acepta 1 conexión
  max: Number(process.env.PG_POOL_MAX ?? 10),
});
