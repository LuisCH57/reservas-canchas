// ==========================================================
// PANEL DE ADMINISTRACIÓN: resumen del mes, reservas de un día
// (con los datos del cliente) y gestión de canchas.
// Ocultar este panel a los clientes es solo comodidad: la verdadera
// protección está en la API, que responde 403 a quien no es admin.
// ==========================================================
import { useState } from "react";
import { api } from "../api.ts";
import { formatHourRange, formatMoney, todayInLima } from "../utils/format.ts";
import { useFetch } from "../utils/useFetch.ts";
import ErrorMessage from "./ErrorMessage.tsx";
import CourtsManager from "./CourtsManager.tsx";

type Tab = "day" | "courts";

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("day");
  const [date, setDate] = useState(todayInLima());

  const summary = useFetch(() => api.getSummary(), "summary");
  const day = useFetch(() => api.getDayReservations(date), date);

  const [cancelError, setCancelError] = useState<unknown>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  async function cancel(id: number, customerName: string) {
    // confirm() muestra la ventana de confirmación del navegador
    if (!window.confirm(`¿Cancelar la reserva de ${customerName}?`)) return;
    setCancellingId(id);
    setCancelError(null);
    try {
      await api.cancelReservation(id);
      day.reload();
      summary.reload();
    } catch (err) {
      setCancelError(err);
    } finally {
      setCancellingId(null);
    }
  }

  const s = summary.data;
  const reservations = day.data ?? [];
  const confirmed = reservations.filter((r) => r.status === "confirmed");
  const dayRevenue = confirmed.reduce((total, r) => total + r.priceCents, 0);

  return (
    <section aria-labelledby="admin-title">
      <div className="section-heading">
        <h1 id="admin-title">Administración</h1>
        <p className="muted">Resumen del mes {s ? `(${s.month})` : ""}</p>
      </div>

      {/* Indicadores del mes */}
      <ErrorMessage error={summary.error} />
      {s && (
        <div className="stats">
          <div className="stat">
            <span className="stat-label">Ingresos del mes</span>
            <span className="stat-value">{formatMoney(s.revenueCents)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Reservas confirmadas</span>
            <span className="stat-value">{s.confirmed}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Canceladas</span>
            <span className="stat-value">{s.cancelled}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Reservas para hoy</span>
            <span className="stat-value">{s.today}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Clientes registrados</span>
            <span className="stat-value">{s.customers}</span>
          </div>
        </div>
      )}

      {s && s.byCourt.length > 0 && (
        <div className="card">
          <h2 className="card-title">Ingresos por cancha este mes</h2>
          <ul className="bar-list">
            {s.byCourt.map((court) => {
              const max = Math.max(...s.byCourt.map((c) => c.revenueCents), 1);
              return (
                <li key={court.id}>
                  <span className="bar-label">{court.name}</span>
                  <span className="bar-track" aria-hidden="true">
                    <span className="bar-fill" style={{ width: `${(court.revenueCents / max) * 100}%` }} />
                  </span>
                  <span className="bar-value">
                    {formatMoney(court.revenueCents)} · {court.reservations} res.
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Pestañas */}
      <div className="tabs" role="group" aria-label="Secciones de administración">
        <button type="button" aria-pressed={tab === "day"} onClick={() => setTab("day")}>
          Reservas del día
        </button>
        <button type="button" aria-pressed={tab === "courts"} onClick={() => setTab("courts")}>
          Canchas
        </button>
      </div>

      {tab === "day" && (
        <div className="card">
          <div className="card-toolbar">
            <label className="field field-inline">
              <span>Fecha</span>
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
            <p className="muted">
              {confirmed.length} confirmada{confirmed.length === 1 ? "" : "s"} · {formatMoney(dayRevenue)}
            </p>
          </div>

          <ErrorMessage error={day.error} />
          <ErrorMessage error={cancelError} />

          {day.loading && !day.data ? (
            <p className="muted">Cargando…</p>
          ) : reservations.length === 0 ? (
            <p className="empty">No hay reservas para esta fecha.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Hora</th>
                    <th scope="col">Cancha</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Precio</th>
                    <th scope="col">Estado</th>
                    <th scope="col"><span className="visually-hidden">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr key={r.id} className={r.status === "cancelled" ? "is-cancelled" : undefined}>
                      <td>{formatHourRange(r.startHour)}</td>
                      <td>{r.courtName}</td>
                      <td>
                        {r.customerName}
                        <span className="cell-sub">{r.customerEmail}</span>
                      </td>
                      <td>{formatMoney(r.priceCents)}</td>
                      <td>
                        <span className={`badge ${r.status === "confirmed" ? "badge-ok" : "badge-muted"}`}>
                          {r.status === "confirmed" ? "Confirmada" : "Cancelada"}
                        </span>
                      </td>
                      <td>
                        {r.status === "confirmed" && (
                          <button
                            type="button"
                            className="button button-small"
                            onClick={() => cancel(r.id, r.customerName)}
                            disabled={cancellingId === r.id}
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "courts" && <CourtsManager onChanged={summary.reload} />}
    </section>
  );
}
