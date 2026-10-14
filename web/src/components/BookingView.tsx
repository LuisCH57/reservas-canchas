// ==========================================================
// Pantalla RESERVAR: eliges un día, ves la grilla de horarios
// de todas las canchas y reservas con un clic.
// Cualquiera puede ver la grilla; para reservar hay que iniciar sesión.
// ==========================================================
import { useState } from "react";
import { api } from "../api.ts";
import type { CourtAvailability, Reservation, Session, Slot } from "../types.ts";
import { addDays, formatDayChip, formatHour, formatHourRange, formatLongDate, formatMoney, todayInLima } from "../utils/format.ts";
import { useFetch } from "../utils/useFetch.ts";
import ErrorMessage from "./ErrorMessage.tsx";

interface Props {
  session: Session | null;
  date: string;
  onDateChange: (date: string) => void;
  onRequireLogin: () => void;
  onGoToMine: () => void;
}

// Debe coincidir con BOOKING_WINDOW_DAYS de la API (hoy + 14 días)
const DAYS_AHEAD = 14;

const STATUS_LABEL: Record<Slot["status"], string> = {
  free: "Libre",
  booked: "Ocupado",
  mine: "Tu reserva",
  past: "Pasó",
};

interface Selection {
  court: CourtAvailability;
  hour: number;
}

export default function BookingView({ session, date, onDateChange, onRequireLogin, onGoToMine }: Props) {
  const { data, error, loading, reload } = useFetch(() => api.getAvailability(date), date);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<unknown>(null);
  const [booked, setBooked] = useState<Reservation | null>(null);

  const today = todayInLima();
  const days = Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => addDays(today, i));

  // Mientras carga otra fecha, no mostramos la grilla del día anterior
  const availability = data?.date === date ? data : undefined;
  const courts = availability?.courts ?? [];

  // Filas de la grilla: desde la apertura más temprana hasta el cierre más tardío
  const firstHour = Math.min(...courts.map((court) => court.openHour));
  const lastHour = Math.max(...courts.map((court) => court.closeHour));
  const hours = courts.length > 0 ? Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i) : [];

  function changeDate(newDate: string) {
    setSelection(null);
    setBookError(null);
    setBooked(null);
    onDateChange(newDate);
  }

  function selectSlot(court: CourtAvailability, hour: number) {
    setBookError(null);
    setBooked(null);
    setSelection({ court, hour });
  }

  async function confirmBooking() {
    if (!selection) return;
    setBooking(true);
    setBookError(null);
    try {
      const reservation = await api.book(selection.court.id, date, selection.hour);
      setBooked(reservation);
      setSelection(null);
    } catch (err) {
      // Por ejemplo, 409: otra persona reservó ese horario hace un instante
      setBookError(err);
    } finally {
      setBooking(false);
      reload(); // volvemos a pedir la grilla para mostrar el estado real
    }
  }

  return (
    <section aria-labelledby="booking-title">
      <div className="section-heading">
        <h1 id="booking-title">Reserva tu cancha</h1>
        <p className="muted">Reservas por hora, hasta {DAYS_AHEAD} días de anticipación.</p>
      </div>

      {/* Selector de día */}
      <div className="day-picker" role="group" aria-label="Elegir día">
        {days.map((day) => {
          const chip = formatDayChip(day);
          return (
            <button
              key={day}
              type="button"
              className="day-chip"
              aria-pressed={day === date}
              aria-label={formatLongDate(day)}
              onClick={() => changeDate(day)}
            >
              <span className="day-chip-weekday">{day === today ? "Hoy" : chip.weekday}</span>
              <span className="day-chip-day">{chip.day}</span>
              <span className="day-chip-month">{chip.month}</span>
            </button>
          );
        })}
      </div>

      <h2 className="date-title">{formatLongDate(date)}</h2>

      {/* Mensajes */}
      {booked && (
        <div className="alert alert-success" role="status">
          <p>
            ¡Reserva confirmada! <strong>{booked.courtName}</strong>, {formatLongDate(booked.date)}, de{" "}
            {formatHour(booked.startHour)} a {formatHour(booked.startHour + 1)}. Total: {formatMoney(booked.priceCents)}.
          </p>
          <button type="button" className="button-link" onClick={onGoToMine}>
            Ver mis reservas
          </button>
        </div>
      )}
      <ErrorMessage error={bookError} />
      <ErrorMessage error={error} />

      <ul className="legend" aria-label="Leyenda">
        <li><span className="legend-swatch slot-free" /> Libre</li>
        <li><span className="legend-swatch slot-mine" /> Tu reserva</li>
        <li><span className="legend-swatch slot-booked" /> Ocupado</li>
        <li><span className="legend-swatch slot-closed" /> Cerrado o pasado</li>
      </ul>

      {/* Grilla: una columna por cancha, una fila por hora */}
      {loading && !availability ? (
        <p className="muted">Cargando horarios…</p>
      ) : courts.length === 0 ? (
        !error && <p className="muted">No hay canchas disponibles por ahora.</p>
      ) : (
        <div className="grid-scroll" aria-busy={loading}>
          <table className="slots-table">
            <caption className="visually-hidden">Horarios del {formatLongDate(date)}</caption>
            <thead>
              <tr>
                <th scope="col">Hora</th>
                {courts.map((court) => (
                  <th scope="col" key={court.id}>
                    <span className="court-name">{court.name}</span>
                    <span className="court-meta">{formatMoney(court.pricePerHourCents)} / hora</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour}>
                  <th scope="row">{formatHour(hour)}</th>
                  {courts.map((court) => {
                    const slot = court.slots.find((s) => s.hour === hour);
                    if (!slot) {
                      return (
                        <td key={court.id}>
                          <span className="slot slot-closed">Cerrado</span>
                        </td>
                      );
                    }
                    const isSelected = selection?.court.id === court.id && selection.hour === hour;
                    return (
                      <td key={court.id}>
                        {slot.status === "free" ? (
                          <button
                            type="button"
                            className={`slot slot-free${isSelected ? " slot-selected" : ""}`}
                            aria-pressed={isSelected}
                            aria-label={`${court.name}, ${formatHourRange(hour)}, libre`}
                            onClick={() => selectSlot(court, hour)}
                          >
                            {isSelected ? "Elegido" : "Libre"}
                          </button>
                        ) : (
                          <span className={`slot slot-${slot.status === "past" ? "closed" : slot.status}`}>
                            {STATUS_LABEL[slot.status]}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Barra de confirmación: aparece al elegir un horario */}
      {selection && (
        <div className="confirm-bar" role="region" aria-label="Confirmar reserva">
          <div>
            <p className="confirm-title">{selection.court.name}</p>
            <p className="muted">
              {formatLongDate(date)} · {formatHourRange(selection.hour)} ·{" "}
              <strong>{formatMoney(selection.court.pricePerHourCents)}</strong>
            </p>
          </div>
          <div className="confirm-actions">
            <button type="button" className="button" onClick={() => setSelection(null)}>
              Cambiar
            </button>
            {session ? (
              <button type="button" className="button button-primary" onClick={confirmBooking} disabled={booking}>
                {booking ? "Reservando…" : "Confirmar reserva"}
              </button>
            ) : (
              <button type="button" className="button button-primary" onClick={onRequireLogin}>
                Inicia sesión para reservar
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
