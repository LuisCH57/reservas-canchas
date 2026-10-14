// ==========================================================
// Cliente de la API: TODAS las peticiones al backend pasan por aquí.
// Además de la dirección, aquí se agrega el token de sesión
// a cada petición, así ningún componente tiene que acordarse.
// ==========================================================
import type {
  AdminReservation,
  Availability,
  Court,
  CourtInput,
  Reservation,
  Session,
  Summary,
  User,
} from "./types.ts";

// En desarrollo usamos "/api" (Vite lo reenvía al puerto 3000).
// Al publicar, VITE_API_URL tendrá la dirección real del backend.
const API_URL: string = import.meta.env.VITE_API_URL ?? "/api";

// Error con el código HTTP y los detalles que envía la API
export class ApiError extends Error {
  status: number;
  details: string[];

  constructor(message: string, status: number, details: string[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// El token vive aquí (en memoria) y App lo actualiza al iniciar o cerrar sesión
let authToken: string | null = null;
// Función que App registra para enterarse si la sesión expiró
let onSessionExpired: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor. Revisa que la API esté encendida.", 0);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // 401 con un token enviado = el token expiró o ya no es válido
    if (response.status === 401 && authToken && onSessionExpired) {
      onSessionExpired();
    }
    throw new ApiError(data?.error ?? `Error ${response.status}`, response.status, data?.details ?? []);
  }
  return data as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

// Una función por cada operación de la API
export const api = {
  // Cuenta
  login: (email: string, password: string) => request<Session>("/auth/login", post({ email, password })),
  register: (name: string, email: string, password: string) =>
    request<Session>("/auth/register", post({ name, email, password })),
  me: () => request<User>("/auth/me"),

  // Horarios y reservas
  getAvailability: (date: string) => request<Availability>(`/courts/availability?date=${date}`),
  book: (courtId: number, date: string, startHour: number) =>
    request<Reservation>("/reservations", post({ courtId, date, startHour })),
  getMyReservations: () => request<Reservation[]>("/reservations/mine"),
  cancelReservation: (id: number) => request<{ id: number }>(`/reservations/${id}/cancel`, { method: "PATCH" }),

  // Administración
  getSummary: () => request<Summary>("/admin/summary"),
  getDayReservations: (date: string) => request<AdminReservation[]>(`/admin/reservations?date=${date}`),
  getAllCourts: () => request<Court[]>("/admin/courts"),
  createCourt: (court: CourtInput) => request<Court>("/admin/courts", post(court)),
  updateCourt: (id: number, court: CourtInput) =>
    request<Court>(`/admin/courts/${id}`, { method: "PUT", body: JSON.stringify(court) }),
};
