import { jwtVerify } from "jose";
import {
  parseAvatarLook,
  REALTIME_TICKET_AUDIENCE,
  SPACE_ID_PATTERN,
  type RealtimeTicketClaims,
  type SpaceRole,
} from "@telovis/protocol";

const ROLES: readonly SpaceRole[] = ["ADMIN", "MEMBER", "GUEST"];

/** Lê o segredo uma vez no boot; sem ele o servidor não sobe. */
export function loadTicketSecret(): Uint8Array {
  const secret = process.env.REALTIME_TICKET_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("REALTIME_TICKET_SECRET ausente ou curto (mínimo 32 caracteres)");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Valida o ticket emitido pelo Next. A checagem de sessão e de SpaceMember já
 * aconteceu lá, ao emitir; aqui só conferimos assinatura, validade e formato.
 * Assim o realtime não precisa de acesso ao banco.
 */
export async function verifyTicket(
  token: unknown,
  secret: Uint8Array,
): Promise<RealtimeTicketClaims | null> {
  if (typeof token !== "string" || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      audience: REALTIME_TICKET_AUDIENCE,
    });
    const { sub, name, space, role, avatar } = payload as Record<string, unknown>;
    if (typeof sub !== "string" || !sub) return null;
    if (typeof name !== "string" || !name.trim()) return null;
    if (typeof space !== "string" || !SPACE_ID_PATTERN.test(space)) return null;
    if (!ROLES.includes(role as SpaceRole)) return null;
    const look = parseAvatarLook(avatar);
    if (!look) return null;
    return { sub, name: name.trim().slice(0, 32), space, role: role as SpaceRole, avatar: look };
  } catch {
    return null;
  }
}
