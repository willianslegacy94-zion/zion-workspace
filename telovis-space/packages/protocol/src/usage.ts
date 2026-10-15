import { SPACE_ID_PATTERN } from "./index";

// Métricas de uso: o realtime registra cada visita (uma conexão numa sala, do
// join até sair) e manda ao Next, que grava no banco. Só contagens e tempos —
// o texto do chat nunca sai do realtime.

/** Audiência do JWT realtime → Next (POST /api/internal/visits). */
export const REALTIME_USAGE_AUDIENCE = "telovis-web-usage";

export const MAX_VISITS_PER_BATCH = 100;
/** Visitas mais longas que isto são cortadas pelo realtime (conexão esquecida). */
export const MAX_VISIT_MS = 24 * 60 * 60 * 1000;
const MAX_ZONES = 32;

export interface VisitReport {
  /** slug do space */
  space: string;
  userId: string;
  /** epoch ms */
  startedAt: number;
  endedAt: number;
  /** Mensagens de chat enviadas na visita. */
  messages: number;
  /** Segundos com alguém ao alcance de voz (mesma regra da mídia). */
  talkSeconds: number;
  /** Segundos em cada sala privada (zoneId → s). */
  zones: Record<string, number>;
}

const isCount = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;

/** Valida um VisitReport vindo da rede; null se algo estiver fora do formato. */
export function parseVisitReport(raw: unknown): VisitReport | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.space !== "string" || !SPACE_ID_PATTERN.test(r.space)) return null;
  if (typeof r.userId !== "string" || !r.userId || r.userId.length > 64) return null;
  if (!isCount(r.startedAt, Number.MAX_SAFE_INTEGER) || !isCount(r.endedAt, Number.MAX_SAFE_INTEGER)) return null;
  const duration = r.endedAt - r.startedAt;
  if (duration < 0 || duration > MAX_VISIT_MS) return null;
  const seconds = Math.ceil(duration / 1000);
  if (!isCount(r.messages, 1_000_000) || !isCount(r.talkSeconds, seconds)) return null;

  if (typeof r.zones !== "object" || r.zones === null || Array.isArray(r.zones)) return null;
  const entries = Object.entries(r.zones as Record<string, unknown>);
  if (entries.length > MAX_ZONES) return null;
  const zones: Record<string, number> = {};
  for (const [id, s] of entries) {
    if (!id || id.length > 64 || !isCount(s, seconds)) return null;
    zones[id] = s;
  }
  return {
    space: r.space,
    userId: r.userId,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    messages: r.messages,
    talkSeconds: r.talkSeconds,
    zones,
  };
}
