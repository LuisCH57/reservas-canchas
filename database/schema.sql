-- ==========================================================
-- Base de datos: Sistema de reservas de canchas deportivas
-- Ejecuta este archivo completo en el SQL Editor de Neon.
-- ==========================================================

DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS courts;
DROP TABLE IF EXISTS users;

-- ----------------------------------------------------------
-- 1. USUARIOS: clientes y administradores
-- ----------------------------------------------------------
CREATE TABLE users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE CHECK (email = lower(email)), -- siempre en minúsculas
  password_hash TEXT         NOT NULL,  -- NUNCA la contraseña real: solo su "huella" (hash)
  role          VARCHAR(20)  NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer', 'admin')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- 2. CANCHAS: lo que se puede reservar
-- ----------------------------------------------------------
CREATE TABLE courts (
  id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                 VARCHAR(80) NOT NULL UNIQUE,
  sport                VARCHAR(30) NOT NULL,
  price_per_hour_cents INTEGER     NOT NULL CHECK (price_per_hour_cents > 0),
  open_hour            SMALLINT    NOT NULL DEFAULT 8  CHECK (open_hour BETWEEN 0 AND 23),
  close_hour           SMALLINT    NOT NULL DEFAULT 23 CHECK (close_hour BETWEEN 1 AND 24),
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  CHECK (open_hour < close_hour)
);

-- ----------------------------------------------------------
-- 3. RESERVAS: un usuario reserva una cancha, un día, una hora
-- ----------------------------------------------------------
CREATE TABLE reservations (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  court_id     INTEGER     NOT NULL REFERENCES courts(id),
  date         DATE        NOT NULL,
  start_hour   SMALLINT    NOT NULL CHECK (start_hour BETWEEN 0 AND 23), -- 18 = de 18:00 a 19:00
  price_cents  INTEGER     NOT NULL CHECK (price_cents > 0),            -- precio al momento de reservar
  status       VARCHAR(20) NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('confirmed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

-- REGLA DE ORO: una cancha no puede tener dos reservas CONFIRMADAS a la misma hora.
-- Es un índice único "parcial": solo mira las reservas confirmadas,
-- así una reserva cancelada deja el horario libre otra vez.
CREATE UNIQUE INDEX one_booking_per_slot
  ON reservations (court_id, date, start_hour)
  WHERE status = 'confirmed';

-- Acelera la consulta "mis reservas"
CREATE INDEX reservations_by_user ON reservations (user_id, date);

-- ----------------------------------------------------------
-- 4. DATOS DE EJEMPLO
-- (Los usuarios se crean desde la aplicación, porque sus
--  contraseñas deben guardarse como hash.)
-- ----------------------------------------------------------
INSERT INTO courts (name, sport, price_per_hour_cents, open_hour, close_hour) VALUES
  ('Cancha 1 - Fútbol 7',    'Fútbol', 8000, 8, 23),
  ('Cancha 2 - Fútbol 7',    'Fútbol', 8000, 8, 23),
  ('Cancha 3 - Fulbito',     'Fútbol', 6000, 8, 23),
  ('Cancha 4 - Vóley',       'Vóley',  4000, 9, 22);
