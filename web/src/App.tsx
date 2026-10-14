// ==========================================================
// App: guarda la SESIÓN (quién inició sesión) y decide qué
// pantalla mostrar. Cada pantalla vive en su propio componente.
// ==========================================================
import { useEffect, useState } from "react";
import { setAuthToken, setSessionExpiredHandler } from "./api.ts";
import type { Session } from "./types.ts";
import { todayInLima } from "./utils/format.ts";
import AuthForm from "./components/AuthForm.tsx";
import BookingView from "./components/BookingView.tsx";
import MyReservations from "./components/MyReservations.tsx";
import AdminPanel from "./components/AdminPanel.tsx";

type View = "booking" | "mine" | "admin" | "login";

const STORAGE_KEY = "reservas-canchas-session";

// Lee la sesión guardada en el navegador (si el usuario no cerró sesión)
function loadSession(): Session | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Session) : null;
  } catch {
    return null; // datos corruptos o navegador sin localStorage
  }
}

function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Si el navegador no permite guardar, la sesión dura hasta recargar la página
  }
}

// Se ejecuta una sola vez, al cargar la página: el token debe estar
// listo ANTES de que cualquier pantalla haga su primera petición.
const initialSession = loadSession();
setAuthToken(initialSession?.token ?? null);

export default function App() {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [view, setView] = useState<View>("booking");
  const [date, setDate] = useState(todayInLima());
  const [notice, setNotice] = useState("");

  function login(newSession: Session) {
    setAuthToken(newSession.token);
    saveSession(newSession);
    setSession(newSession);
    setNotice("");
    setView("booking");
  }

  function logout() {
    setAuthToken(null);
    saveSession(null);
    setSession(null);
    setNotice("");
    setView("booking");
  }

  // Si la API responde 401 (token vencido), cerramos la sesión y avisamos.
  // Solo usa funciones "set" de React, que nunca cambian: basta registrarlo una vez.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAuthToken(null);
      saveSession(null);
      setSession(null);
      setNotice("Tu sesión expiró. Vuelve a iniciar sesión.");
      setView("login");
    });
  }, []);

  function requireLogin() {
    setNotice("Inicia sesión o crea una cuenta para reservar.");
    setView("login");
  }

  const isAdmin = session?.user.role === "admin";

  // Botón del menú: aria-current indica a los lectores de pantalla cuál está activo
  const navButton = (target: View, label: string) => (
    <button
      type="button"
      className="nav-button"
      aria-current={view === target ? "page" : undefined}
      onClick={() => {
        setNotice("");
        setView(target);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon" aria-hidden="true">⚽</span>
            <div>
              <p className="brand-name">Reservas de canchas</p>
              <p className="brand-tagline">Elige el día, la cancha y la hora</p>
            </div>
          </div>

          <nav className="main-nav" aria-label="Secciones">
            {navButton("booking", "Reservar")}
            {session && navButton("mine", "Mis reservas")}
            {isAdmin && navButton("admin", "Administración")}
            {!session && navButton("login", "Ingresar")}
          </nav>

          {session && (
            <div className="user-box">
              <span className="user-name">
                {session.user.name}
                {isAdmin && <span className="role-badge">Admin</span>}
              </span>
              <button type="button" className="button-link" onClick={() => logout()}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        {view === "booking" && (
          <BookingView
            key={session?.user.id ?? "guest"}
            session={session}
            date={date}
            onDateChange={setDate}
            onRequireLogin={requireLogin}
            onGoToMine={() => setView("mine")}
          />
        )}
        {view === "mine" && session && <MyReservations />}
        {view === "admin" && isAdmin && <AdminPanel />}
        {view === "login" && !session && <AuthForm notice={notice} onLogin={login} />}
      </main>

      <footer className="app-footer">
        Proyecto de portafolio de{" "}
        <a href="https://luisch57.github.io/" target="_blank" rel="noreferrer">
          Sebastián Chávez
        </a>{" "}
        · React + TypeScript · API en Node.js con PostgreSQL
      </footer>
    </div>
  );
}
