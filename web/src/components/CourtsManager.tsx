// ==========================================================
// Gestión de CANCHAS (solo admin): lista, crear y editar.
// Desactivar una cancha la oculta de la grilla sin borrar su historial.
// ==========================================================
import { useState, type FormEvent } from "react";
import { api } from "../api.ts";
import type { Court, CourtInput } from "../types.ts";
import { formatHour, formatMoney } from "../utils/format.ts";
import { useFetch } from "../utils/useFetch.ts";
import ErrorMessage from "./ErrorMessage.tsx";

interface Props {
  onChanged: () => void;
}

// null = formulario cerrado, "new" = creando, Court = editando esa cancha
type Editing = null | "new" | Court;

const EMPTY_COURT: CourtInput = {
  name: "",
  sport: "Fútbol",
  pricePerHourCents: 6000,
  openHour: 8,
  closeHour: 23,
  isActive: true,
};

export default function CourtsManager({ onChanged }: Props) {
  const { data, error, loading, reload } = useFetch(() => api.getAllCourts(), "courts");
  const [editing, setEditing] = useState<Editing>(null);

  const courts = data ?? [];

  function handleSaved() {
    setEditing(null);
    reload();
    onChanged();
  }

  return (
    <div className="card">
      <div className="card-toolbar">
        <h2 className="card-title">Canchas</h2>
        {editing === null && (
          <button type="button" className="button button-primary" onClick={() => setEditing("new")}>
            Nueva cancha
          </button>
        )}
      </div>

      {editing !== null && (
        <CourtForm
          // key: al cambiar de cancha, React crea un formulario nuevo con sus datos
          key={editing === "new" ? "new" : editing.id}
          court={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <ErrorMessage error={error} />

      {loading && !data ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Cancha</th>
                <th scope="col">Precio / hora</th>
                <th scope="col">Horario</th>
                <th scope="col">Estado</th>
                <th scope="col"><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {courts.map((court) => (
                <tr key={court.id} className={court.isActive ? undefined : "is-cancelled"}>
                  <td>
                    {court.name}
                    <span className="cell-sub">{court.sport}</span>
                  </td>
                  <td>{formatMoney(court.pricePerHourCents)}</td>
                  <td>
                    {formatHour(court.openHour)} – {formatHour(court.closeHour)}
                  </td>
                  <td>
                    <span className={`badge ${court.isActive ? "badge-ok" : "badge-muted"}`}>
                      {court.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="button button-small" onClick={() => setEditing(court)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------
// Formulario para crear o editar una cancha
// ----------------------------------------------------------
interface FormProps {
  court: Court | null;
  onCancel: () => void;
  onSaved: () => void;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0 a 24

function CourtForm({ court, onCancel, onSaved }: FormProps) {
  const initial = court ?? EMPTY_COURT;
  const [name, setName] = useState(initial.name);
  const [sport, setSport] = useState(initial.sport);
  // El precio se escribe en soles ("80.00"), pero la API lo guarda en céntimos (8000)
  const [price, setPrice] = useState((initial.pricePerHourCents / 100).toFixed(2));
  const [openHour, setOpenHour] = useState(initial.openHour);
  const [closeHour, setCloseHour] = useState(initial.closeHour);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data: CourtInput = {
      name,
      sport,
      // Math.round evita errores de decimales: 65.1 * 100 = 6509.999...
      pricePerHourCents: Math.round(Number(price) * 100),
      openHour,
      closeHour,
      isActive,
    };
    setSaving(true);
    setError(null);
    try {
      if (court) await api.updateCourt(court.id, data);
      else await api.createCourt(data);
      onSaved();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <form className="form court-form" onSubmit={handleSubmit}>
      <h3 className="form-title">{court ? `Editar ${court.name}` : "Nueva cancha"}</h3>

      <div className="form-grid">
        <label className="field">
          <span>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required />
        </label>
        <label className="field">
          <span>Deporte</span>
          <input value={sport} onChange={(e) => setSport(e.target.value)} minLength={2} maxLength={30} required />
        </label>
        <label className="field">
          <span>Precio por hora (S/)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.10"
            step="0.10"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Abre</span>
          <select value={openHour} onChange={(e) => setOpenHour(Number(e.target.value))}>
            {HOURS.slice(0, 24).map((h) => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cierra</span>
          <select value={closeHour} onChange={(e) => setCloseHour(Number(e.target.value))}>
            {HOURS.slice(1).map((h) => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
        </label>
        <label className="field-check">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>Activa (visible para reservar)</span>
        </label>
      </div>

      <ErrorMessage error={error} />

      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
