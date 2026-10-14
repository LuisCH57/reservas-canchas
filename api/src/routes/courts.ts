// ==========================================================
// Rutas PÚBLICAS de canchas: /api/courts
// ==========================================================
import { Router } from "express";
import { pool } from "../db.ts";
import { optionalAuth } from "../middleware/auth.ts";
import { BOOKING_WINDOW_DAYS, addDays, isValidDate, limaNow } from "../utils/time.ts";

const router = Router();

interface CourtRow {
  id: number;
  name: string;
  sport: string;
  pricePerHourCents: number;
  openHour: number;
  closeHour: number;
}

export const COURT_COLUMNS = `
  id,
  name,
  sport,
  price_per_hour_cents AS "pricePerHourCents",
  open_hour            AS "openHour",
  close_hour           AS "closeHour",
  is_active            AS "isActive"
`;

// Estado de cada hora en la grilla de disponibilidad
type SlotStatus = "free" | "booked" | "mine" | "past";

// ----------------------------------------------------------
// GET /api/courts  →  canchas activas
// ----------------------------------------------------------
router.get("/", async (_req, res) => {
  const result = await pool.query(
    `SELECT ${COURT_COLUMNS} FROM courts WHERE is_active ORDER BY name`
  );
  res.json(result.rows);
});

// ----------------------------------------------------------
// GET /api/courts/availability?date=2026-10-20
// Horarios de todas las canchas activas para un día.
// Es pública, pero si hay sesión marca las reservas propias como "mine".
// Nunca revela QUIÉN reservó un horario: solo que está ocupado (privacidad).
// ----------------------------------------------------------
router.get("/availability", optionalAuth, async (req, res) => {
  const now = limaNow();
  const date = typeof req.query.date === "string" ? req.query.date : now.date;

  if (!isValidDate(date)) {
    return res.status(400).json({ error: "La fecha no es válida. Usa el formato AAAA-MM-DD." });
  }

  // Las dos consultas son independientes: se ejecutan en paralelo
  const [courtsResult, bookedResult] = await Promise.all([
    pool.query<CourtRow>(`SELECT ${COURT_COLUMNS} FROM courts WHERE is_active ORDER BY name`),
    pool.query<{ courtId: number; startHour: number; userId: number }>(
      `SELECT court_id AS "courtId", start_hour AS "startHour", user_id AS "userId"
       FROM reservations
       WHERE date = $1 AND status = 'confirmed'`,
      [date]
    ),
  ]);

  // Índice para buscar rápido: "courtId-hora" -> id del usuario que reservó
  const booked = new Map<string, number>();
  for (const row of bookedResult.rows) {
    booked.set(`${row.courtId}-${row.startHour}`, row.userId);
  }

  const courts = courtsResult.rows.map((court) => {
    const slots: { hour: number; status: SlotStatus }[] = [];

    for (let hour = court.openHour; hour < court.closeHour; hour++) {
      const bookedBy = booked.get(`${court.id}-${hour}`);
      let status: SlotStatus = "free";

      if (bookedBy !== undefined) {
        status = bookedBy === req.user?.id ? "mine" : "booked";
      } else if (date < now.date || (date === now.date && hour <= now.hour)) {
        status = "past";
      }
      slots.push({ hour, status });
    }
    return { ...court, slots };
  });

  res.json({
    date,
    bookableUntil: addDays(now.date, BOOKING_WINDOW_DAYS),
    courts,
  });
});

export default router;
