import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMeusHorarios } from "@/lib/agenda";
import { AgendaGrid } from "@/components/AgendaGrid";
import { PageHeader } from "@/components/PageHeader";

export default async function AreaDoAlunoInicioPage() {
  const session = await auth();
  const alunoId = session?.user?.alunoId;

  if (!alunoId) {
    redirect("/login");
  }

  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno) {
    redirect("/login");
  }

  const linhas = await getMeusHorarios(alunoId);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={CalendarClock}
        title={`Olá, ${aluno.nome.split(" ")[0]}`}
        subtitle={`${aluno.modalidade} · ${aluno.graduacaoFaixa} — seus horários de aula`}
      />

      <AgendaGrid linhas={linhas} />
    </div>
  );
}
