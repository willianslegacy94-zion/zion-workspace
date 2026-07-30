import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { atualizarPerfil } from "./actions";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
}) {
  const { sucesso, erro } = await searchParams;
  const session = await auth();

  const usuario = session?.user?.id
    ? await prisma.usuario.findUnique({
        where: { id: session.user.id },
        select: { nome: true, email: true, telefone: true, username: true },
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="mb-1 font-serif text-2xl font-bold text-primary">
        Configurações
      </h1>
      <p className="mb-6 text-sm text-foreground/50">
        Dados do seu perfil de administrador ({usuario?.username}).
      </p>

      <div className="card-premium p-8">
        <form action={atualizarPerfil} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
              Nome
            </label>
            <input
              name="nome"
              required
              defaultValue={usuario?.nome ?? ""}
              placeholder="Seu nome completo"
              className="input-dark w-full"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
              E-mail
            </label>
            <input
              name="email"
              type="email"
              required
              defaultValue={usuario?.email ?? ""}
              placeholder="seu@email.com"
              className="input-dark w-full"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
              Telefone
            </label>
            <input
              name="telefone"
              defaultValue={usuario?.telefone ?? ""}
              placeholder="(11) 91234-5678"
              className="input-dark w-full"
            />
          </div>

          {sucesso && (
            <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-center text-xs text-success animate-fade-in">
              Dados atualizados com sucesso.
            </p>
          )}

          {erro && (
            <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-xs text-error animate-fade-in">
              {erro}
            </p>
          )}

          <button type="submit" className="btn-gold mt-2 w-full">
            Salvar alterações
          </button>
        </form>
      </div>
    </div>
  );
}
