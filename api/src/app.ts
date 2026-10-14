// ==========================================================
// La aplicación Express: middlewares y rutas.
// Está separada de server.ts para poder usarla en las pruebas
// automáticas sin abrir un puerto real.
// ==========================================================
import express, { type NextFunction, type Request, type Response } from "express";
import { config } from "./config.ts";
import { pool } from "./db.ts";
import authRouter from "./routes/auth.ts";

export const app = express();

app.use(express.json());

// CORS: solo los sitios de CORS_ORIGIN pueden usar la API desde el navegador
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    // Authorization: necesario para enviar el token
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// Registro de peticiones (sin mostrar contraseñas ni tokens)
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(`${req.method} ${req.url}`);
  }
  next();
});

app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);

app.use((req, res) => {
  res.status(404).json({ error: `No existe la ruta ${req.method} ${req.url}` });
});

// Manejador de errores: 4 parámetros es lo que le indica a Express que maneja errores
app.use((error: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es un JSON válido." });
  }
  console.error(error);
  res.status(500).json({ error: "Error interno del servidor." });
});
