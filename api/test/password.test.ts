import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/auth/password.ts";

describe("contraseñas", () => {
  it("nunca guarda la contraseña en texto plano", async () => {
    const hash = await hashPassword("mi-clave-secreta");
    assert.ok(!hash.includes("mi-clave-secreta"));
    assert.match(hash, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
  });

  it("la misma contraseña produce hashes distintos (por la sal)", async () => {
    const first = await hashPassword("misma-clave");
    const second = await hashPassword("misma-clave");
    assert.notEqual(first, second);
  });

  it("verifica la contraseña correcta y rechaza la incorrecta", async () => {
    const hash = await hashPassword("clave-correcta");
    assert.equal(await verifyPassword("clave-correcta", hash), true);
    assert.equal(await verifyPassword("clave-incorrecta", hash), false);
  });

  it("rechaza un hash con formato desconocido sin lanzar error", async () => {
    assert.equal(await verifyPassword("lo-que-sea", "texto-raro"), false);
  });
});
