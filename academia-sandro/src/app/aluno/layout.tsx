import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AlunoShell } from "@/components/AlunoShell";

export default async function AlunoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const alunoId = session?.user?.alunoId;
  if (!alunoId) {
    redirect("/login");
  }

  const aluno = await prisma.aluno.findUnique({
    where: { id: alunoId },
    select: { nome: true },
  });
  if (!aluno) {
    redirect("/login");
  }

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <AlunoShell nome={aluno.nome} logoutAction={logout}>
      {children}
    </AlunoShell>
  );
}
