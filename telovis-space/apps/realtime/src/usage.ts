import { SignJWT } from "jose";
import {
  canHear,
  MAX_VISIT_MS,
  MAX_VISITS_PER_BATCH,
  REALTIME_USAGE_AUDIENCE,
  type PlayerState,
  type VisitReport,
} from "@telovis/protocol";

// Métricas de uso: uma "visita" por socket numa sala, do join até sair.
// Acumula tempo em salas privadas, tempo conversando e mensagens; ao fim, a
// visita entra numa fila que é mandada ao Next em lotes. Se o Next estiver
// fora, a fila espera a próxima rodada (com teto, para não crescer sem fim).
//
// Visita longa é gravada em trechos de SEGMENT_MS: assim o dashboard mostra
// quem está conectado agora (com até 5 min de atraso) e uma queda do
// realtime perde no máximo um trecho. A conta do Next une trechos colados.

/** Visitas mais curtas que isto (recarregar a página, StrictMode) são descartadas. */
const MIN_VISIT_MS = 5_000;
/** Tamanho de cada trecho gravado de uma visita aberta. */
const SEGMENT_MS = 5 * 60_000;
/** De quanto em quanto tempo amostra quem está conversando. */
export const TALK_SAMPLE_MS = 10_000;
const FLUSH_INTERVAL_MS = 15_000;
const MAX_QUEUE = 5_000;
const TIMEOUT_MS = 5_000;

interface OpenVisit {
  space: string;
  userId: string;
  startedAt: number;
  messages: number;
  talkSeconds: number;
  zones: Record<string, number>;
  zoneId: string | null;
  zoneSince: number;
}

export class UsageTracker {
  private open = new Map<string, OpenVisit>();
  private queue: VisitReport[] = [];
  private flushing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly endpoint: string | null,
    private readonly secret: Uint8Array,
  ) {}

  start(socketId: string, space: string, userId: string, now = Date.now()) {
    this.end(socketId, now);
    this.open.set(socketId, {
      space,
      userId,
      startedAt: now,
      messages: 0,
      talkSeconds: 0,
      zones: {},
      zoneId: null,
      zoneSince: now,
    });
  }

  zone(socketId: string, zoneId: string | null, now = Date.now()) {
    const v = this.open.get(socketId);
    if (!v || v.zoneId === zoneId) return;
    this.closeZone(v, now);
    v.zoneId = zoneId;
    v.zoneSince = now;
  }

  message(socketId: string) {
    const v = this.open.get(socketId);
    if (v) v.messages++;
  }

  /**
   * Chamado a cada TALK_SAMPLE_MS com os jogadores de uma sala: quem tem
   * alguém ao alcance de voz ganha o intervalo como "conversando".
   */
  sampleTalk(players: PlayerState[], intervalMs = TALK_SAMPLE_MS) {
    for (const p of players) {
      const v = this.open.get(p.id);
      if (!v) continue;
      if (players.some((o) => o.id !== p.id && canHear(p, o))) {
        v.talkSeconds += Math.round(intervalMs / 1000);
      }
    }
  }

  end(socketId: string, now = Date.now()) {
    const v = this.open.get(socketId);
    if (!v) return;
    this.open.delete(socketId);
    this.closeZone(v, now);
    const endedAt = Math.min(now, v.startedAt + MAX_VISIT_MS);
    const duration = endedAt - v.startedAt;
    if (duration < MIN_VISIT_MS) return;
    const seconds = Math.ceil(duration / 1000);
    this.queue.push({
      space: v.space,
      userId: v.userId,
      startedAt: v.startedAt,
      endedAt,
      messages: v.messages,
      // A amostragem é em blocos de 10s: nunca passa da duração da visita.
      talkSeconds: Math.min(v.talkSeconds, seconds),
      zones: Object.fromEntries(Object.entries(v.zones).map(([z, s]) => [z, Math.min(s, seconds)])),
    });
    if (this.queue.length > MAX_QUEUE) {
      const dropped = this.queue.length - MAX_QUEUE;
      this.queue.splice(0, dropped);
      console.error(`[usage] fila cheia: ${dropped} visita(s) descartada(s)`);
    }
  }

  /** Fecha os trechos de visitas abertas há mais de SEGMENT_MS e recomeça. */
  checkpoint(now = Date.now()) {
    for (const [socketId, v] of this.open) {
      if (now - v.startedAt < SEGMENT_MS) continue;
      const { space, userId, zoneId } = v;
      this.end(socketId, now);
      this.start(socketId, space, userId, now);
      this.zone(socketId, zoneId, now);
    }
  }

  /** Fecha todas as visitas abertas (desligamento) e tenta mandar tudo. */
  async shutdown() {
    this.stop();
    const now = Date.now();
    for (const id of [...this.open.keys()]) this.end(id, now);
    await this.flush();
  }

  startFlushing() {
    this.timer = setInterval(() => {
      this.checkpoint();
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Para testes e para o desligamento. */
  pending(): readonly VisitReport[] {
    return this.queue;
  }

  async flush() {
    if (this.flushing || this.queue.length === 0 || !this.endpoint) return;
    this.flushing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, MAX_VISITS_PER_BATCH);
        if (!(await this.send(batch))) break;
        this.queue.splice(0, batch.length);
      }
    } finally {
      this.flushing = false;
    }
  }

  private async send(visits: VisitReport[]): Promise<boolean> {
    try {
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setAudience(REALTIME_USAGE_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime("30s")
        .sign(this.secret);
      const res = await fetch(this.endpoint!, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ visits }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return true;
      console.error(`[usage] Next recusou ${visits.length} visita(s): HTTP ${res.status}`);
      // 400/413 = lote inválido: tentar de novo não adianta, descarta. 401 é
      // segredo diferente entre os .env: fica na fila até alguém corrigir.
      return res.status >= 400 && res.status < 500 && res.status !== 401;
    } catch (err) {
      console.error("[usage] falha ao mandar visitas; tenta de novo depois", (err as Error).message);
      return false;
    }
  }

  private closeZone(v: OpenVisit, now: number) {
    if (!v.zoneId) return;
    const s = Math.round((now - v.zoneSince) / 1000);
    if (s > 0) v.zones[v.zoneId] = (v.zones[v.zoneId] ?? 0) + s;
  }
}
