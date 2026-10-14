import type { IncomingMessage } from "node:http";
import { jwtVerify } from "jose";
import {
  DESK_KEY_PATTERN,
  parseAvatarLook,
  parseDeskSetup,
  type DeskState,
  REALTIME_INTERNAL_AUDIENCE,
  SPACE_ID_PATTERN,
  type RealtimeInternalEvent,
  type SpaceRole,
} from "@telovis/protocol";

// Canal Next → realtime para mudanças no banco que precisam valer para quem já
// está conectado. Só o Next tem o segredo, então só ele assina estes pedidos.

const MAX_BODY_BYTES = 16 * 1024;
const ROLES: readonly SpaceRole[] = ["ADMIN", "MEMBER", "GUEST"];

async function readBody(req: IncomingMessage): Promise<string | null> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function authorized(req: IncomingMessage, secret: Uint8Array): Promise<boolean> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;
  try {
    await jwtVerify(token, secret, { algorithms: ["HS256"], audience: REALTIME_INTERNAL_AUDIENCE });
    return true;
  } catch {
    return false;
  }
}

function parseDesk(raw: unknown): DeskState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.key !== "string" || !DESK_KEY_PATTERN.test(d.key)) return null;
  const setup = parseDeskSetup(d.setup);
  if (!setup) return null;
  if (d.owner === null) return { key: d.key, owner: null, setup };
  const o = d.owner as Record<string, unknown> | undefined;
  if (typeof o?.userId !== "string" || typeof o.name !== "string") return null;
  return { key: d.key, owner: { userId: o.userId, name: o.name.slice(0, 32) }, setup };
}

function parseEvent(raw: unknown): RealtimeInternalEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  const spaceOk = typeof e.space === "string" && SPACE_ID_PATTERN.test(e.space);

  if (e.type === "desk.updated") {
    const desk = parseDesk(e.desk);
    return spaceOk && desk ? { type: e.type, space: e.space as string, desk } : null;
  }

  if (typeof e.userId !== "string" || !e.userId) return null;
  switch (e.type) {
    case "member.removed":
      return spaceOk ? { type: e.type, userId: e.userId, space: e.space as string } : null;
    case "member.role":
      if (!spaceOk || !ROLES.includes(e.role as SpaceRole)) return null;
      return { type: e.type, userId: e.userId, space: e.space as string, role: e.role as SpaceRole };
    case "avatar.updated": {
      const avatar = parseAvatarLook(e.avatar);
      return avatar ? { type: e.type, userId: e.userId, avatar } : null;
    }
    default:
      return null;
  }
}

/**
 * Lê, autentica e valida um POST /internal/events. Devolve o status HTTP e,
 * se tudo certo, o evento para aplicar.
 */
export async function readInternalEvent(
  req: IncomingMessage,
  secret: Uint8Array,
): Promise<{ status: number; event?: RealtimeInternalEvent }> {
  if (!(await authorized(req, secret))) return { status: 401 };
  const body = await readBody(req);
  if (body === null) return { status: 413 };
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { status: 400 };
  }
  const event = parseEvent(json);
  return event ? { status: 202, event } : { status: 400 };
}
