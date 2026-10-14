// ==========================================================
// Rutas de RESERVAS: /api/reservations  (todas requieren sesión)
// ==========================================================
import { Router } from "express";
import { pool } from "../db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { checkBookingTime, limaNow } from "../utils/time.ts";

const router = Router();

// Todas las rutas de este archivo exigen haber iniciado sesión
router.use(requireAuth);

const UNIQUE_VIOLATION = "23505";
// Un cliente puede tener como máximo 3 reservas futuras (evita acaparar horarios)
export const MAX_UPCOMING_PER_CUSTOMER = 3;

const RESERVATION_COLUMNS = `
  r.id,
  r.date,
  r.start_hour  AS "startHour",
  r.price_cents AS "priceCents",
  r.status,
  r.created_at  AS "createdAt",
  c.id          AS "courtId",
  c.name        AS "courtName",
  c.sport
`;

// ----------------------------------------------------------
// GET /api/reservations/mine  →  mis reservas (las más próximas primero)
// ----------------------------------------------------------
router.get("/mine", async (req, res) => {
  const result = await pool.query(
    `SELECT ${RESERVATION_COLUMNS}
     FROM reservations r
     JOIN courts c ON c.id = r.court_id
     WHERE r.user_id = $1
     ORDER BY r.date DESC, r.start_hour DESC
     LIMIT 50`,
    [req.user!.id]
  );
  res.json(result.rows);
});

// ----------------------------------------------------------
// POST /api/reservations  →  reservar
// Cuerpo: { "courtId": 1, "date": "2026-10-20", "startHour": 18 }
// ----------------------------------------------------------
router.post("/", async (req, res) => {
  const user = req.user!;
  const { courtId, date, startHour } = req.body ?? {};

  if (!Number.isInteger(courtId) || courtId <= 0) {
    return res.status(400).json({ error: "courtId debe ser un número entero positivo." });
  }

  // 1. ¿La cancha existe y está activa?
  const courtResult = await pool.query<{
    pricePerHourCents: number;
    openHour: number;
    closeHour: number;
  }>(
    `SELECT price_per_hour_cents AS "pricePerHourCents", open_hour AS "openHour", close_hour AS "closeHour"
     FROM courts WHERE id = $1 AND is_active`,
    [courtId]
  );
  const court = courtResult.rows[0];
  if (!court) {
    return res.status(404).json({ error: "La cancha no existe o no está disponible." });
  }

  // 2. Reglas de tiempo: fecha válida, horario de atención, no pasado, ventana de 14 días
  const timeError = checkBookingTime(date, startHour, court);
  if (timeError) {
    return res.status(400).json({ error: timeError });
  }

  // 3. Límite de reservas futuras (solo clientes)
  if (user.role === "customer") {
    const now = limaNow();
    const upcoming = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM reservations
       WHERE user_id = $1 AND status = 'confirmed'
         AND (date > $2 OR (date = $2 AND start_hour > $3))`,
      [user.id, now.date, now.hour]
    );
    if (upcoming.rows[0]!.count >= MAX_UPCOMING_PER_CUSTOMER) {
      return res.status(409).json({
        error: `Puedes tener como máximo ${MAX_UPCOMING_PER_CUSTOMER} reservas próximas. Cancela una para reservar otra.`,
      });
    }
  }

  // 4. Guardar. Si otra persona reservó el mismo horario un instante antes,
  //    el índice único de la base de datos lo rechaza (error 23505).
  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO reservations (user_id, court_id, date, start_hour, price_cents)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user.id, courtId, date, startHour, court.pricePerHourCents]
    );

    const created = await pool.query(
      `SELECT ${RESERVATION_COLUMNS}
       FROM reservations r JOIN courts c ON c.id = r.court_id
       WHERE r.id = $1`,
      [result.rows[0]!.id]
    );
    res.status(201).json(created.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return res.status(409).json({ error: "Ese horario ya fue reservado. Elige otro." });
    }
    throw error;
  }
});

// ----------------------------------------------------------
// PATCH /api/reservations/:id/cancel  →  cancelar
// El dueño puede cancelar sus reservas futuras. El admin puede cancelar cualquiera.
// ----------------------------------------------------------
router.patch("/:id/cancel", async (req, res) => {
  const user = req.user!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "El id debe ser un número entero positivo." });
  }

  const result = await pool.query<{ userId: number; date: string; startHour: number; status: string }>(
    `SELECT user_id AS "userId", date, start_hour AS "startHour", status
     FROM reservations WHERE id = $1`,
    [id]
  );
  const reservation = result.rows[0];

  // Si la reserva es de OTRA persona, respondemos 404 (y no 403):
  // así un cliente ni siquiera puede saber qué reservas existen.
  if (!reservation || (reservation.userId !== user.id && user.role !== "admin")) {
    return res.status(404).json({ error: "Reserva no encontrada." });
  }
  if (reservation.status === "cancelled") {
    return res.status(409).json({ error: "Esta reserva ya estaba cancelada." });
  }

  const now = limaNow();
  const hasStarted =
    reservation.date < now.date || (reservation.date === now.date && reservation.startHour <= now.hour);
  if (hasStarted && user.role !== "admin") {
    return res.status(409).json({ error: "No se puede cancelar una reserva que ya empezó o pasó." });
  }

  await pool.query(
    "UPDATE reservations SET status = 'cancelled', cancelled_at = now() WHERE id = $1",
    [id]
  );
  res.json({ id, status: "cancelled" });
});

export default router;
