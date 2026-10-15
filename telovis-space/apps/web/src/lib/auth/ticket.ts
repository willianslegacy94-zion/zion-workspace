import "server-only";
import { SignJWT } from "jose";
import { REALTIME_TICKET_AUDIENCE, type RealtimeTicketClaims } from "@telovis/protocol";

// Vida curta: o ticket só serve para o handshake. A cada (re)conexão o
// cliente busca um novo, e aí sessão e vínculo são conferidos de novo.
const TICKET_TTL = "60s";

function secret(): Uint8Array {
  const value = process.env.REALTIME_TICKET_SECRET;
  if (!value || value.length < 32) {
    throw new Error("REALTIME_TICKET_SECRET ausente ou curto (mínimo 32 caracteres)");
  }
  return new TextEncoder().encode(value);
}

export async function signRealtimeTicket(claims: RealtimeTicketClaims): Promise<string> {
  const { sub, ...rest } = claims;
  return new SignJWT({ ...rest })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setAudience(REALTIME_TICKET_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TICKET_TTL)
    .sign(secret());
}
