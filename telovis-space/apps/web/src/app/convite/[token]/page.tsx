import Link from "next/link";
import { logout } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { findInvite } from "@/lib/space/invites";
import { acceptInvite } from "../actions";

const primary =
  "inline-block rounded-lg bg-emerald-500 px-4 py-2 font-medium text-black hover:bg-emerald-400";
const secondary = "inline-block rounded-lg border border-slate-700 px-4 py-2 hover:border-slate-500";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([findInvite(token), getCurrentUser()]);
  const here = `/convite/${encodeURIComponent(token)}`;

  if (!invite) {
    return (
      <Shell title="Convite inválido">
        <p className="text-slate-400">
          Este link expirou, já foi usado ou foi cancelado. Peça um convite novo a quem administra o
          escritório.
        </p>
        <Link href="/" className="mt-6 inline-block text-emerald-400 underline">
          Ir para o início
        </Link>
      </Shell>
    );
  }

  const intro = (
    <p className="text-slate-300">
      <strong>{invite.invitedBy.name}</strong> convidou <strong>{invite.email}</strong> para o
      escritório <strong>{invite.space.name}</strong>.
    </p>
  );

  if (!user) {
    const next = encodeURIComponent(here);
    const email = encodeURIComponent(invite.email);
    return (
      <Shell title="Você foi convidado">
        {intro}
        <p className="mt-2 text-sm text-slate-400">Crie sua conta com este e-mail para entrar.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/signup?next=${next}&email=${email}`} className={primary}>
            Criar conta
          </Link>
          <Link href={`/login?next=${next}&email=${email}`} className={secondary}>
            Já tenho conta
          </Link>
        </div>
      </Shell>
    );
  }

  if (user.email !== invite.email) {
    return (
      <Shell title="Convite para outra conta">
        {intro}
        <p className="mt-2 text-sm text-slate-400">
          Você está entrando como <strong>{user.email}</strong>. Saia e entre (ou crie a conta) com{" "}
          {invite.email} para aceitar.
        </p>
        <form action={logout} className="mt-6">
          <input type="hidden" name="next" value={here} />
          <button type="submit" className={secondary}>
            Sair desta conta
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Você foi convidado">
      {intro}
      <form action={acceptInvite} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className={primary}>
          Aceitar e entrar no escritório
        </button>
      </form>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-md">
        <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
