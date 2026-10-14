// ==========================================================
// Formulario para INICIAR SESIÓN o CREAR UNA CUENTA.
// Es un solo formulario con dos modos, porque comparten casi todo.
// ==========================================================
import { useState, type FormEvent } from "react";
import { api } from "../api.ts";
import type { Session } from "../types.ts";
import ErrorMessage from "./ErrorMessage.tsx";

interface Props {
  notice: string;
  onLogin: (session: Session) => void;
}

type Mode = "login" | "register";

export default function AuthForm({ notice, onLogin }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // evita que el navegador recargue la página
    setError(null);
    setSending(true);
    try {
      const session = isRegister
        ? await api.register(name, email, password)
        : await api.login(email, password);
      onLogin(session);
    } catch (err) {
      setError(err);
      setSending(false);
    }
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setError(null);
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-tabs" role="group" aria-label="Elegir acción">
        <button type="button" aria-pressed={!isRegister} onClick={() => switchMode("login")}>
          Iniciar sesión
        </button>
        <button type="button" aria-pressed={isRegister} onClick={() => switchMode("register")}>
          Crear cuenta
        </button>
      </div>

      <h1 id="auth-title" className="auth-title">
        {isRegister ? "Crea tu cuenta" : "Bienvenido de nuevo"}
      </h1>

      {notice && <p className="alert alert-info">{notice}</p>}

      <form className="form" onSubmit={handleSubmit}>
        {isRegister && (
          <label className="field">
            <span>Nombre</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              minLength={2}
              maxLength={100}
              required
            />
          </label>
        )}

        <label className="field">
          <span>Correo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 8 : undefined}
            required
          />
          {isRegister && <small className="hint">Mínimo 8 caracteres.</small>}
        </label>

        <ErrorMessage error={error} />

        <button type="submit" className="button button-primary" disabled={sending}>
          {sending ? "Un momento…" : isRegister ? "Crear cuenta" : "Iniciar sesión"}
        </button>
      </form>
    </section>
  );
}
