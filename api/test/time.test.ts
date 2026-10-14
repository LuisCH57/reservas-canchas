// ==========================================================
// PRUEBAS UNITARIAS: prueban funciones sueltas, sin base de datos.
// Cada "it" es un caso. assert comprueba que el resultado sea el esperado;
// si no lo es, la prueba falla y te dice qué esperaba y qué obtuvo.
// ==========================================================
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addDays, checkBookingTime, isValidDate, limaNow } from "../src/utils/time.ts";

describe("limaNow", () => {
  it("convierte la hora UTC a la hora de Perú (5 horas menos)", () => {
    // 14 de octubre, 02:30 en UTC = 13 de octubre, 21:30 en Lima
    const result = limaNow(new Date("2026-10-14T02:30:00Z"));
    assert.deepEqual(result, { date: "2026-10-13", hour: 21 });
  });
});

describe("isValidDate", () => {
  it("acepta fechas reales en formato AAAA-MM-DD", () => {
    assert.equal(isValidDate("2026-10-20"), true);
  });

  it("rechaza fechas que no existen o con otro formato", () => {
    assert.equal(isValidDate("2026-02-30"), false);
    assert.equal(isValidDate("20/10/2026"), false);
    assert.equal(isValidDate(20261020), false);
  });
});

describe("addDays", () => {
  it("suma días cambiando de mes y de año", () => {
    assert.equal(addDays("2026-10-30", 3), "2026-11-02");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  });
});

describe("checkBookingTime", () => {
  const court = { openHour: 8, closeHour: 23 };
  const now = { date: "2026-10-14", hour: 15 }; // hoy a las 15:xx

  it("acepta un horario futuro dentro del horario de atención", () => {
    assert.equal(checkBookingTime("2026-10-14", 18, court, now), null);
    assert.equal(checkBookingTime("2026-10-20", 8, court, now), null);
  });

  it("rechaza horarios que ya pasaron, incluida la hora en curso", () => {
    assert.match(checkBookingTime("2026-10-13", 18, court, now)!, /ya pasó/);
    assert.match(checkBookingTime("2026-10-14", 15, court, now)!, /ya pasó/);
  });

  it("rechaza horas fuera del horario de atención", () => {
    assert.match(checkBookingTime("2026-10-20", 7, court, now)!, /atiende/);
    assert.match(checkBookingTime("2026-10-20", 23, court, now)!, /atiende/);
  });

  it("rechaza fechas más allá de la ventana de reserva", () => {
    assert.equal(checkBookingTime("2026-10-28", 18, court, now), null); // día 14: permitido
    assert.match(checkBookingTime("2026-10-29", 18, court, now)!, /anticipación/); // día 15: no
  });
});
