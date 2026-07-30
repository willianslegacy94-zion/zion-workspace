import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMeusHorarios } from "@/lib/agenda";
import { getBloqueiosProximos } from "@/lib/bloqueios-agenda";
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

  const [linhas, bloqueios] = await Promise.all([
    getMeusHorarios(alunoId),
    getBloqueiosProximos(14),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={CalendarClock}
        title={`Olá, ${aluno.nome.split(" ")[0]}`}
        subtitle={`${aluno.modalidade} · ${aluno.graduacaoFaixa} — seus horários de aula`}
      />

      {bloqueios.length > 0 && (
        <div className="flex flex-col gap-2">
          {bloqueios.map((bloqueio) => (
            <div
              key={bloqueio.id}
              className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
            >
              Atenção: não haverá aula no dia <strong>{bloqueio.dataFormatada}</strong>{" "}
              ({bloqueio.horaInicio}–{bloqueio.horaFim})
              {bloqueio.motivo && ` — ${bloqueio.motivo}`}.
            </div>
          ))}
        </div>
      )}

      <AgendaGrid linhas={linhas} />
    </div>
  );
}
