// ==========================================================
// PRUEBAS DE INTEGRACIÓN: prueban la API completa como lo haría el
// frontend (peticiones HTTP reales) contra una base de datos real en memoria.
// Lo más importante que verifican: que NADIE pueda saltarse los permisos.
// ==========================================================
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers.ts";
import { addDays, limaNow } from "../src/utils/time.ts";

const api = await startTestServer();
after(() => api.close());

// Fechas relativas a "hoy" para que las pruebas funcionen cualquier día
const today = limaNow().date;
const tomorrow = addDays(today, 1);
const dayAfter = addDays(today, 2);

describe("autenticación", () => {
  it("registra un cliente y devuelve un token", async () => {
    const res = await api.request("POST", "/auth/register", {
      body: { name: "Ana Torres", email: "Ana@Correo.com", password: "clave-segura-1" },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, "ana@correo.com"); // guardado en minúsculas
    assert.equal(res.body.user.role, "customer");
    assert.ok(res.body.token);
    assert.equal(res.body.user.password_hash, undefined); // nunca se devuelve el hash
  });

  it("ignora un rol enviado por el cliente: nadie se registra como admin", async () => {
    const res = await api.request("POST", "/auth/register", {
      body: { name: "Pícaro", email: "picaro@correo.com", password: "quiero-ser-admin", role: "admin" },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "customer");
  });

  it("no permite dos cuentas con el mismo correo", async () => {
    const res = await api.request("POST", "/auth/register", {
      body: { name: "Otra Ana", email: "ana@correo.com", password: "otra-clave-2" },
    });
    assert.equal(res.status, 409);
  });

  it("responde igual si el correo no existe o la contraseña es incorrecta", async () => {
    const wrongPassword = await api.request("POST", "/auth/login", {
      body: { email: "ana@correo.com", password: "incorrecta" },
    });
    const unknownEmail = await api.request("POST", "/auth/login", {
      body: { email: "nadie@correo.com", password: "incorrecta" },
    });
    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
  });

  it("rechaza un token alterado", async () => {
    const { token } = await api.createCustomer();
    // Cambiamos una letra de la firma: el token deja de ser válido
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    const res = await api.request("GET", "/auth/me", { token: tampered });
    assert.equal(res.status, 401);
  });
});

describe("reservas", () => {
  let ana: { id: number; token: string };
  let beto: { id: number; token: string };

  before(async () => {
    ana = await api.createCustomer();
    beto = await api.createCustomer();
  });

  it("exige iniciar sesión para reservar", async () => {
    const res = await api.request("POST", "/reservations", {
      body: { courtId: 1, date: tomorrow, startHour: 18 },
    });
    assert.equal(res.status, 401);
  });

  it("reserva un horario libre con el precio de la cancha", async () => {
    const res = await api.request("POST", "/reservations", {
      token: ana.token,
      body: { courtId: 1, date: tomorrow, startHour: 18 },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.priceCents, 8000);
    assert.equal(res.body.date, tomorrow);
    assert.equal(res.body.status, "confirmed");
  });

  it("NO permite reservar un horario ocupado", async () => {
    const res = await api.request("POST", "/reservations", {
      token: beto.token,
      body: { courtId: 1, date: tomorrow, startHour: 18 },
    });
    assert.equal(res.status, 409);
  });

  it("muestra el horario ocupado sin revelar quién lo reservó", async () => {
    const anonymous = await api.request("GET", `/courts/availability?date=${tomorrow}`);
    const asOwner = await api.request("GET", `/courts/availability?date=${tomorrow}`, { token: ana.token });

    const slotFor = (body: any) =>
      body.courts.find((court: any) => court.id === 1).slots.find((slot: any) => slot.hour === 18);

    assert.equal(slotFor(anonymous.body).status, "booked");
    assert.equal(slotFor(asOwner.body).status, "mine");
    assert.equal(JSON.stringify(anonymous.body).includes("Cliente"), false); // sin nombres
  });

  it("un cliente NO puede cancelar la reserva de otro", async () => {
    const mine = await api.request("GET", "/reservations/mine", { token: ana.token });
    const reservationId = mine.body[0].id;

    const res = await api.request("PATCH", `/reservations/${reservationId}/cancel`, { token: beto.token });
    assert.equal(res.status, 404); // ni siquiera le confirmamos que existe
  });

  it("el dueño cancela y el horario queda libre para otro", async () => {
    const mine = await api.request("GET", "/reservations/mine", { token: ana.token });
    const reservationId = mine.body[0].id;

    const cancel = await api.request("PATCH", `/reservations/${reservationId}/cancel`, { token: ana.token });
    assert.equal(cancel.status, 200);

    const again = await api.request("PATCH", `/reservations/${reservationId}/cancel`, { token: ana.token });
    assert.equal(again.status, 409); // ya estaba cancelada

    const rebook = await api.request("POST", "/reservations", {
      token: beto.token,
      body: { courtId: 1, date: tomorrow, startHour: 18 },
    });
    assert.equal(rebook.status, 201);
  });

  it("rechaza fechas pasadas, horas fuera de atención y fechas muy lejanas", async () => {
    const past = await api.request("POST", "/reservations", {
      token: ana.token,
      body: { courtId: 1, date: addDays(today, -1), startHour: 18 },
    });
    const tooEarly = await api.request("POST", "/reservations", {
      token: ana.token,
      body: { courtId: 1, date: tomorrow, startHour: 6 },
    });
    const tooFar = await api.request("POST", "/reservations", {
      token: ana.token,
      body: { courtId: 1, date: addDays(today, 30), startHour: 18 },
    });
    assert.equal(past.status, 400);
    assert.equal(tooEarly.status, 400);
    assert.equal(tooFar.status, 400);
  });

  it("limita a 3 las reservas próximas de un cliente", async () => {
    const carla = await api.createCustomer();
    for (const hour of [10, 11, 12]) {
      const res = await api.request("POST", "/reservations", {
        token: carla.token,
        body: { courtId: 2, date: dayAfter, startHour: hour },
      });
      assert.equal(res.status, 201);
    }
    const fourth = await api.request("POST", "/reservations", {
      token: carla.token,
      body: { courtId: 2, date: dayAfter, startHour: 13 },
    });
    assert.equal(fourth.status, 409);
  });
});

describe("administración", () => {
  let customerToken: string;
  let adminToken: string;

  before(async () => {
    customerToken = (await api.createCustomer()).token;
    adminToken = await api.createAdmin();
  });

  it("un cliente NO puede entrar a las rutas de administración", async () => {
    const res = await api.request("GET", "/admin/reservations", { token: customerToken });
    assert.equal(res.status, 403);
  });

  it("sin sesión responde 401 (no 403)", async () => {
    const res = await api.request("GET", "/admin/reservations");
    assert.equal(res.status, 401);
  });

  it("el admin ve las reservas del día con los datos del cliente", async () => {
    const res = await api.request("GET", `/admin/reservations?date=${tomorrow}`, { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.length > 0);
    assert.ok(res.body[0].customerEmail);
  });

  it("el admin crea una cancha y un cliente no puede", async () => {
    const court = { name: "Cancha 5 - Básquet", sport: "Básquet", pricePerHourCents: 5000, openHour: 9, closeHour: 21 };

    const asCustomer = await api.request("POST", "/admin/courts", { token: customerToken, body: court });
    assert.equal(asCustomer.status, 403);

    const asAdmin = await api.request("POST", "/admin/courts", { token: adminToken, body: court });
    assert.equal(asAdmin.status, 201);
    assert.equal(asAdmin.body.isActive, true);
  });

  it("una cancha desactivada no se puede reservar", async () => {
    const courts = await api.request("GET", "/admin/courts", { token: adminToken });
    const volley = courts.body.find((court: any) => court.sport === "Vóley");

    const update = await api.request("PUT", `/admin/courts/${volley.id}`, {
      token: adminToken,
      body: { ...volley, isActive: false },
    });
    assert.equal(update.status, 200);

    const booking = await api.request("POST", "/reservations", {
      token: customerToken,
      body: { courtId: volley.id, date: tomorrow, startHour: 15 },
    });
    assert.equal(booking.status, 404);
  });

  it("el resumen del mes suma solo las reservas confirmadas", async () => {
    const res = await api.request("GET", "/admin/summary", { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.revenueCents, "number");
    // La reserva que canceló Ana cuenta como cancelada (si "mañana" cae en este mes)
    if (tomorrow.slice(0, 7) === today.slice(0, 7)) {
      assert.ok(res.body.cancelled >= 1);
    }
  });
});
