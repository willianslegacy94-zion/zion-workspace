// Agregação das visitas para a página de métricas. Função pura (sem banco),
// para dar para testar: recebe as visitas que encostam no período e devolve
// os números já prontos para a tela.
//
// Regras:
// - Tempo de presença é recortado ao período e dividido por dia (no fuso
//   `tzOffsetMinutes`, ex.: -180 para Brasília); uma visita que atravessa a
//   meia-noite conta nos dois dias.
// - Mensagens, tempo conversando e tempo em salas não têm horário fino: vão
//   inteiros para o período se a visita começou dentro dele.
// - Pessoa com duas abas abertas conta uma vez: os intervalos sobrepostos dela
//   são unidos antes de somar o tempo, e o pico conta pessoas distintas.

export interface VisitRow {
  userId: string;
  startedAt: number;
  endedAt: number;
  messages: number;
  talkSeconds: number;
  zones: Record<string, number>;
}

export interface DayStat {
  /** YYYY-MM-DD no fuso escolhido */
  day: string;
  seconds: number;
  people: number;
}

export interface PersonStat {
  userId: string;
  seconds: number;
  activeDays: number;
  talkSeconds: number;
  messages: number;
  lastSeen: number;
}

export interface ZoneStat {
  zoneId: string;
  seconds: number;
  people: number;
}

export interface UsageSummary {
  totalSeconds: number;
  activePeople: number;
  messages: number;
  talkSeconds: number;
  /** Máximo de pessoas (distintas) ao mesmo tempo, e quando. */
  peak: { people: number; at: number | null };
  days: DayStat[];
  people: PersonStat[];
  zones: ZoneStat[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function summarize(
  visits: VisitRow[],
  range: { from: number; to: number },
  tzOffsetMinutes: number,
): UsageSummary {
  const off = tzOffsetMinutes * 60_000;
  const dayStart = (t: number) => Math.floor((t + off) / DAY_MS) * DAY_MS - off;
  const dayKey = (t: number) => new Date(dayStart(t) + off).toISOString().slice(0, 10);

  // Dias do período, inclusive os vazios (o gráfico mostra o buraco).
  const days = new Map<string, { seconds: number; people: Set<string> }>();
  for (let t = dayStart(range.from); t < range.to; t += DAY_MS) {
    days.set(dayKey(t), { seconds: 0, people: new Set() });
  }

  const people = new Map<string, PersonStat & { days: Set<string> }>();
  const zones = new Map<string, { seconds: number; people: Set<string> }>();
  let messages = 0;
  let talkSeconds = 0;
  const edges: [t: number, delta: 1 | -1, userId: string][] = [];
  const intervals = new Map<string, [number, number][]>();

  for (const v of visits) {
    const start = Math.max(v.startedAt, range.from);
    const end = Math.min(v.endedAt, range.to);
    if (end <= start) continue;

    let person = people.get(v.userId);
    if (!person) {
      person = { userId: v.userId, seconds: 0, activeDays: 0, talkSeconds: 0, messages: 0, lastSeen: 0, days: new Set() };
      people.set(v.userId, person);
      intervals.set(v.userId, []);
    }
    person.lastSeen = Math.max(person.lastSeen, end);
    edges.push([start, 1, v.userId], [end, -1, v.userId]);
    intervals.get(v.userId)!.push([start, end]);

    if (v.startedAt >= range.from && v.startedAt < range.to) {
      person.messages += v.messages;
      person.talkSeconds += v.talkSeconds;
      messages += v.messages;
      talkSeconds += v.talkSeconds;
      for (const [zoneId, s] of Object.entries(v.zones)) {
        let z = zones.get(zoneId);
        if (!z) zones.set(zoneId, (z = { seconds: 0, people: new Set() }));
        z.seconds += s;
        z.people.add(v.userId);
      }
    }
  }

  // Tempo de presença: intervalos de cada pessoa unidos e cortados por dia.
  for (const [userId, list] of intervals) {
    const person = people.get(userId)!;
    for (const [start, end] of mergeIntervals(list)) {
      for (let a = start; a < end; ) {
        const b = Math.min(end, dayStart(a) + DAY_MS);
        const key = dayKey(a);
        const s = (b - a) / 1000;
        const day = days.get(key);
        if (day) {
          day.seconds += s;
          day.people.add(userId);
        }
        person.seconds += s;
        person.days.add(key);
        a = b;
      }
    }
  }

  // Pico: varre entradas/saídas em ordem; saídas antes de entradas no mesmo
  // instante (quem sai e outro entra não "se encontram").
  edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const open = new Map<string, number>();
  const peak = { people: 0, at: null as number | null };
  for (const [t, delta, user] of edges) {
    const n = (open.get(user) ?? 0) + delta;
    if (n > 0) open.set(user, n);
    else open.delete(user);
    if (open.size > peak.people) {
      peak.people = open.size;
      peak.at = t;
    }
  }

  const peopleList = [...people.values()]
    .map(({ days: d, ...p }) => ({ ...p, seconds: Math.round(p.seconds), activeDays: d.size }))
    .sort((a, b) => b.seconds - a.seconds);

  return {
    totalSeconds: Math.round(peopleList.reduce((sum, p) => sum + p.seconds, 0)),
    activePeople: peopleList.length,
    messages,
    talkSeconds,
    peak,
    days: [...days].map(([day, d]) => ({ day, seconds: Math.round(d.seconds), people: d.people.size })),
    people: peopleList,
    zones: [...zones]
      .map(([zoneId, z]) => ({ zoneId, seconds: z.seconds, people: z.people.size }))
      .sort((a, b) => b.seconds - a.seconds),
  };
}

function mergeIntervals(list: [number, number][]): [number, number][] {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** "3h 25min", "12min", "40s". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
