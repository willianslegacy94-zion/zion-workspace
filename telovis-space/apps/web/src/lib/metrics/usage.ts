import "server-only";
import { prisma } from "@/lib/prisma";
import { loadMapJson } from "@/lib/space/desks";
import { summarize, type UsageSummary } from "./summarize";

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

/** Fuso dos "dias" das métricas. Padrão: Brasília (UTC-3, sem horário de verão). */
function tzOffsetMinutes(): number {
  const v = Number(process.env.METRICS_TZ_OFFSET_MINUTES ?? -180);
  return Number.isFinite(v) ? v : -180;
}

export interface SpaceUsage extends UsageSummary {
  from: number;
  to: number;
  names: Map<string, string>;
  zoneNames: Map<string, string>;
}

/** Métricas dos últimos `days` dias (contando hoje) do space. */
export async function getSpaceUsage(
  space: { id: string; mapJsonUrl: string },
  days: Period,
): Promise<SpaceUsage> {
  const DAY = 24 * 60 * 60 * 1000;
  const off = tzOffsetMinutes() * 60_000;
  const to = Date.now();
  // Começo do dia (no fuso) de `days - 1` dias atrás.
  const todayStart = Math.floor((to + off) / DAY) * DAY - off;
  const from = todayStart - (days - 1) * DAY;

  const [rows, zoneNames] = await Promise.all([
    prisma.visit.findMany({
      where: { spaceId: space.id, startedAt: { lt: new Date(to) }, endedAt: { gt: new Date(from) } },
      select: {
        userId: true,
        startedAt: true,
        endedAt: true,
        messages: true,
        talkSeconds: true,
        zones: true,
        user: { select: { name: true } },
      },
    }),
    getZoneNames(space.mapJsonUrl).catch(() => new Map<string, string>()),
  ]);

  const summary = summarize(
    rows.map((r) => ({
      userId: r.userId,
      startedAt: r.startedAt.getTime(),
      endedAt: r.endedAt.getTime(),
      messages: r.messages,
      talkSeconds: r.talkSeconds,
      zones: (r.zones ?? {}) as Record<string, number>,
    })),
    { from, to },
    tzOffsetMinutes(),
  );
  return {
    ...summary,
    from,
    to,
    names: new Map(rows.map((r) => [r.userId, r.user.name])),
    zoneNames,
  };
}

/** zoneId → nome exibido, da camada `zones` do mapa. */
async function getZoneNames(mapJsonUrl: string): Promise<Map<string, string>> {
  type Obj = { name?: string; properties?: { name: string; value: unknown }[] };
  const map = (await loadMapJson(mapJsonUrl)) as { layers?: { name?: string; objects?: Obj[] }[] };
  const objects = map.layers?.find((l) => l.name === "zones")?.objects ?? [];
  const names = new Map<string, string>();
  for (const o of objects) {
    const prop = o.properties?.find((p) => p.name === "zoneId")?.value;
    const id = typeof prop === "string" && prop ? prop : o.name;
    if (id) names.set(id, o.name || id);
  }
  return names;
}
