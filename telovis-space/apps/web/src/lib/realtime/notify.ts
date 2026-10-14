import "server-only";
import { SignJWT } from "jose";
import { REALTIME_INTERNAL_AUDIENCE, type RealtimeInternalEvent } from "@telovis/protocol";

const TIMEOUT_MS = 2_000;

/**
 * Avisa o realtime de uma mudança já gravada no banco, para valer na hora
 * para quem está conectado. Melhor esforço: se o realtime estiver fora do ar,
 * só registra — o ticket de 60s já barra a próxima (re)conexão, e o visual
 * novo chega no próximo join.
 */
export async function notifyRealtime(event: RealtimeInternalEvent): Promise<void> {
  const secret = process.env.REALTIME_TICKET_SECRET;
  const base = process.env.REALTIME_INTERNAL_URL ?? "http://localhost:4000";
  if (!secret) return;

  try {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setAudience(REALTIME_INTERNAL_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("30s")
      .sign(new TextEncoder().encode(secret));
    const res = await fetch(`${base}/internal/events`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) console.error(`[realtime] evento ${event.type} recusado: HTTP ${res.status}`);
  } catch (err) {
    console.error(`[realtime] falha ao avisar ${event.type}`, err);
  }
}
