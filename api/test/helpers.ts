// ==========================================================
// Ayudante para las pruebas: levanta TODO el sistema en memoria.
// - Un PostgreSQL de verdad (PGlite) que vive solo mientras dura la prueba
// - La API completa, escuchando en un puerto libre
// Así las pruebas no tocan tu base de datos de Neon y se pueden
// ejecutar en cualquier computadora sin configurar nada.
// ==========================================================
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

export interface ApiResponse {
  status: number;
  body: any;
}

interface RequestOptions {
  token?: string;
  body?: unknown;
}

export async function startTestServer() {
  // 1. Base de datos en memoria con el MISMO esquema que usas en Neon
  const db = await PGlite.create();
  const schema = await readFile(new URL("../../database/schema.sql", import.meta.url), "utf8");
  await db.exec(schema);

  const port = 50000 + Math.floor(Math.random() * 10000);
  const socket = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await socket.start();

  // 2. Variables de entorno de prueba. Deben existir ANTES de importar la API,
  //    porque config.ts las lee al cargarse.
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
  process.env.JWT_SECRET = "clave-solo-para-pruebas-".repeat(3);
  process.env.PG_POOL_MAX = "1"; // PGlite acepta una conexión a la vez
  process.env.NODE_ENV = "test";

  // import() dinámico: carga la API recién ahora, con las variables ya listas
  const { app } = await import("../src/app.ts");
  const { pool } = await import("../src/db.ts");

  // 3. La API escucha en un puerto libre (0 = "elige tú uno disponible")
  const server = app.listen(0);
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  // Hace una petición HTTP real a la API
  async function request(method: string, path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  // Crea un cliente nuevo y devuelve su token
  let counter = 0;
  async function createCustomer(): Promise<{ id: number; token: string }> {
    counter++;
    const { body } = await request("POST", "/auth/register", {
      body: { name: `Cliente ${counter}`, email: `cliente${counter}@prueba.com`, password: "clave-de-prueba" },
    });
    return { id: body.user.id, token: body.token };
  }

  // Crea un cliente, lo convierte en admin y vuelve a iniciar sesión
  async function createAdmin(): Promise<string> {
    const customer = await createCustomer();
    const { rows } = await pool.query<{ email: string }>(
      "UPDATE users SET role = 'admin' WHERE id = $1 RETURNING email",
      [customer.id]
    );
    const { body } = await request("POST", "/auth/login", {
      body: { email: rows[0]!.email, password: "clave-de-prueba" },
    });
    return body.token;
  }

  async function close() {
    server.close();
    await pool.end();
    await socket.stop();
    await db.close();
  }

  return { request, createCustomer, createAdmin, pool, close };
}
