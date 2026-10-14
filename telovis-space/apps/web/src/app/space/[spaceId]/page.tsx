import Link from "next/link";
import SpaceClient from "@/components/space/SpaceClient";
import { requireUser } from "@/lib/auth/session";
import { getSpaceAccess } from "@/lib/space/access";
import { listClaimedDesks } from "@/lib/space/desks";
import { DEMO_SLUG } from "@/lib/space/spaces";

export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const user = await requireUser(`/space/${spaceId}`);

  // Mesma resposta para "não existe" e "sem vínculo": não revela quais
  // spaces existem para quem não é membro.
  const access = await getSpaceAccess(spaceId, user.id);
  if (!access) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Sem acesso</h1>
          <p className="mt-2 text-slate-400">
            Este escritório não existe ou você ainda não foi convidado.
          </p>
          <Link href="/" className="mt-6 inline-block text-emerald-400 underline">
            Voltar
          </Link>
        </div>
      </main>
    );
  }

  const { space, role } = access;
  const isDemo = space.slug === DEMO_SLUG;
  const desks = isDemo ? [] : await listClaimedDesks(space.slug);
  // Mesmas regras de desk-actions.ts (que é quem decide de verdade).
  const deskBlockedReason = isDemo
    ? "O escritório demo é compartilhado: mesas fixas só nos escritórios da equipe."
    : role === "GUEST"
      ? "Convidados não têm mesa fixa."
      : null;

  return (
    <SpaceClient
      spaceId={space.slug}
      spaceName={space.name}
      mapJsonUrl={space.mapJsonUrl}
      tilesetUrl={space.tilesetUrl}
      userId={user.id}
      playerName={user.name}
      avatar={user.avatar}
      desks={desks}
      deskBlockedReason={deskBlockedReason}
    />
  );
}
