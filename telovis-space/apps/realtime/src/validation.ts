import {
  CHAT_MAX_LENGTH,
  DIRECTIONS,
  SPACE_ID_PATTERN,
  type Direction,
  type JoinPayload,
  type MovePayload,
} from "@telovis/protocol";

// Os payloads vêm de clientes não confiáveis: tudo é validado antes de entrar
// no estado da sala ou ser retransmitido.

const MAX_COORD = 100_000;

function isCoord(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_COORD;
}

function parseZoneId(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string" && v.length > 0 && v.length <= 64) return v;
  return undefined;
}

export function parseJoin(raw: unknown): JoinPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { spaceId, x, y } = raw as Record<string, unknown>;
  if (typeof spaceId !== "string" || !SPACE_ID_PATTERN.test(spaceId)) return null;
  if (!isCoord(x) || !isCoord(y)) return null;
  return { spaceId, x, y };
}

export function parseMove(raw: unknown): MovePayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { x, y, direction, moving, zoneId } = raw as Record<string, unknown>;
  if (!isCoord(x) || !isCoord(y)) return null;
  if (!DIRECTIONS.includes(direction as Direction)) return null;
  if (typeof moving !== "boolean") return null;
  const zone = parseZoneId(zoneId);
  if (zone === undefined) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    direction: direction as Direction,
    moving,
    zoneId: zone,
  };
}

export function parseChat(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { text } = raw as Record<string, unknown>;
  if (typeof text !== "string") return null;
  // Colapsa quebras de linha: o balão sobre o avatar é de uma linha só.
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > CHAT_MAX_LENGTH) return null;
  return clean;
}
