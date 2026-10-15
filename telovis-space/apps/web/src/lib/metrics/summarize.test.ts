import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, summarize, type VisitRow } from "./summarize";

const BRT = -180; // Brasília, UTC-3
// 2026-10-10 00:00 em Brasília = 03:00 UTC.
const D0 = Date.UTC(2026, 9, 10, 3, 0, 0);
const H = 60 * 60 * 1000;
const range = { from: D0, to: D0 + 3 * 24 * H };

const visit = (userId: string, startH: number, endH: number, extra: Partial<VisitRow> = {}): VisitRow => ({
  userId,
  startedAt: D0 + startH * H,
  endedAt: D0 + endH * H,
  messages: 0,
  talkSeconds: 0,
  zones: {},
  ...extra,
});

test("lista todos os dias do período, inclusive vazios", () => {
  const s = summarize([], range, BRT);
  assert.deepEqual(s.days.map((d) => d.day), ["2026-10-10", "2026-10-11", "2026-10-12"]);
  assert.equal(s.totalSeconds, 0);
  assert.equal(s.peak.people, 0);
});

test("visita que atravessa a meia-noite conta nos dois dias", () => {
  const s = summarize([visit("ana", 22, 26)], range, BRT);
  assert.deepEqual(
    s.days.map((d) => [d.day, d.seconds, d.people]),
    [["2026-10-10", 2 * 3600, 1], ["2026-10-11", 2 * 3600, 1], ["2026-10-12", 0, 0]],
  );
  assert.equal(s.people[0].activeDays, 2);
});

test("duas abas da mesma pessoa não dobram o tempo nem o pico", () => {
  const s = summarize([visit("ana", 9, 11), visit("ana", 10, 12)], range, BRT);
  assert.equal(s.totalSeconds, 3 * 3600);
  assert.equal(s.peak.people, 1);
  assert.equal(s.activePeople, 1);
});

test("pico conta pessoas distintas ao mesmo tempo", () => {
  const s = summarize([visit("ana", 9, 12), visit("bruno", 10, 11), visit("carla", 11, 13)], range, BRT);
  // 10h–11h: Ana + Bruno; às 11h Bruno sai antes de Carla entrar → 2, não 3.
  assert.equal(s.peak.people, 2);
  assert.equal(s.peak.at, D0 + 10 * H);
});

test("recorta ao período; contadores só de visitas que começaram nele", () => {
  const s = summarize(
    [
      visit("ana", -2, 1, { messages: 5, talkSeconds: 100, zones: { sala: 60 } }),
      visit("bruno", 1, 2, { messages: 3, talkSeconds: 30, zones: { sala: 30, foco: 10 } }),
    ],
    range,
    BRT,
  );
  assert.equal(s.totalSeconds, 2 * 3600); // Ana: só 1h dentro; Bruno: 1h
  assert.equal(s.messages, 3);
  assert.equal(s.talkSeconds, 30);
  assert.deepEqual(s.zones, [
    { zoneId: "sala", seconds: 30, people: 1 },
    { zoneId: "foco", seconds: 10, people: 1 },
  ]);
});

test("pessoas ordenadas por tempo", () => {
  const s = summarize([visit("ana", 1, 2), visit("bruno", 1, 4)], range, BRT);
  assert.deepEqual(s.people.map((p) => p.userId), ["bruno", "ana"]);
});

test("formatDuration", () => {
  assert.equal(formatDuration(40), "40s");
  assert.equal(formatDuration(12 * 60), "12min");
  assert.equal(formatDuration(3 * 3600), "3h");
  assert.equal(formatDuration(3 * 3600 + 25 * 60), "3h 25min");
});

test("trechos colados de uma visita longa somam como uma só", () => {
  const s = summarize([visit("ana", 9, 10), visit("ana", 10, 11), visit("bruno", 10, 10.5)], range, BRT);
  assert.equal(s.people.find((p) => p.userId === "ana")?.seconds, 2 * 3600);
  assert.equal(s.peak.people, 2);
});
