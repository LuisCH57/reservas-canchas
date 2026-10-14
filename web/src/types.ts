// ==========================================================
// TIPOS: la "forma" de los datos que envía la API.
// Si la API cambia un campo y olvidamos actualizarlo aquí,
// TypeScript marca el error ANTES de ejecutar la aplicación.
// ==========================================================

export type Role = "customer" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

// Lo que guardamos al iniciar sesión
export interface Session {
  token: string;
  user: User;
}

export interface Court {
  id: number;
  name: string;
  sport: string;
  pricePerHourCents: number;
  openHour: number;
  closeHour: number;
  isActive: boolean;
}

// free = libre, booked = ocupado por otra persona, mine = mía, past = ya pasó
export type SlotStatus = "free" | "booked" | "mine" | "past";

export interface Slot {
  hour: number;
  status: SlotStatus;
}

export interface CourtAvailability extends Court {
  slots: Slot[];
}

export interface Availability {
  date: string;
  bookableUntil: string;
  courts: CourtAvailability[];
}

export type ReservationStatus = "confirmed" | "cancelled";

export interface Reservation {
  id: number;
  date: string;
  startHour: number;
  priceCents: number;
  status: ReservationStatus;
  createdAt: string;
  courtId: number;
  courtName: string;
  sport: string;
}

// Lo que ve el admin: incluye los datos del cliente
export interface AdminReservation {
  id: number;
  date: string;
  startHour: number;
  priceCents: number;
  status: ReservationStatus;
  courtName: string;
  customerName: string;
  customerEmail: string;
}

export interface Summary {
  month: string;
  revenueCents: number;
  confirmed: number;
  cancelled: number;
  today: number;
  customers: number;
  byCourt: { id: number; name: string; reservations: number; revenueCents: number }[];
}

// Datos para crear o editar una cancha (todo menos el id)
export type CourtInput = Omit<Court, "id">;
