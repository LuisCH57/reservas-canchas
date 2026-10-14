// ==========================================================
// Funciones para mostrar fechas, horas y montos en español.
// ==========================================================

const TIMEZONE = "America/Lima";

// 8000 céntimos -> "S/ 80.00"
export function formatMoney(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

// 18 -> "18:00 – 19:00"
export function formatHourRange(hour: number): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hour)}:00 – ${pad(hour + 1)}:00`;
}

// 18 -> "18:00"
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

// Una fecha "AAAA-MM-DD" se interpreta a mediodía UTC para que
// la zona horaria nunca la mueva al día anterior.
function toDate(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

// "2026-10-16" -> "viernes 16 de octubre"
export function formatLongDate(date: string): string {
  return toDate(date).toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

// "2026-10-16" -> { weekday: "vie", day: "16", month: "oct" } (para los botones de día)
export function formatDayChip(date: string) {
  const d = toDate(date);
  const part = (options: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("es-PE", { ...options, timeZone: "UTC" }).replace(".", "");
  return { weekday: part({ weekday: "short" }), day: part({ day: "numeric" }), month: part({ month: "short" }) };
}

// Fecha de HOY en Perú, sin importar la zona horaria de la computadora
export function todayInLima(): string {
  // "en-CA" escribe las fechas como AAAA-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

// Hora actual en Perú (0 a 23)
export function currentHourInLima(): number {
  return Number(new Date().toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TIMEZONE }));
}

// "2026-10-30" + 3 -> "2026-11-02"
export function addDays(date: string, days: number): string {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ¿La reserva todavía no empieza?
export function isUpcoming(date: string, startHour: number): boolean {
  const today = todayInLima();
  return date > today || (date === today && startHour > currentHourInLima());
}
