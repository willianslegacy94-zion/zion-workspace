import { AccessToken } from "livekit-server-sdk";
import { livekitRoomName, type LivekitCredentials } from "@telovis/protocol";

/**
 * Gera o token LiveKit dentro do próprio `room:join`, com identity = socket.id.
 * Assim o id que liga avatar ↔ participante de mídia é definido pelo servidor,
 * não pelo cliente.
 */
export async function createLivekitCredentials(
  identity: string,
  name: string,
  spaceId: string,
): Promise<LivekitCredentials | null> {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return null;

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: "4h",
  });
  token.addGrant({
    room: livekitRoomName(spaceId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return { url: LIVEKIT_URL, token: await token.toJwt() };
}
