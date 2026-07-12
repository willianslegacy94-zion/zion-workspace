import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  RecuperacaoSenhaError,
  solicitarRecuperacao,
} from "@/lib/recuperacao-senha";

async function esqueciSenha(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const hdrs = await headers();
  const origin = `${hdrs.get("x-forwarded-proto") ?? "http"}://${hdrs.get("host")}`;

  let target: string;
  try {
    const resultado = await solicitarRecuperacao(email, origin);
    target = `/esqueci-senha?link=${encodeURIComponent(resultado.link)}&aviso=${encodeURIComponent(resultado.aviso)}`;
  } catch (error) {
    if (error instanceof RecuperacaoSenhaError) {
      target = `/esqueci-senha?erro=${encodeURIComponent(error.message)}`;
    } else {
      throw error;
    }
  }

  redirect(target);
}

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string; aviso?: string; erro?: string }>;
}) {
  const { link, aviso, erro } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="card-premium w-full max-w-sm animate-slide-up p-8">
        <h1 className="mb-1 text-center font-serif text-lg font-bold text-primary">
          Esqueci minha senha
        </h1>
        <div className="mb-6 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />

        <form action={esqueciSenha} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
              E-mail cadastrado
            </label>
            <input
              name="email"
              type="email"
              required
              autoFocus
              placeholder="seu@email.com"
              className="input-dark w-full"
            />
          </div>

          {erro && (
            <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-xs text-error animate-fade-in">
              {erro}
            </p>
          )}

          <button type="submit" className="btn-gold mt-2 w-full">
            Solicitar link de redefinição
          </button>
        </form>

        {link && (
          <div className="mt-5 flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm animate-fade-in">
            <p className="font-medium text-foreground">
              Link gerado — envie manualmente para o usuário:
            </p>
            <p className="break-all text-primary">{link}</p>
            {aviso && <p className="text-foreground/60">{aviso}</p>}
          </div>
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
