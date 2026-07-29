import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAlertas } from "@/lib/alertas";
import { AppShell } from "@/components/AppShell";
import { marcarAlertasComoLidos } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const [preCadastrosPendentes, matriculasPendentes, usuario] =
    await Promise.all([
      prisma.preCadastro.count({ where: { status: "Pendente" } }),
      prisma.matricula.count({
        where: { transacao: { comprovanteUrl: { not: null }, confirmadoEm: null } },
      }),
      session?.user?.id
        ? prisma.usuario.findUnique({
            where: { id: session.user.id },
            select: { alertasLidosEm: true },
          })
        : Promise.resolve(null),
    ]);

  const alertas = await getAlertas(usuario?.alertasLidosEm ?? null);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <AppShell
      username={session?.user?.username}
      nome={session?.user?.nome}
      logoutAction={logout}
      alertas={alertas}
      marcarAlertasComoLidos={marcarAlertasComoLidos}
      preCadastrosPendentes={preCadastrosPendentes}
      matriculasPendentes={matriculasPendentes}
    >
      {children}
    </AppShell>
  );
}
