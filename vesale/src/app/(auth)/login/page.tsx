import { login } from "@/server/actions/auth";
import { PharmacyCross } from "@/components/shared/PharmacyCross";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; erro?: string }>;
}) {
  const { callbackUrl, erro } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-vesale-bg px-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <PharmacyCross size={44} className="mb-3" />
        <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-vesale-muted">
          Drogaria
        </span>
        <span className="-mt-1 block text-4xl font-black tracking-tight text-vesale-navy">
          VESALE
        </span>
        <p className="mt-2 text-sm text-vesale-muted">Sistema de gestão</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-vesale-border bg-vesale-surface p-8 shadow-sm">
        <h2 className="mb-6 text-center text-lg font-semibold text-vesale-ink">
          Acesso ao sistema
        </h2>

        <form action={login} className="flex flex-col gap-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/pdv"} />

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
              E-mail
            </label>
            <input
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="voce@vesale.local"
              className="w-full rounded-lg border border-vesale-border px-3 py-2 text-vesale-ink outline-none focus:border-vesale-navy"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
              Senha
            </label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-vesale-border px-3 py-2 text-vesale-ink outline-none focus:border-vesale-navy"
            />
          </div>

          {erro && (
            <p className="rounded-lg border border-vesale-red/30 bg-vesale-red/5 px-3 py-2 text-center text-xs text-vesale-red">
              E-mail ou senha inválidos.
            </p>
          )}

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-vesale-navy py-2.5 font-medium text-white transition hover:bg-vesale-navy-dark"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
