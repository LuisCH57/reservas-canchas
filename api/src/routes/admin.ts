// ==========================================================
// Rutas de ADMINISTRACIÓN: /api/admin  (solo rol "admin")
// ==========================================================
import { Router } from "express";
import { pool } from "../db.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";
import { isValidDate, limaNow } from "../utils/time.ts";
import { COURT_COLUMNS } from "./courts.ts";

const router = Router();

// Dos guardianes en cadena: primero ¿quién eres?, luego ¿eres admin?
router.use(requireAuth, requireRole("admin"));

const UNIQUE_VIOLATION = "23505";

// ----------------------------------------------------------
// Validación de los datos de una cancha
// ----------------------------------------------------------
interface CourtInput {
  name: string;
  sport: string;
  pricePerHourCents: number;
  openHour: number;
  closeHour: number;
  isActive: boolean;
}

function validateCourt(body: unknown): { errors: string[]; court: CourtInput } {
  const data = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const errors: string[] = [];

  const name = typeof data.name === "string" ? data.name.trim() : "";
  const sport = typeof data.sport === "string" ? data.sport.trim() : "";
  const isInt = (value: unknown, min: number, max: number) =>
    Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

  if (name.length < 2 || name.length > 80) errors.push("El nombre debe tener entre 2 y 80 caracteres.");
  if (sport.length < 2 || sport.length > 30) errors.push("El deporte debe tener entre 2 y 30 caracteres.");
  if (!isInt(data.pricePerHourCents, 1, 10_000_00)) errors.push("pricePerHourCents debe ser un entero mayor que 0.");
  if (!isInt(data.openHour, 0, 23)) errors.push("openHour debe ser un entero entre 0 y 23.");
  if (!isInt(data.closeHour, 1, 24)) errors.push("closeHour debe ser un entero entre 1 y 24.");
  if (isInt(data.openHour, 0, 23) && isInt(data.closeHour, 1, 24) && (data.openHour as number) >= (data.closeHour as number)) {
    errors.push("La hora de apertura debe ser anterior a la de cierre.");
  }
  if (data.isActive !== undefined && typeof data.isActive !== "boolean") {
    errors.push("isActive debe ser true o false.");
  }

  return {
    errors,
    court: {
      name,
      sport,
      pricePerHourCents: data.pricePerHourCents as number,
      openHour: data.openHour as number,
      closeHour: data.closeHour as number,
      isActive: data.isActive === undefined ? true : (data.isActive as boolean),
    },
  };
}

// ----------------------------------------------------------
// GET /api/admin/courts  →  todas las canchas (también las inactivas)
// ----------------------------------------------------------
router.get("/courts", async (_req, res) => {
  const result = await pool.query(`SELECT ${COURT_COLUMNS} FROM courts ORDER BY name`);
  res.json(result.rows);
});

// ----------------------------------------------------------
// POST /api/admin/courts  →  crear cancha
// ----------------------------------------------------------
router.post("/courts", async (req, res) => {
  const { errors, court } = validateCourt(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: "Datos no válidos.", details: errors });
  }
  try {
    const result = await pool.query(
      `INSERT INTO courts (name, sport, price_per_hour_cents, open_hour, close_hour, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COURT_COLUMNS}`,
      [court.name, court.sport, court.pricePerHourCents, court.openHour, court.closeHour, court.isActive]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return res.status(409).json({ error: "Ya existe una cancha con ese nombre." });
    }
    throw error;
  }
});

// ----------------------------------------------------------
// PUT /api/admin/courts/:id  →  editar cancha (precio, horario, activarla o desactivarla)
// Las reservas ya hechas conservan su precio: se guardó al reservar.
// ----------------------------------------------------------
router.put("/courts/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "El id debe ser un número entero positivo." });
  }
  const { errors, court } = validateCourt(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: "Datos no válidos.", details: errors });
  }
  try {
    const result = await pool.query(
      `UPDATE courts
       SET name = $1, sport = $2, price_per_hour_cents = $3, open_hour = $4, close_hour = $5, is_active = $6
       WHERE id = $7
       RETURNING ${COURT_COLUMNS}`,
      [court.name, court.sport, court.pricePerHourCents, court.openHour, court.closeHour, court.isActive, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cancha no encontrada." });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return res.status(409).json({ error: "Ya existe una cancha con ese nombre." });
    }
    throw error;
  }
});

// ----------------------------------------------------------
// GET /api/admin/reservations?date=2026-10-20  →  todas las reservas de un día,
// con el nombre y correo del cliente (solo el admin puede verlos)
// ----------------------------------------------------------
router.get("/reservations", async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : limaNow().date;
  if (!isValidDate(date)) {
    return res.status(400).json({ error: "La fecha no es válida. Usa el formato AAAA-MM-DD." });
  }

  const result = await pool.query(
    `SELECT
       r.id,
       r.date,
       r.start_hour  AS "startHour",
       r.price_cents AS "priceCents",
       r.status,
       c.name        AS "courtName",
       u.name        AS "customerName",
       u.email       AS "customerEmail"
     FROM reservations r
     JOIN courts c ON c.id = r.court_id
     JOIN users  u ON u.id = r.user_id
     WHERE r.date = $1
     ORDER BY r.start_hour, c.name`,
    [date]
  );
  res.json(result.rows);
});

// ----------------------------------------------------------
// GET /api/admin/summary  →  indicadores del mes actual
// ----------------------------------------------------------
router.get("/summary", async (_req, res) => {
  const now = limaNow();
  const monthStart = `${now.date.slice(0, 7)}-01`; // "2026-10-01"

  const [totals, byCourt, customers] = await Promise.all([
    pool.query<{ revenueCents: number; confirmed: number; cancelled: number; today: number }>(
      `SELECT
         COALESCE(SUM(price_cents) FILTER (WHERE status = 'confirmed'), 0)::int AS "revenueCents",
         COUNT(*) FILTER (WHERE status = 'confirmed')::int                      AS "confirmed",
         COUNT(*) FILTER (WHERE status = 'cancelled')::int                      AS "cancelled",
         COUNT(*) FILTER (WHERE status = 'confirmed' AND date = $2)::int        AS "today"
       FROM reservations
       WHERE date >= $1::date AND date < ($1::date + interval '1 month')`,
      [monthStart, now.date]
    ),
    pool.query(
      `SELECT
         c.id,
         c.name,
         COUNT(r.id)::int                       AS "reservations",
         COALESCE(SUM(r.price_cents), 0)::int   AS "revenueCents"
       FROM courts c
       LEFT JOIN reservations r
         ON r.court_id = c.id
        AND r.status = 'confirmed'
        AND r.date >= $1::date AND r.date < ($1::date + interval '1 month')
       GROUP BY c.id, c.name
       ORDER BY "revenueCents" DESC, c.name`,
      [monthStart]
    ),
    pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'customer'`),
  ]);

  res.json({
    month: now.date.slice(0, 7),
    ...totals.rows[0],
    customers: customers.rows[0]!.count,
    byCourt: byCourt.rows,
  });
});

export default router;
