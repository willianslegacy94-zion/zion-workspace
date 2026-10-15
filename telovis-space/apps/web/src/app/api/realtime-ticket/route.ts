import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { signRealtimeTicket } from "@/lib/auth/ticket";
import { getSpaceAccess } from "@/lib/space/access";

// GET /api/realtime-ticket?space=<slug>
// O cliente chama a cada (re)conexão do Socket.io e manda o token no
// handshake. É aqui que sessão e vínculo SpaceMember são conferidos.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "sessão expirada" }, { status: 401 });

  const slug = request.nextUrl.searchParams.get("space") ?? "";
  const access = await getSpaceAccess(slug, user.id);
  if (!access) return Response.json({ error: "sem acesso a este space" }, { status: 403 });

  const token = await signRealtimeTicket({
    sub: user.id,
    name: user.name,
    space: access.space.slug,
    role: access.role,
    avatar: user.avatar,
  });
  return Response.json({ token }, { headers: { "cache-control": "no-store" } });
}
