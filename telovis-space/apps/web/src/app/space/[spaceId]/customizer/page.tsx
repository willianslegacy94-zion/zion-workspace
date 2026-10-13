import AvatarCustomizer from "@/components/avatar/AvatarCustomizer";
import { requireUser } from "@/lib/auth/session";
import { getSpaceAccess } from "@/lib/space/access";

// Editor de avatar (spec, seção 4). O visual é da pessoa, não do space: vale
// em todos os escritórios. A rota fica sob o space só para "voltar" ao lugar
// certo.
export default async function CustomizerPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const user = await requireUser(`/space/${spaceId}/customizer`);
  // Sem acesso ao space, volta para o início em vez de para um space fechado.
  const access = await getSpaceAccess(spaceId, user.id);
  const backHref = access ? `/space/${access.space.slug}` : "/";

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Seu avatar</h1>
      <p className="mb-8 mt-1 text-sm text-slate-400">
        Vale em todos os escritórios. Quem estiver na sala vê o visual novo quando você voltar.
      </p>
      <AvatarCustomizer initial={user.avatar} name={user.name} backHref={backHref} />
    </main>
  );
}
