import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { diasParaVencer } from "@/lib/vencimento";
import { AppShell } from "@/components/AppShell";
import type { AlertaVencimento } from "@/components/NotificacaoSino";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const [alunosVencendo, preCadastrosPendentes] = await Promise.all([
    prisma.aluno.findMany({
      where: { dataVencimento: { not: null } },
      select: { id: true, nome: true, telefone: true, dataVencimento: true },
    }),
    prisma.preCadastro.count({ where: { status: "Pendente" } }),
  ]);

  const vencimentos: AlertaVencimento[] = alunosVencendo
    .map((a) => ({
      id: a.id,
      nome: a.nome,
      telefone: a.telefone,
      dias: diasParaVencer(a.dataVencimento as Date),
    }))
    .filter((a) => a.dias <= 3)
    .sort((a, b) => a.dias - b.dias);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <AppShell
      username={session?.user?.username}
      logoutAction={logout}
      vencimentos={vencimentos}
      preCadastrosPendentes={preCadastrosPendentes}
    >
      {children}
    </AppShell>
  );
}
