// ==========================================================
// Pantalla MIS RESERVAS: próximas (con opción de cancelar) e historial.
// ==========================================================
import { useState } from "react";
import { api } from "../api.ts";
import type { Reservation } from "../types.ts";
import { formatHourRange, formatLongDate, formatMoney, isUpcoming } from "../utils/format.ts";
import { useFetch } from "../utils/useFetch.ts";
import ErrorMessage from "./ErrorMessage.tsx";

export default function MyReservations() {
  const { data, error, loading, reload } = useFetch(() => api.getMyReservations(), "mine");
  // id de la reserva que está pidiendo confirmación para cancelar
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState<unknown>(null);
  const [cancelling, setCancelling] = useState(false);

  const reservations = data ?? [];
  const upcoming = reservations
    .filter((r) => r.status === "confirmed" && isUpcoming(r.date, r.startHour))
    .reverse(); // la API las envía de la más lejana a la más cercana: mostramos primero la más cercana
  const history = reservations.filter((r) => !upcoming.includes(r));

  async function cancel(id: number) {
    setCancelling(true);
    setCancelError(null);
    try {
      await api.cancelReservation(id);
      setConfirmingId(null);
      reload();
    } catch (err) {
      setCancelError(err);
    } finally {
      setCancelling(false);
    }
  }

  function renderCard(reservation: Reservation, canCancel: boolean) {
    const isCancelled = reservation.status === "cancelled";
    return (
      <li key={reservation.id} className={`reservation-card${isCancelled ? " is-cancelled" : ""}`}>
        <div>
          <p className="reservation-court">
            {reservation.courtName}
            {isCancelled && <span className="badge badge-muted">Cancelada</span>}
          </p>
          <p className="reservation-when">
            {formatLongDate(reservation.date)} · {formatHourRange(reservation.startHour)}
          </p>
          <p className="muted">{formatMoney(reservation.priceCents)} · pago en el local</p>
        </div>

        {canCancel &&
          (confirmingId === reservation.id ? (
            <div className="inline-confirm">
              <span>¿Cancelar esta reserva?</span>
              <button type="button" className="button button-danger" onClick={() => cancel(reservation.id)} disabled={cancelling}>
                {cancelling ? "Cancelando…" : "Sí, cancelar"}
              </button>
              <button type="button" className="button" onClick={() => setConfirmingId(null)}>
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="button"
              onClick={() => {
                setCancelError(null);
                setConfirmingId(reservation.id);
              }}
            >
              Cancelar reserva
            </button>
          ))}
      </li>
    );
  }

  return (
    <section aria-labelledby="mine-title">
      <div className="section-heading">
        <h1 id="mine-title">Mis reservas</h1>
        <p className="muted">Puedes tener hasta 3 reservas próximas a la vez.</p>
      </div>

      <ErrorMessage error={error} />
      <ErrorMessage error={cancelError} />

      {loading && !data ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          <h2 className="subsection-title">Próximas</h2>
          {upcoming.length === 0 ? (
            <p className="empty">No tienes reservas próximas.</p>
          ) : (
            <ul className="reservation-list">{upcoming.map((r) => renderCard(r, true))}</ul>
          )}

          {history.length > 0 && (
            <>
              <h2 className="subsection-title">Historial</h2>
              <ul className="reservation-list">{history.map((r) => renderCard(r, false))}</ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
