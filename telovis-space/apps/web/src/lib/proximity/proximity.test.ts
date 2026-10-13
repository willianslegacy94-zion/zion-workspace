import { test } from "node:test";
import assert from "node:assert/strict";
import { decideMedia, distance, volumeForDistance, type Positioned } from "./proximity";

const at = (id: string, x: number, y: number, zoneId: string | null = null): Positioned => ({
  id,
  x,
  y,
  zoneId,
});

test("distância euclidiana", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test("ativa dentro de 150px e desativa fora", () => {
  const me = at("me", 0, 0);
  const res = decideMedia(me, [at("perto", 150, 0), at("longe", 151, 0)]);
  assert.equal(res.get("perto")?.active, true);
  assert.equal(res.get("longe")?.active, false);
  assert.equal(res.get("longe")?.volume, 0);
});

test("volume cresce conforme a distância tende a zero", () => {
  assert.equal(volumeForDistance(0), 1);
  assert.equal(volumeForDistance(40), 1);
  assert.equal(volumeForDistance(150), 0);
  const v60 = volumeForDistance(60);
  const v120 = volumeForDistance(120);
  assert.ok(v60 > v120 && v120 > 0 && v60 < 1);
});

test("histerese: quem já está ativo só cai depois de 170px", () => {
  const me = at("me", 0, 0);
  const first = decideMedia(me, [at("a", 100, 0)]);
  assert.equal(first.get("a")?.active, true);

  const drifting = decideMedia(me, [at("a", 160, 0)], first);
  assert.equal(drifting.get("a")?.active, true);

  const gone = decideMedia(me, [at("a", 171, 0)], drifting);
  assert.equal(gone.get("a")?.active, false);

  // E quem estava inativo não ativa a 160px.
  assert.equal(decideMedia(me, [at("a", 160, 0)], gone).get("a")?.active, false);
});

test("zona privada: só ocupantes da mesma zona se ouvem, com volume cheio", () => {
  const me = at("me", 0, 0, "sala-1");
  const res = decideMedia(me, [
    at("mesma-sala-longe", 400, 0, "sala-1"),
    at("fora-colado", 10, 0, null),
    at("outra-sala", 10, 0, "sala-2"),
  ]);
  assert.deepEqual(
    [res.get("mesma-sala-longe")?.active, res.get("mesma-sala-longe")?.volume],
    [true, 1],
  );
  assert.equal(res.get("fora-colado")?.active, false);
  assert.equal(res.get("outra-sala")?.active, false);
});

test("quem está fora não ouve quem está dentro de uma zona", () => {
  const me = at("me", 0, 0, null);
  const res = decideMedia(me, [at("dentro", 5, 0, "sala-1")]);
  assert.equal(res.get("dentro")?.reason, "zone-isolated");
  assert.equal(res.get("dentro")?.active, false);
});

test("ignora o próprio avatar na lista de remotos", () => {
  const me = at("me", 0, 0);
  assert.equal(decideMedia(me, [me]).size, 0);
});
