// ==========================================================
// Fechas y horas. Funciones PURAS (sin base de datos ni red):
// reciben datos y devuelven resultados, por eso son fáciles de probar.
// ==========================================================

export const TIMEZONE = "America/Lima";
export const BOOKING_WINDOW_DAYS = 14; // se puede reservar hasta 14 días adelante

export interface LimaTime {
  date: string; // "2026-10-14"
  hour: number; // 0 a 23
}

// Fecha y hora actuales EN PERÚ, sin importar dónde corra el servidor
// (Render está en Estados Unidos y usa la hora UTC).
// "now" es un parámetro para poder probar la función con cualquier momento.
export function limaNow(now: Date = new Date()): LimaTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

// ¿Es un texto con formato AAAA-MM-DD y una fecha real? ("2026-02-30" no lo es)
export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// "2026-10-14" + 3 días = "2026-10-17"
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

interface CourtHours {
  openHour: number;
  closeHour: number;
}

// Reglas de tiempo de una reserva. Devuelve el motivo del rechazo, o null si es válida.
// Las fechas "AAAA-MM-DD" se pueden comparar como texto: "2026-10-14" < "2026-10-15".
export function checkBookingTime(
  date: string,
  startHour: number,
  court: CourtHours,
  now: LimaTime = limaNow()
): string | null {
  if (!isValidDate(date)) {
    return "La fecha no es válida. Usa el formato AAAA-MM-DD.";
  }
  if (!Number.isInteger(startHour)) {
    return "La hora debe ser un número entero, por ejemplo 18.";
  }
  if (startHour < court.openHour || startHour >= court.closeHour) {
    return `Esta cancha atiende de ${court.openHour}:00 a ${court.closeHour}:00.`;
  }
  if (date < now.date || (date === now.date && startHour <= now.hour)) {
    return "No se puede reservar un horario que ya pasó.";
  }
  if (date > addDays(now.date, BOOKING_WINDOW_DAYS)) {
    return `Solo se puede reservar con hasta ${BOOKING_WINDOW_DAYS} días de anticipación.`;
  }
  return null;
}
