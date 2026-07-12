import { redirect } from "next/navigation";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

async function login(formData: FormData) {
  "use server";

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") || "/alunos");

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(
        `/login?callbackUrl=${encodeURIComponent(callbackUrl)}&erro=1`,
      );
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; erro?: string }>;
}) {
  const { callbackUrl, erro } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Topo ornamental */}
      <div className="mb-8 text-center animate-fade-in">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border border-secondary/50 bg-primary/10">
          <Dumbbell size={24} strokeWidth={1.5} className="text-primary" />
        </div>

        <div className="gold-divider mx-auto mb-1 w-48">
          <span className="text-xs uppercase tracking-[0.35em] text-secondary">
            Academia
          </span>
        </div>

        <h1 className="font-serif text-4xl font-black leading-none tracking-widest text-gold-shimmer">
          Prof. Sandro
        </h1>

        <span className="mt-3 inline-block text-[10px] uppercase tracking-[0.3em] text-foreground/40">
          Sistema de Gestão
        </span>
      </div>

      {/* Card de login */}
      <div className="card-premium w-full max-w-sm animate-slide-up p-8">
        <h2 className="mb-1 text-center font-serif text-lg font-bold text-primary">
          Acesso ao Sistema
        </h2>
        <div className="mb-6 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />

        <form action={login} className="flex flex-col gap-4">
          <input
            type="hidden"
            name="callbackUrl"
            value={callbackUrl ?? "/alunos"}
          />

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
              Usuário
            </label>
            <input
              name="username"
              required
              autoFocus
              autoComplete="username"
              placeholder="Digite seu usuário"
              className="input-dark w-full"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
              Senha
            </label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="input-dark w-full"
            />
          </div>

          {erro && (
            <p className="rounded-lg border border-error/30 bg-error/10 py-2 px-3 text-center text-xs text-error animate-fade-in">
              Usuário ou senha inválidos.
            </p>
          )}

          <button type="submit" className="btn-gold mt-2 w-full">
            <span aria-hidden="true">🥊</span>
            Entrar
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link
            href="/esqueci-senha"
            className="text-xs text-foreground/40 transition-colors hover:text-foreground/70"
          >
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  );
}
