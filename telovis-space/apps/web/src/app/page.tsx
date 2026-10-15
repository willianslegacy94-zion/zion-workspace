import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserSpaces } from "@/lib/space/access";
import { DEMO_SLUG } from "@/lib/space/spaces";
import { logout } from "./actions";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold">TeloVis Space</h1>
        <p className="mt-2 text-slate-400">
          Escritório virtual 2D com áudio e vídeo por proximidade.
        </p>
        {user ? <SpacePicker userId={user.id} name={user.name} /> : <Anonymous />}
      </div>
    </main>
  );
}

function Anonymous() {
  return (
    <div className="mt-8 flex flex-col gap-3">
      <Link
        href="/login"
        className="rounded-lg bg-emerald-500 px-3 py-2 text-center font-medium text-black hover:bg-emerald-400"
      >
        Entrar
      </Link>
      <Link
        href="/signup"
        className="rounded-lg border border-slate-700 px-3 py-2 text-center hover:border-slate-500"
      >
        Criar conta
      </Link>
    </div>
  );
}

async function SpacePicker({ userId, name }: { userId: string; name: string }) {
  const spaces = await listUserSpaces(userId);

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-300">
        Olá, <span className="font-semibold">{name}</span>. Escolha um escritório:
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {spaces.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/space/${s.slug}`}
              className="block rounded-lg bg-emerald-500 px-3 py-2 font-medium text-black hover:bg-emerald-400"
            >
              {s.name}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href={`/space/${DEMO_SLUG}`}
            className="block rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500"
          >
            Escritório demo (aberto a todos)
          </Link>
        </li>
      </ul>
      <div className="mt-6 flex items-center gap-4 text-sm">
        <Link href="/dashboard" className="text-emerald-400 hover:underline">
          Dashboard
        </Link>
        <form action={logout}>
          <button type="submit" className="text-slate-400 hover:text-slate-200">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
