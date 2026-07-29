import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { auth } from "@/auth";
import { getAgendaParaMatricula } from "@/lib/agenda";
import { getPrecosModalidade } from "@/lib/precos";
import { MatriculaGrid } from "@/components/MatriculaGrid";
import { PageHeader } from "@/components/PageHeader";
import { matricularEmAula, cancelarMatricula } from "../actions";

export default async function MatriculaPage() {
  const session = await auth();
  const alunoId = session?.user?.alunoId;

  if (!alunoId) {
    redirect("/login");
  }

  const [linhas, precos] = await Promise.all([
    getAgendaParaMatricula(alunoId),
    getPrecosModalidade(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={ClipboardList}
        title="Matrícula"
        subtitle="Quer treinar outra modalidade? Veja os horários disponíveis e se matricule — cada horário tem limite de vagas."
      />

      <MatriculaGrid
        linhas={linhas}
        precos={precos}
        matricularAction={matricularEmAula}
        cancelarAction={cancelarMatricula}
      />
    </div>
  );
}
