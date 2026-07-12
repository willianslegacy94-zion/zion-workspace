import { redirect } from "next/navigation";
import Link from "next/link";
import { RecuperacaoSenhaError, resetarSenha } from "@/lib/recuperacao-senha";

async function resetarSenhaAction(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");

  let target: string;
  try {
    await resetarSenha(token, novaSenha);
    target = `/resetar-senha?token=${encodeURIComponent(token)}&sucesso=1`;
  } catch (error) {
    if (error instanceof RecuperacaoSenhaError) {
      target = `/resetar-senha?token=${encodeURIComponent(token)}&erro=${encodeURIComponent(error.message)}`;
    } else {
      throw error;
    }
  }

  redirect(target);
}

export default async function ResetarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; erro?: string; sucesso?: string }>;
}) {
  const { token, erro, sucesso } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="card-premium w-full max-w-sm animate-slide-up p-8">
        <h1 className="mb-1 text-center font-serif text-lg font-bold text-primary">
          Redefinir senha
        </h1>
        <div className="mb-6 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />

        {sucesso ? (
          <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-center text-sm text-success animate-fade-in">
            Senha atualizada com sucesso. Você já pode fazer login com a nova
            senha.
          </p>
        ) : (
          <form action={resetarSenhaAction} className="flex flex-col gap-4">
            <input type="hidden" name="token" value={token ?? ""} />
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                Nova senha
              </label>
              <input
                name="novaSenha"
                type="password"
                minLength={6}
                required
                autoFocus
                placeholder="••••••••"
                className="input-dark w-full"
              />
            </div>

            {erro && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-xs text-error animate-fade-in">
                {erro}
              </p>
            )}

            {!token && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-center text-xs text-warning">
                Link inválido: nenhum token encontrado na URL.
              </p>
            )}

            <button type="submit" className="btn-gold mt-2 w-full">
              Redefinir senha
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <Link
            href="/login"
            className="text-xs text-foreground/40 transition-colors hover:text-foreground/70"
          >
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
