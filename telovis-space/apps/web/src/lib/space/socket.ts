import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@telovis/protocol";

export type SpaceSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Mensagem de `connect_error` quando o servidor recusa o ticket. */
export const UNAUTHORIZED = "não autorizado";

async function fetchTicket(spaceId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`/api/realtime-ticket?space=${encodeURIComponent(spaceId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { token?: string };
    return body.token;
  } catch {
    return undefined;
  }
}

export function createSpaceSocket(spaceId: string): SpaceSocket {
  const url = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4000";
  // Só websocket: o polling HTTP do Socket.io atrapalha sticky sessions atrás
  // de proxy/Cloudflare e não traz ganho para um app que exige WebRTC.
  return io(url, {
    transports: ["websocket"],
    autoConnect: true,
    // Chamado a cada tentativa de conexão: o ticket dura 60s, então cada
    // reconexão busca um novo (e a sessão é conferida de novo no Next).
    // Sem ticket, o servidor recusa com UNAUTHORIZED.
    auth: (cb) => {
      void fetchTicket(spaceId).then((token) => cb({ token }));
    },
  });
}
