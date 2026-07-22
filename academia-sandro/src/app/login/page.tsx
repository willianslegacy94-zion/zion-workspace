import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
        <div className="mb-6 flex flex-col items-center gap-5 sm:gap-6">
          <Image
            src="/logos/sandro-freire-personal.png"
            alt="Sandro Freire Personal"
            width={212}
            height={160}
            preload
            className="h-16 w-auto object-contain drop-shadow-[0_4px_14px_rgba(212,175,55,0.25)] transition-transform duration-300 hover:scale-105 sm:h-20 md:h-24"
          />
          <div className="flex items-center justify-center gap-6 sm:gap-8 md:gap-10">
            <Image
              src="/logos/capoeira-senzala.png"
              alt="Capoeira Senzala"
              width={140}
              height={140}
              preload
              className="h-14 w-auto object-contain drop-shadow-[0_4px_14px_rgba(212,175,55,0.2)] transition-transform duration-300 hover:scale-105 sm:h-16 md:h-20"
            />
            <Image
              src="/logos/matos-fight-team.png"
              alt="Matos Fight Team"
              width={140}
              height={140}
              preload
              className="h-14 w-auto object-contain drop-shadow-[0_4px_14px_rgba(212,175,55,0.2)] transition-transform duration-300 hover:scale-105 sm:h-16 md:h-20"
            />
          </div>
        </div>

        <h1 className="font-serif text-3xl font-black leading-tight tracking-wide text-gold-shimmer sm:text-4xl">
          Centro de Treinamento Sandro Ferreira
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
