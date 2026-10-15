import Link from "next/link";
import AddMemberForm from "@/components/dashboard/AddMemberForm";
import InviteActions from "@/components/dashboard/InviteActions";
import { ROLE_LABEL } from "@/components/dashboard/ui";
import MemberActions from "@/components/dashboard/MemberActions";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { parseRole } from "@/lib/space/access";
import { getAdminSpace } from "@/lib/space/admin";
import { adminReleaseDesk } from "../actions";

export default async function ManageSpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/dashboard/${slug}`);
  const space = await getAdminSpace(slug, user.id);

  if (!space) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Sem acesso</h1>
          <p className="mt-2 text-slate-400">Só administradores do escritório podem gerenciá-lo.</p>
          <Link href="/dashboard" className="mt-6 inline-block text-emerald-400 underline">
            Voltar ao dashboard
          </Link>
        </div>
      </main>
    );
  }

  const [owner, members, desks, invites] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: space.ownerId },
      select: { name: true, email: true },
    }),
    prisma.spaceMember.findMany({
      where: { spaceId: space.id },
      select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.desk.findMany({
      where: { spaceId: space.id },
      select: { key: true, user: { select: { name: true } } },
      orderBy: { key: "asc" },
    }),
    prisma.invite.findMany({
      where: { spaceId: space.id },
      select: { id: true, email: true, role: true, expiresAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const now = Date.now();

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-8">
      <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200">
        ← Dashboard
      </Link>
      <header className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{space.name}</h1>
          <p className="text-sm text-slate-500">/space/{space.slug}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/${space.slug}/metricas`}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500"
          >
            Métricas
          </Link>
          <Link
            href={`/space/${space.slug}`}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-emerald-400"
          >
            Entrar
          </Link>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Adicionar pessoa</h2>
        <p className="mb-3 mt-1 text-sm text-slate-400">
          Quem já tem conta entra na hora. Quem não tem recebe um convite por e-mail
          (válido por 7 dias) e entra ao criar a conta pelo link.
        </p>
        <AddMemberForm slug={space.slug} />
      </section>

      {invites.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">
            Convites pendentes <span className="text-sm font-normal text-slate-500">({invites.length})</span>
          </h2>
          <ul className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800">
            {invites.map((inv) => {
              const expired = inv.expiresAt.getTime() <= now;
              return (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{inv.email}</p>
                    <p className={`text-xs ${expired ? "text-red-400" : "text-slate-500"}`}>
                      {ROLE_LABEL[parseRole(inv.role) ?? "MEMBER"]} ·{" "}
                      {expired
                        ? "expirado — reenvie para gerar um link novo"
                        : `expira em ${inv.expiresAt.toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <InviteActions slug={space.slug} inviteId={inv.id} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Membros <span className="text-sm font-normal text-slate-500">({members.length + 1})</span>
        </h2>
        <ul className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800">
          <li className="flex flex-wrap items-center justify-between gap-3 p-4">
            <Person name={owner.name} email={owner.email} self={space.ownerId === user.id} />
            <span className="text-sm text-slate-400">Dono</span>
          </li>
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Person name={m.user.name} email={m.user.email} self={m.user.id === user.id} />
              <MemberActions
                slug={space.slug}
                memberId={m.id}
                memberName={m.user.name}
                role={parseRole(m.role) ?? "GUEST"}
                isSelf={m.user.id === user.id}
              />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Quem for removido sai do escritório na hora e a mesa dele fica livre.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Mesas ocupadas <span className="text-sm font-normal text-slate-500">({desks.length})</span>
        </h2>
        {desks.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            Ninguém pegou mesa ainda. No escritório, chegue perto de uma mesa livre e aperte E.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800">
            {desks.map((d) => (
              <li key={d.key} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="font-mono text-slate-400">{d.key}</span> · {d.user.name}
                </span>
                <form action={adminReleaseDesk}>
                  <input type="hidden" name="slug" value={space.slug} />
                  <input type="hidden" name="deskKey" value={d.key} />
                  <button type="submit" className="rounded-lg px-2 py-1 text-red-400 hover:bg-red-500/10">
                    Liberar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Person({ name, email, self }: { name: string; email: string; self: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">
        {name} {self && <span className="text-xs text-slate-500">(você)</span>}
      </p>
      <p className="truncate text-xs text-slate-500">{email}</p>
    </div>
  );
}
