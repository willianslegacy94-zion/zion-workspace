import { jwtVerify } from "jose";
import { MAX_VISITS_PER_BATCH, parseVisitReport, REALTIME_USAGE_AUDIENCE } from "@telovis/protocol";
import { prisma } from "@/lib/prisma";

// Recebe do realtime as visitas encerradas (métricas de uso). Só o realtime
// tem o segredo, então só ele assina estes pedidos (audiência própria: um
// ticket de usuário ou o token Next → realtime não servem aqui).

const MAX_BODY_BYTES = 256 * 1024;

async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.REALTIME_TICKET_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || !token) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      audience: REALTIME_USAGE_AUDIENCE,
    });
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!(await authorized(req))) return new Response(null, { status: 401 });

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const list = (raw as { visits?: unknown })?.visits;
  if (!Array.isArray(list) || list.length > MAX_VISITS_PER_BATCH) return new Response(null, { status: 400 });
  const visits = list.map(parseVisitReport);
  if (visits.some((v) => v === null)) return new Response(null, { status: 400 });
  const valid = visits.filter((v) => v !== null);

  // Space apagado ou usuário removido no meio tempo: a visita é ignorada.
  const [spaces, users] = await Promise.all([
    prisma.space.findMany({
      where: { slug: { in: [...new Set(valid.map((v) => v.space))] } },
      select: { id: true, slug: true },
    }),
    prisma.user.findMany({
      where: { id: { in: [...new Set(valid.map((v) => v.userId))] } },
      select: { id: true },
    }),
  ]);
  const spaceId = new Map(spaces.map((s) => [s.slug, s.id]));
  const userIds = new Set(users.map((u) => u.id));

  const data = valid.flatMap((v) => {
    const sid = spaceId.get(v.space);
    if (!sid || !userIds.has(v.userId)) return [];
    return [
      {
        spaceId: sid,
        userId: v.userId,
        startedAt: new Date(v.startedAt),
        endedAt: new Date(v.endedAt),
        messages: v.messages,
        talkSeconds: v.talkSeconds,
        zones: v.zones,
      },
    ];
  });
  if (data.length) await prisma.visit.createMany({ data });
  return Response.json({ saved: data.length });
}
