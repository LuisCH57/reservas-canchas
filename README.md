# Sistema de reservas de canchas deportivas

Aplicación web full stack para reservar canchas por hora. Los clientes ven la disponibilidad en tiempo real y reservan con un clic, y el administrador gestiona las canchas y revisa los ingresos del mes.

**Demo:** https://luisch57.github.io/reservas-canchas/
_La API usa un plan gratuito que se apaga sin uso: la primera carga puede tardar hasta un minuto._

![Pruebas de la API](https://github.com/LuisCH57/reservas-canchas/actions/workflows/test.yml/badge.svg)

## Funcionalidades

**Clientes**
- Crear una cuenta e iniciar sesión.
- Ver la grilla de horarios de todas las canchas para los próximos 14 días (libre, ocupado, tu reserva).
- Reservar un horario y cancelar sus reservas futuras.
- Máximo 3 reservas próximas por cliente, para que nadie acapare los horarios.

**Administrador**
- Indicadores del mes: ingresos, reservas confirmadas y canceladas, reservas de hoy y clientes.
- Ingresos por cancha.
- Reservas de cualquier día con el nombre y correo del cliente, con opción de cancelarlas.
- Crear canchas y editar su precio, horario de atención o activarlas y desactivarlas.

## Arquitectura

```
 Navegador                    Servidor                      Base de datos
┌──────────────┐   HTTP    ┌──────────────────┐   SQL    ┌──────────────┐
│ React + TS   │ ────────► │ Node.js+Express  │ ───────► │  PostgreSQL  │
│ GitHub Pages │ ◄──JSON── │ TypeScript, JWT  │ ◄─────── │    (Neon)    │
└──────────────┘           │ Render           │          └──────────────┘
                           └──────────────────┘
```

| Carpeta | Contenido |
|---|---|
| `web/` | Frontend en React con TypeScript (Vite) |
| `api/` | API REST en Express con TypeScript, autenticación y 31 pruebas automáticas |
| `database/` | Esquema SQL con las canchas de ejemplo |
| `.github/workflows/` | Publicación del frontend y ejecución de las pruebas en cada push |

### Modelo de datos

- `users`: nombre, correo (único), hash de la contraseña y rol (`customer` o `admin`).
- `courts`: nombre, deporte, precio por hora, horario de atención y si está activa.
- `reservations`: usuario, cancha, fecha, hora de inicio, precio **al momento de reservar** y estado (`confirmed` o `cancelled`).

## API

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | Público | Crear una cuenta de cliente |
| POST | `/api/auth/login` | Público | Iniciar sesión (devuelve un JWT) |
| GET | `/api/auth/me` | Con sesión | Datos del usuario actual |
| GET | `/api/courts` | Público | Canchas activas |
| GET | `/api/courts/availability?date=` | Público | Horarios de un día (marca los propios si hay sesión) |
| GET | `/api/reservations/mine` | Con sesión | Mis reservas |
| POST | `/api/reservations` | Con sesión | Reservar |
| PATCH | `/api/reservations/:id/cancel` | Dueño o admin | Cancelar |
| GET | `/api/admin/summary` | Admin | Indicadores del mes |
| GET | `/api/admin/reservations?date=` | Admin | Reservas de un día con datos del cliente |
| GET/POST | `/api/admin/courts` | Admin | Listar y crear canchas |
| PUT | `/api/admin/courts/:id` | Admin | Editar una cancha |

## Decisiones técnicas

- **Sin reservas duplicadas, garantizado por la base de datos:** un índice único parcial (`UNIQUE (court_id, date, start_hour) WHERE status = 'confirmed'`) impide que dos personas reserven el mismo horario, incluso si envían la petición en el mismo instante. La API traduce ese error a un `409`.
- **Contraseñas con `scrypt`** y sal aleatoria (módulo `crypto` de Node). Nunca se guardan ni se devuelven en texto plano.
- **Sesiones con JWT** firmados que expiran a las 8 horas.
- **Autorización en el servidor:** `401` si no hay sesión y `403` si el rol no tiene permiso. Una reserva ajena responde `404`, para no revelar que existe. Ocultar botones en el frontend es solo comodidad.
- **El rol nunca viene del cliente:** todo registro público es `customer`; los administradores se crean con un script (`npm run create-admin`).
- **Privacidad:** la grilla pública muestra que un horario está ocupado, pero no quién lo reservó.
- **Inicio de sesión sin pistas:** el mismo mensaje y un tiempo de respuesta similar si el correo no existe o si la contraseña es incorrecta.
- **TypeScript en todo el proyecto:** la API se ejecuta con el soporte nativo de TypeScript de Node.js 24, sin paso de compilación.
- **Pruebas automáticas** (`node:test`) contra un PostgreSQL real en memoria (PGlite), así no tocan la base de datos de producción. Se ejecutan en GitHub Actions en cada push.
- **Zona horaria `America/Lima`** para decidir qué horarios ya pasaron, sin importar dónde esté el servidor.
- **Dinero en céntimos** (enteros) y consultas parametrizadas contra inyección SQL.

## Limitaciones y mejoras futuras

- El token se guarda en `localStorage`. Una cookie `httpOnly` sería más resistente a ataques XSS, pero requiere protección CSRF.
- No hay recuperación de contraseña por correo.
- Pagos en línea: hoy el pago se hace en el local.
- Pruebas del frontend (por ejemplo, con Playwright).

## Cómo ejecutarlo en tu computadora

1. Crea una base de datos PostgreSQL (por ejemplo, gratis en [Neon](https://neon.com)) y ejecuta `database/schema.sql`.
2. API:
   ```bash
   cd api
   cp .env.example .env   # completa DATABASE_URL y JWT_SECRET
   npm install
   npm run create-admin -- "Tu Nombre" tu@correo.com "una-contraseña-segura"
   npm run dev
   ```
3. Frontend, en otra terminal:
   ```bash
   cd web
   npm install
   npm run dev
   ```
4. Abre `http://localhost:5173`.

Para ejecutar las pruebas (no necesitan base de datos): `cd api && npm test`.

---

Desarrollado por [Sebastián Chávez](https://luisch57.github.io/) · Estudiante de Ingeniería de Sistemas, UPC.
