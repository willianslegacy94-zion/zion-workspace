// Painel do gestor (spec, seção 4): criação de escritórios e membros.
// Métricas de uso ainda não existem (dependem de registrar presença).
import Link from "next/link";
import CreateSpaceForm from "@/components/dashboard/CreateSpaceForm";
import { ROLE_LABEL } from "@/components/dashboard/ui";
import { requireUser } from "@/lib/auth/session";
import { listUserSpaces } from "@/lib/space/access";
import { logout } from "../actions";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const spaces = await listUserSpaces(user.id);

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-slate-300 hover:text-white">
            Início
          </Link>
          <form action={logout}>
            <button type="submit" className="text-slate-400 hover:text-slate-200">
              Sair
            </button>
          </form>
        </nav>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Seus escritórios</h2>
        {spaces.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            Você ainda não participa de nenhum. Crie um abaixo ou peça um convite a um admin.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800">
            {spaces.map((s) => (
              <li key={s.slug} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    /space/{s.slug} · {s.isOwner ? "Dono" : ROLE_LABEL[s.role]}
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  {s.role === "ADMIN" && (
                    <Link
                      href={`/dashboard/${s.slug}`}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-slate-500"
                    >
                      Gerenciar
                    </Link>
                  )}
                  <Link
                    href={`/space/${s.slug}`}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 font-medium text-black hover:bg-emerald-400"
                  >
                    Entrar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 max-w-sm">
        <h2 className="text-lg font-semibold">Novo escritório</h2>
        <p className="mb-4 mt-1 text-sm text-slate-400">
          Usa o mapa padrão. Você vira o dono e pode convidar pessoas em seguida.
        </p>
        <CreateSpaceForm />
      </section>
    </main>
  );
}
